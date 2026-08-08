#!/usr/bin/env python3
"""Run one restricted GateRank performance-probe job without logging secrets."""

from __future__ import annotations

import argparse
import json
import os
import random
from pathlib import Path
import sys
from dataclasses import dataclass, field
from statistics import median
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.monitor_performance import (
    Config,
    ParsedNode,
    SpeedTargetResult,
    nodes_from_snapshot,
    performance_node_key,
    run_sing_box,
    select_nodes,
    shanghai_now_iso,
    stop_sing_box,
    target_download_median,
    test_node_connect_latency,
    test_proxy_http_latency,
    test_proxy_real_latency,
    test_speed_targets,
)


@dataclass(frozen=True)
class ProbeRunnerConfig:
    api_base: str
    api_token: str
    worker_id: str
    http_timeout: int
    proxy_port: int
    proxy_startup_timeout: int
    latency_attempts: int
    request_loss_attempts: int
    speed_timeout: int
    speed_connections: int
    sing_box_bin: str


TargetResult = SpeedTargetResult


@dataclass(frozen=True)
class NodeSummary:
    download_mbps: float | None
    valid_target_count: int


@dataclass(frozen=True)
class NodeMeasurement:
    node: ParsedNode
    latency_samples_ms: list[float]
    latency_sampled_at: list[str]
    proxy_latency_samples_ms: list[float]
    proxy_failures: int
    proxy_attempts: int
    connect_failures: int
    connect_attempts: int
    targets: list[TargetResult]
    error_code: str | None
    connect_latency_samples_ms: list[float] = field(default_factory=list)


class ProbeRunnerError(RuntimeError):
    pass


def main() -> int:
    try:
        config = build_config()
        result = run_once(config)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:
        code = exc.args[0] if isinstance(exc, ProbeRunnerError) and exc.args else "probe_runner_failed"
        print(json.dumps({"status": "failed", "error_code": str(code)}, ensure_ascii=False))
        return 1


def build_config() -> ProbeRunnerConfig:
    parser = argparse.ArgumentParser(description="Run one GateRank mainland performance-probe job")
    parser.add_argument("--api-base", default=os.getenv("PROBE_API_BASE", ""))
    parser.add_argument("--worker-id", default=os.getenv("PROBE_WORKER_ID", "worker"))
    args = parser.parse_args()
    token = os.getenv("PROBE_API_TOKEN", "")
    if not args.api_base.startswith("https://") and not falsey_env("PROBE_ALLOW_HTTP"):
        raise ProbeRunnerError("probe_api_https_required")
    if len(token) < 24:
        raise ProbeRunnerError("probe_api_token_missing")
    return ProbeRunnerConfig(
        api_base=args.api_base.rstrip("/"),
        api_token=token,
        worker_id=args.worker_id,
        http_timeout=int(os.getenv("PROBE_HTTP_TIMEOUT", "10")),
        proxy_port=int(os.getenv("PROBE_PROXY_PORT", "7890")),
        proxy_startup_timeout=int(os.getenv("PROBE_PROXY_STARTUP_TIMEOUT", "8")),
        latency_attempts=int(os.getenv("PROBE_LATENCY_ATTEMPTS", "3")),
        request_loss_attempts=int(os.getenv("PROBE_REQUEST_LOSS_ATTEMPTS", "10")),
        speed_timeout=int(os.getenv("PROBE_SPEED_TIMEOUT", "10")),
        speed_connections=int(os.getenv("PROBE_SPEED_CONNECTIONS", "2")),
        sing_box_bin=os.getenv("SING_BOX_BIN", "sing-box"),
    )


def run_once(config: ProbeRunnerConfig) -> dict[str, Any]:
    job = request_probe_json(config, "GET", "/jobs", worker_id=config.worker_id)
    if job is None:
        return {"status": "idle"}
    if not isinstance(job, dict):
        raise ProbeRunnerError("invalid_job_payload")
    job_id = require_string(job.get("job_id"), "job_id")
    snapshot = object_value(job.get("snapshot"))
    nodes, invalid_nodes = nodes_from_snapshot(snapshot)
    selected = resolve_job_nodes(job, nodes)
    targets = speed_targets(job.get("speed_targets"))
    measurements = [measure_node(config, node, targets) for node in selected]
    payload = build_success_payload(job, config, selected, measurements, invalid_nodes)
    request_probe_json(config, "POST", "/runs", payload)
    return {"status": payload["status"], "job_id": job_id}


