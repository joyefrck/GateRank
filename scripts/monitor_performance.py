#!/usr/bin/env python3
"""
Collect performance signals for one or more airports via subscription links and push them into GateRank.

Cron example:
0 */6 * * * cd /Users/joyefrack/Documents/GitHub/GateRank && \
  ADMIN_API_KEY=... ALL_AIRPORTS=1 /usr/bin/python3 scripts/monitor_performance.py >> /var/log/gaterank-performance.log 2>&1
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import random
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlencode, urlparse
from urllib.request import (
    ProxyHandler,
    Request,
    build_opener,
    urlopen,
)


DEFAULT_API_BASE = "http://127.0.0.1:8787"
DEFAULT_HTTP_TIMEOUT = 10
DEFAULT_PROXY_PORT = 7890
DEFAULT_PROXY_STARTUP_TIMEOUT = 8
DEFAULT_LATENCY_ATTEMPTS = 3
DEFAULT_SPEED_TIMEOUT = 20
DEFAULT_SPEED_CONNECTIONS = 4
DEFAULT_SOURCE = "cron-performance"
DEFAULT_TEST_URL_LATENCY = "https://www.google.com/generate_204"
DEFAULT_TEST_URL_SPEED = "https://speed.cloudflare.com/__down?bytes=5000000"

REGION_PRIORITY = ("HK", "JP", "SG", "US")
REGION_KEYWORDS = {
    "HK": ("hk", "hong kong", "hongkong", "香港", "港"),
    "JP": ("jp", "japan", "tokyo", "osaka", "日本", "东京", "大阪"),
    "SG": ("sg", "singapore", "新加坡", "狮城"),
    "US": ("us", "usa", "america", "united states", "美国", "洛杉矶", "硅谷", "西雅图", "纽约"),
}


@dataclass
class Config:
    api_base: str
    admin_api_key: str
    admin_bearer_token: str | None
    all_airports: bool
    airport_id: int | None
    airport_keyword: str | None
    airport_status: str | None
    http_timeout: int
    proxy_port: int
    proxy_startup_timeout: int
    latency_attempts: int
    speed_timeout: int
    speed_connections: int
    page_size: int
    source: str
    test_url_latency: str
    test_url_speed: str
    sing_box_bin: str
    trigger_aggregate: bool
    trigger_recompute: bool


@dataclass
class ParsedNode:
    name: str
    node_type: str
    region: str | None
    outbound: dict[str, Any]
    raw_uri: str


@dataclass
class NodeProbeResult:
    node: ParsedNode
    latency_samples_ms: list[float]
    proxy_latency_samples_ms: list[float]
    download_mbps: float | None
    failures: int
    total_attempts: int
    error_code: str | None = None


def main() -> int:
    try:
        config = build_config()
        ensure_sing_box(config.sing_box_bin)
        sampled_at = shanghai_now_iso()
        sample_date = sampled_at[:10]
        airports = resolve_airports(config)
        results: list[dict[str, Any]] = []
        failures: list[dict[str, Any]] = []
        submitted_any = False

        for airport in airports:
            try:
                result = run_for_airport(config, airport, sampled_at)
                submit_result = post_performance_run(config, result["payload"])
                result["run_id"] = submit_result.get("run_id")
                results.append(result["summary"])
                submitted_any = True
            except Exception as exc:
                failures.append(
                    {
                        "airport_id": airport.get("id"),
                        "airport_name": airport.get("name"),
                        "error": str(exc),
                    }
                )

        aggregate_result = None
        recompute_result = None
        if submitted_any and config.trigger_aggregate:
            aggregate_result = post_admin_action(
                config,
                f"/api/v1/admin/jobs/aggregate?{urlencode({'date': sample_date})}",
            )
            if config.trigger_recompute:
                recompute_result = post_admin_action(
                    config,
                    f"/api/v1/admin/scores/recompute?{urlencode({'date': sample_date})}",
                )

        output = {
            "sampled_at": sampled_at,
            "airport_count": len(airports),
            "success_count": len(results),
            "failure_count": len(failures),
            "results": results,
            "failures": failures,
            "aggregate": aggregate_result,
            "recompute": recompute_result,
        }
        print(json.dumps(output, ensure_ascii=False))
        return 0 if not failures else 1
    except Exception as exc:
        print(f"[monitor_performance] {exc}", file=sys.stderr)
        return 1


def build_config() -> Config:
    parser = argparse.ArgumentParser(description="Collect airport performance samples and push to GateRank.")
    parser.add_argument("--api-base", default=os.getenv("API_BASE", DEFAULT_API_BASE))
    parser.add_argument("--admin-api-key", default=os.getenv("ADMIN_API_KEY"))
    parser.add_argument("--admin-bearer-token", default=os.getenv("ADMIN_BEARER_TOKEN"))
    parser.add_argument("--all-airports", action="store_true", default=falsey_env("ALL_AIRPORTS"))
    parser.add_argument("--airport-id", type=int, default=int_env("AIRPORT_ID"))
    parser.add_argument("--airport-keyword", default=os.getenv("AIRPORT_KEYWORD") or os.getenv("AIRPORT_NAME"))
    parser.add_argument("--airport-status", default=os.getenv("AIRPORT_STATUS"))
    parser.add_argument("--http-timeout", type=int, default=int(os.getenv("HTTP_TIMEOUT", str(DEFAULT_HTTP_TIMEOUT))))
    parser.add_argument("--proxy-port", type=int, default=int(os.getenv("PROXY_PORT", str(DEFAULT_PROXY_PORT))))
    parser.add_argument(
        "--proxy-startup-timeout",
        type=int,
        default=int(os.getenv("PROXY_STARTUP_TIMEOUT", str(DEFAULT_PROXY_STARTUP_TIMEOUT))),
    )
    parser.add_argument(
        "--latency-attempts",
        type=int,
        default=int(os.getenv("LATENCY_ATTEMPTS", str(DEFAULT_LATENCY_ATTEMPTS))),
    )
    parser.add_argument("--speed-timeout", type=int, default=int(os.getenv("SPEED_TIMEOUT", str(DEFAULT_SPEED_TIMEOUT))))
    parser.add_argument(
        "--speed-connections",
        type=int,
        default=int(os.getenv("SPEED_CONNECTIONS", str(DEFAULT_SPEED_CONNECTIONS))),
    )
    parser.add_argument("--page-size", type=int, default=int(os.getenv("PAGE_SIZE", "100")))
    parser.add_argument("--source", default=os.getenv("SOURCE", DEFAULT_SOURCE))
    parser.add_argument(
        "--skip-aggregate",
        action="store_true",
        default=falsey_env("SKIP_AGGREGATE"),
        help="Only write performance runs; do not trigger daily aggregation.",
    )
    parser.add_argument("--test-url-latency", default=os.getenv("TEST_URL_LATENCY", DEFAULT_TEST_URL_LATENCY))
    parser.add_argument("--test-url-speed", default=os.getenv("TEST_URL_SPEED", DEFAULT_TEST_URL_SPEED))
    parser.add_argument("--sing-box-bin", default=os.getenv("SING_BOX_BIN", "sing-box"))
    parser.add_argument(
        "--skip-recompute",
        action="store_true",
        default=falsey_env("SKIP_RECOMPUTE"),
        help="Only aggregate daily metrics; do not trigger score recompute.",
    )
    args = parser.parse_args()

    if not args.admin_api_key and not args.admin_bearer_token:
        raise ValueError("ADMIN_API_KEY or ADMIN_BEARER_TOKEN is required")
    if not args.all_airports and args.airport_id is None and not args.airport_keyword:
        raise ValueError("AIRPORT_ID or AIRPORT_KEYWORD is required")

    return Config(
        api_base=args.api_base.rstrip("/"),
        admin_api_key=args.admin_api_key,
        admin_bearer_token=args.admin_bearer_token,
        all_airports=args.all_airports,
        airport_id=args.airport_id,
        airport_keyword=args.airport_keyword,
        airport_status=args.airport_status,
        http_timeout=max(1, args.http_timeout),
        proxy_port=max(1, args.proxy_port),
        proxy_startup_timeout=max(1, args.proxy_startup_timeout),
        latency_attempts=max(1, args.latency_attempts),
        speed_timeout=max(1, args.speed_timeout),
        speed_connections=max(1, args.speed_connections),
        page_size=max(1, args.page_size),
        source=args.source,
        test_url_latency=args.test_url_latency,
        test_url_speed=args.test_url_speed,
        sing_box_bin=args.sing_box_bin,
        trigger_aggregate=not args.skip_aggregate,
        trigger_recompute=not args.skip_recompute,
    )


def ensure_sing_box(command: str) -> None:
    path = command if os.path.sep in command else shutil.which(command)
    if not path or not os.path.exists(path) or not os.access(path, os.X_OK):
        raise RuntimeError("singbox_not_found")
    try:
        subprocess.run([path, "version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    except OSError as exc:
        raise RuntimeError(f"singbox_not_found: {exc}") from exc


def resolve_airports(config: Config) -> list[dict[str, Any]]:
    if config.all_airports:
        return list_airports(config, config.airport_status)

    if config.airport_id is not None:
        return [get_json(config, f"/api/v1/admin/airports/{config.airport_id}")]

    assert config.airport_keyword is not None
    query = urlencode({"keyword": config.airport_keyword, "page_size": 20})
    data = get_json(config, f"/api/v1/admin/airports?{query}")
    items = data.get("items", [])
    if not items:
        raise ValueError(f"airport not found for keyword: {config.airport_keyword}")
    if len(items) > 1:
        names = ", ".join(str(item.get("name", "?")) for item in items)
        raise ValueError(
            f"airport keyword matched multiple airports: {names}. "
            "Set AIRPORT_ID or refine AIRPORT_KEYWORD.",
        )
    return [items[0]]


def list_airports(config: Config, status: str | None) -> list[dict[str, Any]]:
    page = 1
    items: list[dict[str, Any]] = []
    while True:
        params: dict[str, Any] = {"page": page, "page_size": config.page_size}
        if status:
            params["status"] = status
        data = get_json(config, f"/api/v1/admin/airports?{urlencode(params)}")
        batch = data.get("items", [])
        items.extend(item for item in batch if str(item.get("status") or "") != "down")
        total = int(data.get("total", len(items)))
        if len(batch) == 0 or page * config.page_size >= total:
            break
        page += 1
    return items


def run_for_airport(config: Config, airport: dict[str, Any], sampled_at: str) -> dict[str, Any]:
    airport_id = int(airport["id"])
    airport_name = str(airport.get("name", airport_id))
    subscription_url = str(airport.get("subscription_url") or "").strip()
    if not subscription_url:
        payload = build_run_payload(
            airport_id=airport_id,
            sampled_at=sampled_at,
            source=config.source,
            status="skipped",
            error_code="missing_subscription",
            error_message="subscription_url is empty",
            diagnostics={"airport_name": airport_name},
        )
        return {
            "payload": payload,
            "summary": summary_from_payload(payload, airport_name),
        }

    try:
        subscription_text = fetch_subscription(config, subscription_url)
    except Exception as exc:
        payload = build_run_payload(
            airport_id=airport_id,
            sampled_at=sampled_at,
            source=config.source,
            status="failed",
            error_code="subscription_fetch_failed",
            error_message=str(exc),
            diagnostics={"subscription_url": subscription_url},
        )
        return {
            "payload": payload,
            "summary": summary_from_payload(payload, airport_name),
        }

    normalized_subscription, subscription_format = normalize_subscription_text(subscription_text)
    if not normalized_subscription:
        payload = build_run_payload(
            airport_id=airport_id,
            sampled_at=sampled_at,
            source=config.source,
            status="skipped",
            subscription_format=subscription_format,
            error_code="unsupported_subscription_format",
            error_message="subscription content is not a supported URL list",
            diagnostics={"subscription_url": subscription_url},
        )
        return {
            "payload": payload,
            "summary": summary_from_payload(payload, airport_name),
        }

    parsed_nodes, unsupported_nodes = parse_nodes(normalized_subscription)
    selected_nodes = select_nodes(parsed_nodes)
    tested_nodes: list[dict[str, Any]] = []
    latency_samples: list[float] = []
    proxy_latency_samples: list[float] = []
    download_samples: list[float] = []
    total_attempts = 0
    total_failures = 0
    partial_errors: list[str] = []

    if not parsed_nodes or not selected_nodes:
        payload = build_run_payload(
            airport_id=airport_id,
            sampled_at=sampled_at,
            source=config.source,
            status="skipped",
            subscription_format=subscription_format,
            parsed_nodes_count=len(parsed_nodes),
            supported_nodes_count=len(parsed_nodes),
            selected_nodes=[node_to_summary(node) for node in selected_nodes],
            tested_nodes=[],
            error_code="no_supported_nodes",
            error_message="no testable nodes selected from subscription",
            diagnostics={
                "unsupported_nodes_count": len(unsupported_nodes),
                "unsupported_nodes": unsupported_nodes,
            },
        )
        return {
            "payload": payload,
            "summary": summary_from_payload(payload, airport_name),
        }

    for node in selected_nodes:
        probe = probe_node(config, node)
        tested_nodes.append(
            {
                **node_to_summary(node),
                "status": "ok" if probe.error_code is None else "failed",
                "error_code": probe.error_code,
                "connect_latency_samples_ms": [round(v, 2) for v in probe.latency_samples_ms],
                "connect_latency_median_ms": round(float(median(probe.latency_samples_ms)), 2)
                if probe.latency_samples_ms
                else None,
                "proxy_http_latency_samples_ms": [round(v, 2) for v in probe.proxy_latency_samples_ms],
                "proxy_http_latency_median_ms": round(float(median(probe.proxy_latency_samples_ms)), 2)
                if probe.proxy_latency_samples_ms
                else None,
                "download_mbps": round(float(probe.download_mbps), 2)
                if probe.download_mbps is not None
                else None,
            }
        )
        latency_samples.extend(probe.latency_samples_ms)
        proxy_latency_samples.extend(probe.proxy_latency_samples_ms)
        if probe.download_mbps is not None:
            download_samples.append(probe.download_mbps)
        total_attempts += probe.total_attempts
        total_failures += probe.failures
        if probe.error_code:
            partial_errors.append(f"{node.name}: {probe.error_code}")

    status = "success"
    error_code = None
    error_message = None
    if not latency_samples:
        status = "failed"
        error_code = "no_successful_probes"
        error_message = "; ".join(partial_errors) or "all selected nodes failed"
    elif partial_errors or unsupported_nodes:
        status = "partial"
        error_code = "partial_probe_failure"
        error_message = "; ".join(partial_errors[:3]) or "some nodes were skipped"

    packet_loss_percent = round((total_failures / total_attempts) * 100, 2) if total_attempts else None
    payload = build_run_payload(
        airport_id=airport_id,
        sampled_at=sampled_at,
        source=config.source,
        status=status,
        subscription_format=subscription_format,
        parsed_nodes_count=len(parsed_nodes),
        supported_nodes_count=len(parsed_nodes),
        selected_nodes=[node_to_summary(node) for node in selected_nodes],
        tested_nodes=tested_nodes,
        latency_samples_ms=latency_samples,
        download_samples_mbps=download_samples,
        packet_loss_percent=packet_loss_percent,
        error_code=error_code,
        error_message=error_message,
        diagnostics={
            "subscription_url": subscription_url,
            "latency_measurement": "tcp_connect_to_node_server",
            "latency_probe_target": "node_server",
            "proxy_http_latency_measurement": "http_get_via_local_proxy",
            "proxy_http_test_url": config.test_url_latency,
            "proxy_http_latency_samples_ms": [round(v, 2) for v in proxy_latency_samples],
            "proxy_http_median_latency_ms": round(float(median(proxy_latency_samples)), 2)
            if proxy_latency_samples
            else None,
            "speed_measurement": "multi_connection_http_download_via_local_proxy",
            "speed_test_url": config.test_url_speed,
            "speed_test_connections": config.speed_connections,
            "selected_node_count": len(selected_nodes),
            "unsupported_nodes_count": len(unsupported_nodes),
            "unsupported_nodes": unsupported_nodes,
        },
    )
    return {
        "payload": payload,
        "summary": summary_from_payload(payload, airport_name),
    }


def build_run_payload(
    *,
    airport_id: int,
    sampled_at: str,
    source: str,
    status: str,
    subscription_format: str | None = None,
    parsed_nodes_count: int = 0,
    supported_nodes_count: int = 0,
    selected_nodes: list[dict[str, Any]] | None = None,
    tested_nodes: list[dict[str, Any]] | None = None,
    latency_samples_ms: list[float] | None = None,
    download_samples_mbps: list[float] | None = None,
    packet_loss_percent: float | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    diagnostics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    latency_values = [round(v, 2) for v in latency_samples_ms or []]
    download_values = [round(v, 2) for v in download_samples_mbps or []]
    payload: dict[str, Any] = {
        "airport_id": airport_id,
        "sampled_at": sampled_at,
        "source": source,
        "status": status,
        "subscription_format": subscription_format,
        "parsed_nodes_count": parsed_nodes_count,
        "supported_nodes_count": supported_nodes_count,
        "selected_nodes": selected_nodes or [],
        "tested_nodes": tested_nodes or [],
        "latency_samples_ms": latency_values,
        "download_samples_mbps": download_values,
        "diagnostics": diagnostics or {},
    }
    if latency_values:
        payload["median_latency_ms"] = round(float(median(latency_values)), 2)
    if download_values:
        payload["median_download_mbps"] = round(float(median(download_values)), 2)
    if packet_loss_percent is not None:
        payload["packet_loss_percent"] = round(packet_loss_percent, 2)
    if error_code:
        payload["error_code"] = error_code
    if error_message:
        payload["error_message"] = error_message
    return payload


def summary_from_payload(payload: dict[str, Any], airport_name: str) -> dict[str, Any]:
    return {
        "airport_id": payload["airport_id"],
        "airport_name": airport_name,
        "status": payload["status"],
        "subscription_format": payload.get("subscription_format"),
        "median_latency_ms": payload.get("median_latency_ms"),
        "median_download_mbps": payload.get("median_download_mbps"),
        "packet_loss_percent": payload.get("packet_loss_percent"),
        "selected_nodes": [item.get("name") for item in payload.get("selected_nodes", [])],
        "tested_nodes_count": len(payload.get("tested_nodes", [])),
        "error_code": payload.get("error_code"),
        "error_message": payload.get("error_message"),
    }


def fetch_subscription(config: Config, url: str) -> str:
    request = Request(url, method="GET", headers={"User-Agent": "GateRank-Performance-Monitor/1.0"})
    with urlopen(request, timeout=config.http_timeout) as response:
        charset = response.headers.get_content_charset("utf-8")
        return response.read().decode(charset, errors="replace").strip()


def normalize_subscription_text(text: str) -> tuple[str, str]:
    stripped = text.strip()
    if not stripped:
        return "", "empty"
    if "proxies:" in stripped.lower():
        return "", "clash_yaml"
    if "outbounds" in stripped and stripped.lstrip().startswith("{"):
        return "", "provider_json"
    if "://" in stripped:
        return stripped, "plain"

    decoded = decode_base64_text(stripped)
    if decoded and "://" in decoded:
        return decoded, "base64"
    return "", "unknown"


def decode_base64_text(value: str) -> str:
    clean = "".join(value.split())
    padding = "=" * (-len(clean) % 4)
    try:
        return base64.b64decode(clean + padding).decode("utf-8", errors="ignore").strip()
    except Exception:
        return ""


def parse_nodes(subscription_text: str) -> tuple[list[ParsedNode], list[dict[str, str]]]:
    parsed_nodes: list[ParsedNode] = []
    unsupported_nodes: list[dict[str, str]] = []
    for raw_line in subscription_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        try:
            node = parse_node_line(line)
            if node:
                parsed_nodes.append(node)
                continue
            unsupported_nodes.append({"uri": line, "reason": "unsupported_scheme"})
        except Exception as exc:
            unsupported_nodes.append({"uri": line, "reason": str(exc)})
    return parsed_nodes, unsupported_nodes


def parse_node_line(line: str) -> ParsedNode | None:
    if line.startswith("vmess://"):
        return parse_vmess_node(line)
    if line.startswith("ss://"):
        return parse_shadowsocks_node(line)
    if line.startswith("trojan://"):
        return parse_trojan_node(line)
    if line.startswith("vless://"):
        return parse_vless_node(line)
    return None


def parse_vmess_node(uri: str) -> ParsedNode:
    raw = decode_base64_text(uri[8:])
    if not raw:
        raise ValueError("invalid_vmess_payload")
    data = json.loads(raw)
    server = require_value(data.get("add"), "vmess_server")
    port = int(require_value(data.get("port"), "vmess_port"))
    uuid = require_value(data.get("id"), "vmess_uuid")
    security = str(data.get("scy") or "auto")
    network = str(data.get("net") or "tcp").lower()
    name = str(data.get("ps") or f"vmess-{server}:{port}")
    outbound: dict[str, Any] = {
        "type": "vmess",
        "tag": "proxy",
        "server": server,
        "server_port": port,
        "uuid": uuid,
        "security": security,
        "alter_id": int(str(data.get("aid") or "0")),
    }
    apply_transport(outbound, network, str(data.get("path") or ""), str(data.get("host") or ""))
    apply_tls(
        outbound,
        str(data.get("tls") or "").lower() in {"tls", "1", "true"},
        server_name=str(data.get("sni") or data.get("host") or ""),
        fingerprint=str(data.get("fp") or ""),
        alpn=split_csv(str(data.get("alpn") or "")),
    )
    return ParsedNode(name=name, node_type="vmess", region=detect_region(name), outbound=outbound, raw_uri=uri)


def parse_shadowsocks_node(uri: str) -> ParsedNode:
    parsed = urlparse(uri)
    name = unquote(parsed.fragment or f"ss-{parsed.hostname or 'node'}")
    if parsed.query:
        query = parse_qs(parsed.query)
        if query.get("plugin"):
            raise ValueError("unsupported_ss_plugin")
    encoded = parsed.netloc
    if "@" not in encoded:
        decoded = decode_base64_text(parsed.netloc)
        if not decoded or "@" not in decoded:
            raise ValueError("invalid_ss_credentials")
        encoded = decoded
    else:
        userinfo, hostinfo = encoded.rsplit("@", 1)
        decoded_userinfo = decode_base64_text(userinfo)
        if decoded_userinfo and ":" in decoded_userinfo:
            encoded = f"{decoded_userinfo}@{hostinfo}"
    userinfo, hostinfo = encoded.rsplit("@", 1)
    if ":" not in userinfo or ":" not in hostinfo:
        raise ValueError("invalid_ss_uri")
    method, password = userinfo.split(":", 1)
    server, port = split_host_port(hostinfo)
    outbound: dict[str, Any] = {
        "type": "shadowsocks",
        "tag": "proxy",
        "server": server,
        "server_port": port,
        "method": method,
        "password": password,
    }
    return ParsedNode(name=name, node_type="shadowsocks", region=detect_region(name), outbound=outbound, raw_uri=uri)


def parse_trojan_node(uri: str) -> ParsedNode:
    parsed = urlparse(uri)
    server = require_value(parsed.hostname, "trojan_server")
    port = int(require_value(parsed.port, "trojan_port"))
    password = require_value(parsed.username, "trojan_password")
    name = unquote(parsed.fragment or f"trojan-{server}:{port}")
    query = parse_qs(parsed.query)
    outbound: dict[str, Any] = {
        "type": "trojan",
        "tag": "proxy",
        "server": server,
        "server_port": port,
        "password": password,
    }
    apply_transport(
        outbound,
        first_query(query, "type", "tcp").lower(),
        first_query(query, "path", ""),
        first_query(query, "host", ""),
        service_name=first_query(query, "serviceName", ""),
    )
    apply_tls(
        outbound,
        True,
        server_name=first_query(query, "sni", parsed.hostname or ""),
        insecure=first_query(query, "allowInsecure", "0") in {"1", "true"},
        fingerprint=first_query(query, "fp", ""),
        alpn=split_csv(first_query(query, "alpn", "")),
    )
    return ParsedNode(name=name, node_type="trojan", region=detect_region(name), outbound=outbound, raw_uri=uri)


def parse_vless_node(uri: str) -> ParsedNode:
    parsed = urlparse(uri)
    server = require_value(parsed.hostname, "vless_server")
    port = int(require_value(parsed.port, "vless_port"))
    uuid = require_value(parsed.username, "vless_uuid")
    name = unquote(parsed.fragment or f"vless-{server}:{port}")
    query = parse_qs(parsed.query)
    outbound: dict[str, Any] = {
        "type": "vless",
        "tag": "proxy",
        "server": server,
        "server_port": port,
        "uuid": uuid,
    }
    flow = first_query(query, "flow", "")
    if flow:
        outbound["flow"] = flow
    apply_transport(
        outbound,
        first_query(query, "type", "tcp").lower(),
        first_query(query, "path", ""),
        first_query(query, "host", ""),
        service_name=first_query(query, "serviceName", ""),
    )
    security = first_query(query, "security", "").lower()
    if security in {"tls", "reality"}:
        apply_tls(
            outbound,
            True,
            server_name=first_query(query, "sni", parsed.hostname or ""),
            insecure=first_query(query, "allowInsecure", "0") in {"1", "true"},
            fingerprint=first_query(query, "fp", ""),
            alpn=split_csv(first_query(query, "alpn", "")),
            reality=security == "reality",
            public_key=first_query(query, "pbk", ""),
            short_id=first_query(query, "sid", ""),
        )
    return ParsedNode(name=name, node_type="vless", region=detect_region(name), outbound=outbound, raw_uri=uri)


def apply_transport(
    outbound: dict[str, Any],
    network: str,
    path: str,
    host: str,
    *,
    service_name: str = "",
) -> None:
    if network in {"tcp", "", "none"}:
        return
    if network == "ws":
        transport: dict[str, Any] = {"type": "ws"}
        if path:
            transport["path"] = path
        if host:
            transport["headers"] = {"Host": host}
        outbound["transport"] = transport
        return
    if network == "grpc":
        transport = {"type": "grpc"}
        if service_name or path:
            transport["service_name"] = service_name or path.lstrip("/")
        outbound["transport"] = transport
        return
    if network in {"http", "h2"}:
        transport = {"type": "http"}
        if host:
            transport["host"] = [item.strip() for item in host.split(",") if item.strip()]
        if path:
            transport["path"] = path
        outbound["transport"] = transport
        return
    raise ValueError(f"unsupported_transport_{network}")


def apply_tls(
    outbound: dict[str, Any],
    enabled: bool,
    *,
    server_name: str,
    insecure: bool = False,
    fingerprint: str = "",
    alpn: list[str] | None = None,
    reality: bool = False,
    public_key: str = "",
    short_id: str = "",
) -> None:
    if not enabled:
        return
    tls_config: dict[str, Any] = {
        "enabled": True,
        "server_name": server_name or None,
        "insecure": insecure,
    }
    if alpn:
        tls_config["alpn"] = alpn
    if fingerprint:
        tls_config["utls"] = {"enabled": True, "fingerprint": fingerprint}
    if reality:
        if not public_key:
            raise ValueError("missing_reality_public_key")
        tls_config["reality"] = {"enabled": True, "public_key": public_key}
        if short_id:
            tls_config["reality"]["short_id"] = short_id
    outbound["tls"] = {key: value for key, value in tls_config.items() if value not in (None, "", [])}


def select_nodes(nodes: list[ParsedNode], rng: Any = random) -> list[ParsedNode]:
    selected: list[ParsedNode] = []
    used_names: set[str] = set()
    for region in REGION_PRIORITY:
        candidates = [item for item in nodes if item.region == region and item.name not in used_names]
        if not candidates:
            continue
        node = rng.choice(candidates)
        selected.append(node)
        used_names.add(node.name)
        if len(selected) >= 3:
            return selected

    remaining_nodes = [node for node in nodes if node.name not in used_names]
    rng.shuffle(remaining_nodes)
    for node in remaining_nodes:
        selected.append(node)
        used_names.add(node.name)
        if len(selected) >= 3:
            break
    return selected


def detect_region(name: str) -> str | None:
    normalized = name.lower()
    for region, keywords in REGION_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            return region
    return None


def probe_node(config: Config, node: ParsedNode) -> NodeProbeResult:
    config_path = ""
    proc: subprocess.Popen[Any] | None = None
    try:
        proc, config_path = run_sing_box(config, node)
        latency_samples, failures, total_attempts = test_node_connect_latency(config, node)
        proxy_latency_samples, _, _ = test_proxy_http_latency(config)
        download_mbps = test_speed(config)
        error_code = None
        if not latency_samples:
            error_code = "connect_probe_failed"
        return NodeProbeResult(
            node=node,
            latency_samples_ms=latency_samples,
            proxy_latency_samples_ms=proxy_latency_samples,
            download_mbps=download_mbps,
            failures=failures,
            total_attempts=total_attempts,
            error_code=error_code,
        )
    except Exception as exc:
        return NodeProbeResult(
            node=node,
            latency_samples_ms=[],
            proxy_latency_samples_ms=[],
            download_mbps=None,
            failures=config.latency_attempts,
            total_attempts=config.latency_attempts,
            error_code=str(exc),
        )
    finally:
        stop_sing_box(proc, config_path)


def run_sing_box(config: Config, node: ParsedNode) -> tuple[subprocess.Popen[Any], str]:
    sing_box_path = config.sing_box_bin if os.path.sep in config.sing_box_bin else shutil.which(config.sing_box_bin)
    if not sing_box_path:
        raise RuntimeError("singbox_not_found")
    sing_box_config = {
        "log": {"disabled": True},
        "inbounds": [
            {
                "type": "http",
                "tag": "in-http",
                "listen": "127.0.0.1",
                "listen_port": config.proxy_port,
            }
        ],
        "outbounds": [
            node.outbound,
            {"type": "direct", "tag": "direct"},
        ],
        "route": {"final": "proxy", "auto_detect_interface": True},
    }

    temp_file = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    with temp_file:
        json.dump(sing_box_config, temp_file, ensure_ascii=False)

    proc = subprocess.Popen(
        [sing_box_path, "run", "-c", temp_file.name],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    wait_for_port("127.0.0.1", config.proxy_port, config.proxy_startup_timeout)
    return proc, temp_file.name


def stop_sing_box(proc: subprocess.Popen[Any] | None, config_path: str) -> None:
    if proc is not None and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
    if config_path:
        try:
            os.unlink(config_path)
        except FileNotFoundError:
            pass


def wait_for_port(host: str, port: int, timeout_seconds: int) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            if sock.connect_ex((host, port)) == 0:
                return
        time.sleep(0.2)
    raise RuntimeError("singbox_start_failed")


def test_node_connect_latency(config: Config, node: ParsedNode) -> tuple[list[float], int, int]:
    address = resolve_probe_address(node)
    latencies: list[float] = []
    failures = 0
    for _ in range(config.latency_attempts):
        started = time.perf_counter()
        sock = socket.socket(address[0], socket.SOCK_STREAM)
        sock.settimeout(config.http_timeout)
        try:
            sock.connect(address[4])
            latencies.append(round((time.perf_counter() - started) * 1000, 2))
        except Exception:
            failures += 1
        finally:
            sock.close()
        time.sleep(0.2)
    return latencies, failures, config.latency_attempts


def test_proxy_http_latency(config: Config) -> tuple[list[float], int, int]:
    opener = build_proxy_opener(config)
    latencies: list[float] = []
    failures = 0
    request = Request(config.test_url_latency, method="GET", headers={"User-Agent": "GateRank-Performance-Monitor/1.0"})
    for _ in range(config.latency_attempts):
        started = time.perf_counter()
        try:
            with opener.open(request, timeout=config.http_timeout) as response:
                response.read(1)
            latencies.append(round((time.perf_counter() - started) * 1000, 2))
        except Exception:
            failures += 1
        time.sleep(0.2)
    return latencies, failures, config.latency_attempts


def test_speed(config: Config) -> float | None:
    total_bytes = 0
    total_bytes_lock = threading.Lock()
    deadline = time.perf_counter() + config.speed_timeout
    request_headers = {"User-Agent": "GateRank-Performance-Monitor/1.0"}

    def worker() -> None:
        nonlocal total_bytes
        opener = build_proxy_opener(config)
        while time.perf_counter() < deadline:
            request = Request(config.test_url_speed, method="GET", headers=request_headers)
            try:
                with opener.open(request, timeout=config.http_timeout) as response:
                    while time.perf_counter() < deadline:
                        chunk = response.read(65536)
                        if not chunk:
                            break
                        with total_bytes_lock:
                            total_bytes += len(chunk)
            except Exception:
                return

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(config.speed_connections)]
    started = time.perf_counter()
    for thread in threads:
        thread.start()
    for thread in threads:
        remaining = deadline - time.perf_counter()
        thread.join(timeout=max(0, remaining) + 1)
    duration = time.perf_counter() - started
    if duration <= 0 or total_bytes <= 0:
        return None
    return round(total_bytes / duration / 1024 / 1024 * 8, 2)


def build_proxy_opener(config: Config):
    proxy_url = f"http://127.0.0.1:{config.proxy_port}"
    handler = ProxyHandler({"http": proxy_url, "https": proxy_url})
    context = ssl.create_default_context()
    opener = build_opener(handler, build_https_handler(context))
    return opener


def resolve_probe_address(node: ParsedNode) -> tuple[int, int, int, str, tuple[Any, ...]]:
    server = str(require_value(node.outbound.get("server"), "node server"))
    port = int(require_value(node.outbound.get("server_port"), "node server_port"))
    infos = socket.getaddrinfo(server, port, type=socket.SOCK_STREAM)
    if not infos:
        raise RuntimeError("node_address_resolve_failed")
    return infos[0]


def build_https_handler(context: ssl.SSLContext):
    from urllib.request import HTTPSHandler

    return HTTPSHandler(context=context)


def post_performance_run(config: Config, payload: dict[str, Any]) -> dict[str, Any]:
    return request_json(config, "POST", "/api/v1/admin/performance-runs", payload)


def post_admin_action(config: Config, path: str) -> dict[str, Any]:
    return request_json(config, "POST", path)


def get_json(config: Config, path: str) -> dict[str, Any]:
    return request_json(config, "GET", path)


def request_json(
    config: Config,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body = None
    headers = {
        "Accept": "application/json",
        "User-Agent": "GateRank-Performance-Monitor/1.0",
    }
    if config.admin_bearer_token:
        headers["Authorization"] = f"Bearer {config.admin_bearer_token}"
    if config.admin_api_key:
        headers["x-api-key"] = config.admin_api_key
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(f"{config.api_base}{path}", data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=max(config.http_timeout, config.speed_timeout)) as response:
            charset = response.headers.get_content_charset("utf-8")
            data = response.read().decode(charset)
            return json.loads(data) if data else {}
    except HTTPError as exc:
        payload_text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed: {exc.code} {payload_text}") from exc
    except URLError as exc:
        raise RuntimeError(f"{method} {path} failed: {exc}") from exc


def node_to_summary(node: ParsedNode) -> dict[str, Any]:
    return {
        "name": node.name,
        "region": node.region,
        "type": node.node_type,
    }


def split_host_port(value: str) -> tuple[str, int]:
    if value.startswith("["):
        host, _, tail = value.partition("]")
        port = tail.lstrip(":")
        return host.lstrip("["), int(port)
    host, port = value.rsplit(":", 1)
    return host, int(port)


def require_value(value: Any, label: str) -> Any:
    if value in (None, ""):
        raise ValueError(label)
    return value


def first_query(query: dict[str, list[str]], key: str, default: str = "") -> str:
    values = query.get(key)
    if not values:
        return default
    return str(values[0])


def split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def shanghai_now_iso() -> str:
    shanghai = timezone(timedelta(hours=8))
    return datetime.now(shanghai).replace(microsecond=0).isoformat()


def int_env(name: str) -> int | None:
    value = os.getenv(name)
    if value is None or value == "":
        return None
    return int(value)


def falsey_env(name: str) -> bool:
    value = os.getenv(name, "").strip().lower()
    return value in {"1", "true", "yes", "on"}


if __name__ == "__main__":
    raise SystemExit(main())
