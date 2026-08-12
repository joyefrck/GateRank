#!/usr/bin/env python3
"""Collect GateRank Network Coverage (N) using real proxy HTTP health checks."""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.monitor_performance import (
    Config,
    NodeSourceResult,
    build_config,
    get_latest_subscription_node_snapshot,
    nodes_from_snapshot,
    performance_node_key,
    probe_node_proxy_http_availability,
    request_json,
    resolve_airports,
    shanghai_now_iso,
)


def main() -> int:
    try:
        config = build_config()
        sampled_at = shanghai_now_iso()
        airports = resolve_airports(config)
        results: list[dict[str, Any]] = []
        failures: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []

        for airport in airports:
            airport_id = int(airport["id"])
            airport_name = str(airport.get("name") or airport_id)
            subscription_url = str(airport.get("subscription_url") or "").strip()
            if not subscription_url:
                skipped.append({
                    "airport_id": airport_id,
                    "airport_name": airport_name,
                    "reason": "missing_subscription",
                })
                post_coverage_run(config, airport_id, build_failure_payload(
                    airport_id,
                    sampled_at,
                    config.source,
                    "skipped",
                    "missing_subscription",
                    "subscription_url is empty",
                ))
                continue
            try:
                summary = collect_airport(config, airport, sampled_at)
                results.append(summary)
            except Exception as exc:
                error_code = safe_error_code(exc)
                failures.append({
                    "airport_id": airport_id,
                    "airport_name": airport_name,
                    "error_code": error_code,
                })
                try:
                    post_coverage_run(config, airport_id, build_failure_payload(
                        airport_id,
                        sampled_at,
                        config.source,
                        "failed",
                        error_code,
                        "network coverage collection failed",
                    ))
                except Exception:
                    pass

        output = {
            "sampled_at": sampled_at,
            "airport_count": len(airports),
            "success_count": len(results),
            "failure_count": len(failures),
            "skipped_count": len(skipped),
            "results": results,
            "failures": failures,
            "skipped": skipped,
        }
        if len(results) == 1 and not failures:
            output.update(results[0])
        print(json.dumps(output, ensure_ascii=False))
        return 0 if not failures else 1
    except Exception as exc:
        print(json.dumps({"status": "failed", "error_code": safe_error_code(exc)}, ensure_ascii=False))
        return 1


def collect_airport(config: Config, airport: dict[str, Any], sampled_at: str) -> dict[str, Any]:
    airport_id = int(airport["id"])
    subscription_url = str(airport.get("subscription_url") or "").strip()
    node_source = resolve_network_coverage_nodes(config, airport_id, subscription_url)
    nodes = node_source.nodes
    results = [probe_node_proxy_http_availability(config, node) for node in nodes]
    node_payloads = [
        {
            "key": performance_node_key(item.node),
            "name": sanitize_node_name(item.node.name),
            "type": item.node.node_type,
            "healthy": item.available,
            "error_code": sanitize_node_error(item.error_code),
        }
        for item in results
    ]
    healthy_count = sum(1 for item in results if item.available)
    payload = {
        "airport_id": airport_id,
        "sampled_at": sampled_at,
        "sampled_date": sampled_at[:10],
        "source": normalize_source(config.source),
        "status": "success",
        "subscription_format": node_source.subscription_format,
        "unsupported_nodes_count": len(node_source.unsupported_nodes),
        "nodes": node_payloads,
        "diagnostics": {
            "health_check": "proxy_http_via_sing_box",
            "test_url": config.test_url_latency,
            "attempted_nodes_count": len(results),
            "healthy_nodes_count": healthy_count,
            "unhealthy_nodes_count": len(results) - healthy_count,
            "node_source": node_source.node_source,
            "error_summary": error_summary(node_payloads),
        },
    }
    response = post_coverage_run(config, airport_id, payload)
    return {
        "airport_id": airport_id,
        "run_id": response.get("run_id"),
        "status": response.get("status", "success"),
        "detected_nodes_count": len(results),
        "healthy_nodes_count": healthy_count,
        "unsupported_nodes_count": len(node_source.unsupported_nodes),
        "score_n": response.get("score_n"),
    }