def measure_node(
    runner_config: ProbeRunnerConfig,
    node: ParsedNode,
    targets: list[dict[str, str]],
) -> NodeMeasurement:
    config = legacy_config(runner_config, targets[0]["url"] if targets else "https://invalid.local")
    proc = None
    config_path = ""
    try:
        proc, config_path = run_sing_box(config, node)
        connect_latencies, _connect_sampled_at, connect_failures, connect_attempts = test_node_connect_latency(config, node)
        latency_samples, latency_sampled_at, _real_failures, _real_attempts = test_proxy_real_latency(config)
        proxy_latencies, proxy_failures, proxy_attempts = test_proxy_http_latency(config)
        target_results = test_speed_targets(config, targets)
        summary = build_node_summary(target_results)
        error_code = None
        if not latency_samples or summary.download_mbps is None or summary.valid_target_count < len(targets):
            error_code = "node_probe_partial"
        return NodeMeasurement(
            node=node,
            latency_samples_ms=latency_samples,
            latency_sampled_at=latency_sampled_at,
            proxy_latency_samples_ms=proxy_latencies,
            proxy_failures=proxy_failures,
            proxy_attempts=proxy_attempts,
            connect_failures=connect_failures,
            connect_attempts=connect_attempts,
            targets=target_results,
            error_code=error_code,
            connect_latency_samples_ms=connect_latencies,
        )
    except Exception:
        return NodeMeasurement(node, [], [], [], 1, 1, 1, 1, [], "node_probe_failed")
    finally:
        stop_sing_box(proc, config_path)


def build_success_payload(
    job: dict[str, Any],
    config: ProbeRunnerConfig,
    selected: list[ParsedNode],
    measurements: list[NodeMeasurement],
    invalid_nodes: list[dict[str, str]],
) -> dict[str, Any]:
    latency_samples = [value for item in measurements for value in item.latency_samples_ms]
    latency_sampled_at = [value for item in measurements for value in item.latency_sampled_at]
    downloads = [
        summary.download_mbps
        for summary in (build_node_summary(item.targets) for item in measurements)
        if summary.download_mbps is not None
    ]
    total_proxy_attempts = sum(item.proxy_attempts for item in measurements)
    total_proxy_failures = sum(item.proxy_failures for item in measurements)
    tested_nodes = [measurement_to_payload(item) for item in measurements]
    available_count = sum(1 for item in measurements if item.latency_samples_ms)
    selected_count = len(selected)
    target_results = [
        {
            "node_key": performance_node_key(item.node),
            "target_key": target.target_key,
            "bytes_downloaded": target.bytes_downloaded,
            "duration_ms": target.duration_ms,
            "download_mbps": target.download_mbps,
            "http_status": target.http_status,
            "error_code": target.error_code,
            "valid": target.valid,
        }
        for item in measurements
        for target in item.targets
    ]
    complete = downloads and len(downloads) == selected_count and all(item.error_code is None for item in measurements)
    status = "success" if complete else "partial" if downloads else "failed"
    payload = base_run_payload(job, config)
    payload.update({
        "status": status,
        "calibration_status": "not_required",
        "calibration_mbps": None,
        "subscription_format": object_value(job.get("snapshot")).get("subscription_format"),
        "parsed_nodes_count": object_value(job.get("snapshot")).get("parsed_nodes_count") or selected_count,
        "supported_nodes_count": object_value(job.get("snapshot")).get("supported_nodes_count") or selected_count,
        "selected_nodes": [node_identity(node) for node in selected],
        "tested_nodes": tested_nodes,
        "available_nodes_count": available_count,
        "unavailable_nodes_count": max(0, selected_count - available_count),
        "node_availability_percent": round(available_count / selected_count * 100, 2) if selected_count else 0,
        "node_unavailability_percent": round((selected_count - available_count) / selected_count * 100, 2) if selected_count else 100,
        "latency_samples_ms": latency_samples,
        "latency_sampled_at": latency_sampled_at,
        "download_samples_mbps": downloads,
        "median_latency_ms": round(float(median(latency_samples)), 2) if latency_samples else None,
        "median_download_mbps": round(float(median(downloads)), 2) if downloads else None,
        "packet_loss_percent": round(total_proxy_failures / total_proxy_attempts * 100, 2) if total_proxy_attempts else 100,
        "target_results": target_results,
        "diagnostics": {
            "invalid_snapshot_nodes_count": len(invalid_nodes),
            "target_count": len(speed_targets(job.get("speed_targets"))),
            "test_profile": str(job.get("test_profile") or "proxy_multi_target_v2"),
            "speed_measurement": "average_multi_connection_download_via_sing_box_proxy",
        },
    })
    return payload


def build_node_summary(results: list[TargetResult]) -> NodeSummary:
    return NodeSummary(
        download_mbps=target_download_median(results),
        valid_target_count=sum(1 for result in results if result.valid and result.download_mbps is not None),
    )