def resolve_network_coverage_nodes(config: Config, airport_id: int, subscription_url: str) -> NodeSourceResult:
    """Load every testable snapshot node without applying P node selection."""
    snapshot = get_latest_subscription_node_snapshot(config, airport_id)
    if str(snapshot.get("subscription_url") or "").strip() != subscription_url.strip():
        raise RuntimeError("stale_subscription_node_snapshot")
    nodes, invalid_nodes = nodes_from_snapshot(snapshot)
    unsupported = snapshot.get("unsupported_nodes")
    unsupported_nodes = unsupported if isinstance(unsupported, list) else []
    diagnostics: dict[str, Any] = {
        "node_source": "stored_snapshot",
        "cache_snapshot_id": snapshot.get("id"),
        "cache_captured_at": snapshot.get("captured_at"),
        "invalid_cached_nodes_count": len(invalid_nodes),
    }
    return NodeSourceResult(
        nodes=nodes,
        unsupported_nodes=unsupported_nodes,
        subscription_format=str(snapshot.get("subscription_format") or "stored_snapshot"),
        node_source="stored_snapshot",
        diagnostics=diagnostics,
    )


def post_coverage_run(config: Config, airport_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    return request_json(
        config,
        "POST",
        f"/api/v1/admin/airports/{airport_id}/network-coverage-runs",
        payload,
    )


def build_failure_payload(
    airport_id: int,
    sampled_at: str,
    source: str,
    status: str,
    error_code: str,
    error_message: str,
) -> dict[str, Any]:
    return {
        "airport_id": airport_id,
        "sampled_at": sampled_at,
        "sampled_date": sampled_at[:10],
        "source": normalize_source(source),
        "status": status,
        "unsupported_nodes_count": 0,
        "nodes": [],
        "error_code": error_code,
        "error_message": error_message,
        "diagnostics": {"health_check": "proxy_http_via_sing_box"},
    }


def normalize_source(source: str) -> str:
    value = (source or "network-coverage").strip()
    if "performance" in value:
        value = value.replace("performance", "network-coverage")
    return value[:128]


def error_summary(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for node in nodes:
        if node.get("healthy"):
            continue
        code = str(node.get("error_code") or "unknown")
        counts[code] = counts.get(code, 0) + 1
    return [
        {"error_code": code, "count": count}
        for code, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def sanitize_node_error(value: Any) -> str | None:
    if value in (None, ""):
        return None
    text = str(value).lower()
    if text.startswith("tcp_unreachable"):
        return "tcp_unreachable"
    safe_proxy_codes = {
        "proxy_ssl_eof",
        "proxy_connection_reset",
        "proxy_http_timeout",
        "proxy_start_failed",
        "proxy_http_failed",
        "proxy_check_failed",
    }
    if text in safe_proxy_codes:
        return text
    if "unexpected_eof_while_reading" in text:
        return "proxy_ssl_eof"
    if "connection reset" in text:
        return "proxy_connection_reset"
    if "timeout" in text or "timed out" in text:
        return "proxy_http_timeout"
    if "sing-box" in text or "sing_box" in text:
        return "proxy_start_failed"
    if "http" in text:
        return "proxy_http_failed"
    return "proxy_check_failed"


def sanitize_node_name(value: Any) -> str:
    text = str(value or "").strip()[:512]
    if re.search(r"(?:https?|vless|trojan|ss|ssr|vmess)://", text, flags=re.IGNORECASE):
        return "[redacted-node-name]"
    return re.sub(
        r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
        "[redacted-id]",
        text,
        flags=re.IGNORECASE,
    ) or "unnamed-node"


def safe_error_code(exc: Exception) -> str:
    text = str(exc).lower()
    if "subscription" in text:
        return "subscription_fetch_or_parse_failed"
    if "sing-box" in text or "sing_box" in text:
        return "sing_box_unavailable"
    if "timeout" in text or "timed out" in text:
        return "collection_timeout"
    return "network_coverage_collection_failed"


if __name__ == "__main__":
    raise SystemExit(main())