def measurement_to_payload(measurement: NodeMeasurement) -> dict[str, Any]:
    summary = build_node_summary(measurement.targets)
    proxy_median = round(float(median(measurement.proxy_latency_samples_ms)), 2) if measurement.proxy_latency_samples_ms else None
    connect_median = round(float(median(measurement.connect_latency_samples_ms)), 2) if measurement.connect_latency_samples_ms else None
    return {
        **node_identity(measurement.node),
        "status": "ok" if measurement.error_code is None else "partial",
        "error_code": measurement.error_code,
        "connect_latency_samples_ms": measurement.connect_latency_samples_ms,
        "connect_latency_median_ms": connect_median,
        "proxy_http_latency_samples_ms": measurement.proxy_latency_samples_ms,
        "proxy_http_latency_median_ms": proxy_median,
        "proxy_http_request_failures": measurement.proxy_failures,
        "proxy_http_request_attempts": measurement.proxy_attempts,
        "proxy_http_request_failure_percent": round(measurement.proxy_failures / measurement.proxy_attempts * 100, 2) if measurement.proxy_attempts else 100,
        "connect_failures": measurement.connect_failures,
        "connect_attempts": measurement.connect_attempts,
        "download_mbps": summary.download_mbps,
    }


def resolve_job_nodes(job: dict[str, Any], nodes: list[ParsedNode]) -> list[ParsedNode]:
    selected_keys = job.get("selected_node_keys")
    if isinstance(selected_keys, list) and selected_keys:
        wanted = {str(item) for item in selected_keys}
        return [node for node in nodes if performance_node_key(node) in wanted]
    return select_nodes(nodes, random.Random(str(job.get("job_id") or "job")))


def speed_targets(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    targets: list[dict[str, str]] = []
    for item in value:
        row = object_value(item)
        target_key = optional_string(row.get("target_key"))
        url = optional_string(row.get("url"))
        if target_key and url and url.startswith("https://"):
            targets.append({"target_key": target_key, "url": url})
    return targets


def request_probe_json(
    config: ProbeRunnerConfig,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    worker_id: str | None = None,
) -> dict[str, Any] | None:
    body = json.dumps(payload, separators=(",", ":")).encode() if payload is not None else None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {config.api_token}",
        "User-Agent": "GateRank-Performance-Probe/1.0",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    if worker_id:
        headers["x-probe-worker"] = worker_id
    request = Request(f"{config.api_base}{path}", data=body, method=method, headers=headers)
    try:
        with urlopen(request, timeout=config.http_timeout) as response:
            if response.status == 204:
                return None
            raw = response.read()
            return json.loads(raw.decode()) if raw else {}
    except HTTPError as exc:
        raise ProbeRunnerError(f"probe_api_http_{exc.code}") from None
    except (URLError, TimeoutError):
        raise ProbeRunnerError("probe_api_unreachable") from None


def legacy_config(config: ProbeRunnerConfig, speed_url: str) -> Config:
    return Config(
        api_base=config.api_base,
        admin_api_key="",
        admin_bearer_token=None,
        all_airports=False,
        airport_id=None,
        airport_keyword=None,
        airport_status=None,
        http_timeout=config.http_timeout,
        proxy_port=config.proxy_port,
        proxy_startup_timeout=config.proxy_startup_timeout,
        latency_attempts=config.latency_attempts,
        latency_sample_interval_seconds=1,
        speed_timeout=config.speed_timeout,
        speed_connections=config.speed_connections,
        performance_concurrency=1,
        page_size=1,
        source="regional-performance-probe",
        test_url_latency="https://www.google.com/generate_204",
        test_url_speed=speed_url,
        sing_box_bin=config.sing_box_bin,
        trigger_aggregate=False,
        trigger_recompute=False,
        request_loss_attempts=config.request_loss_attempts,
        request_loss_sample_interval_seconds=0.5,
    )


def base_run_payload(job: dict[str, Any], config: ProbeRunnerConfig) -> dict[str, Any]:
    return {
        "job_id": require_string(job.get("job_id"), "job_id"),
        "probe_id": job.get("probe_id"),
        "sampled_at": shanghai_now_iso(),
        "source": "regional-performance-probe",
        "status": "failed",
        "selected_nodes": [],
        "tested_nodes": [],
        "target_results": [],
        "diagnostics": {"worker_id": config.worker_id},
    }


def node_identity(node: ParsedNode) -> dict[str, Any]:
    return {"name": node.name, "region": node.region, "type": node.node_type}


def require_string(value: Any, field: str) -> str:
    normalized = optional_string(value)
    if not normalized:
        raise ProbeRunnerError(f"invalid_{field}")
    return normalized


def optional_string(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def object_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def falsey_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


if __name__ == "__main__":
    raise SystemExit(main())
