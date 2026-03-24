#!/usr/bin/env python3
"""
Collect stability signals for one airport and push them into GateRank.

Cron example:
0 */6 * * * cd /Users/joyefrack/Documents/GitHub/GateRank && \
  ADMIN_API_KEY=... AIRPORT_ID=1 WEBSITE_URL=https://example.com \
  /usr/bin/python3 scripts/monitor_stability.py >> /var/log/gaterank-stability.log 2>&1
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


DEFAULT_API_BASE = "http://127.0.0.1:8787"
DEFAULT_TCP_PORT = 443
DEFAULT_HTTP_TIMEOUT = 8
DEFAULT_TCP_TIMEOUT = 5
DEFAULT_LATENCY_SAMPLE_COUNT = 5
DEFAULT_SOURCE = "cron-stability"


@dataclass
class Config:
    api_base: str
    admin_api_key: str
    admin_bearer_token: str | None
    all_airports: bool
    airport_id: int | None
    airport_keyword: str | None
    airport_status: str | None
    website_url: str | None
    tcp_host: str | None
    tcp_port: int
    http_timeout: int
    tcp_timeout: int
    latency_sample_count: int
    page_size: int
    source: str
    trigger_aggregate: bool
    trigger_recompute: bool


def main() -> int:
    try:
        config = build_config()
        sampled_at = shanghai_now_iso()
        sample_date = sampled_at[:10]
        airports = resolve_airports(config)
        results: list[dict[str, Any]] = []
        failures: list[dict[str, Any]] = []

        for airport in airports:
            try:
                results.append(run_for_airport(config, airport, sampled_at))
            except Exception as exc:
                failures.append(
                    {
                        "airport_id": airport.get("id"),
                        "airport_name": airport.get("name"),
                        "error": str(exc),
                    }
                )

        aggregate_result = (
            post_admin_action(
                config,
                f"/api/v1/admin/jobs/aggregate?{urlencode({'date': sample_date})}",
            )
            if results and config.trigger_aggregate
            else None
        )
        recompute_result: dict[str, Any] | None = None
        if config.trigger_recompute and results:
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
    except Exception as exc:  # pragma: no cover - script entrypoint
        print(f"[monitor_stability] {exc}", file=sys.stderr)
        return 1


def build_config() -> Config:
    parser = argparse.ArgumentParser(description="Collect airport stability samples and push to GateRank.")
    parser.add_argument("--api-base", default=os.getenv("API_BASE", DEFAULT_API_BASE))
    parser.add_argument("--admin-api-key", default=os.getenv("ADMIN_API_KEY"))
    parser.add_argument("--admin-bearer-token", default=os.getenv("ADMIN_BEARER_TOKEN"))
    parser.add_argument("--all-airports", action="store_true", default=falsey_env("ALL_AIRPORTS"))
    parser.add_argument("--airport-id", type=int, default=int_env("AIRPORT_ID"))
    parser.add_argument("--airport-keyword", default=os.getenv("AIRPORT_KEYWORD") or os.getenv("AIRPORT_NAME"))
    parser.add_argument("--airport-status", default=os.getenv("AIRPORT_STATUS"))
    parser.add_argument("--website-url", default=os.getenv("WEBSITE_URL"))
    parser.add_argument("--tcp-host", default=os.getenv("TCP_HOST"))
    parser.add_argument("--tcp-port", type=int, default=int(os.getenv("TCP_PORT", str(DEFAULT_TCP_PORT))))
    parser.add_argument("--http-timeout", type=int, default=int(os.getenv("HTTP_TIMEOUT", str(DEFAULT_HTTP_TIMEOUT))))
    parser.add_argument("--tcp-timeout", type=int, default=int(os.getenv("TCP_TIMEOUT", str(DEFAULT_TCP_TIMEOUT))))
    parser.add_argument(
        "--latency-sample-count",
        type=int,
        default=int(os.getenv("LATENCY_SAMPLE_COUNT", str(DEFAULT_LATENCY_SAMPLE_COUNT))),
    )
    parser.add_argument("--page-size", type=int, default=int(os.getenv("PAGE_SIZE", "100")))
    parser.add_argument("--source", default=os.getenv("SOURCE", DEFAULT_SOURCE))
    parser.add_argument(
        "--skip-aggregate",
        action="store_true",
        default=falsey_env("SKIP_AGGREGATE"),
        help="Only write probe samples; do not trigger daily aggregation.",
    )
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
    if args.all_airports and (args.website_url or args.tcp_host):
        raise ValueError("WEBSITE_URL / TCP_HOST overrides are only supported for single-airport mode")

    return Config(
        api_base=args.api_base.rstrip("/"),
        admin_api_key=args.admin_api_key,
        admin_bearer_token=args.admin_bearer_token,
        all_airports=args.all_airports,
        airport_id=args.airport_id,
        airport_keyword=args.airport_keyword,
        airport_status=args.airport_status,
        website_url=args.website_url,
        tcp_host=args.tcp_host,
        tcp_port=args.tcp_port,
        http_timeout=args.http_timeout,
        tcp_timeout=args.tcp_timeout,
        latency_sample_count=max(1, args.latency_sample_count),
        page_size=max(1, args.page_size),
        source=args.source,
        trigger_aggregate=not args.skip_aggregate,
        trigger_recompute=not args.skip_recompute,
    )


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
        params = {
            "page": page,
            "page_size": config.page_size,
        }
        if status:
            params["status"] = status
        data = get_json(config, f"/api/v1/admin/airports?{urlencode(params)}")
        batch = data.get("items", [])
        items.extend(batch)
        total = int(data.get("total", len(items)))
        if len(items) >= total or not batch:
            break
        page += 1
    return items


def run_for_airport(config: Config, airport: dict[str, Any], sampled_at: str) -> dict[str, Any]:
    website_url = config.website_url or choose_website(airport)
    tcp_host = config.tcp_host or extract_host(website_url)

    http_ok, http_status = check_http_ok(website_url, config.http_timeout)
    latency_samples = collect_latency_samples(
        tcp_host,
        config.tcp_port,
        config.latency_sample_count,
        config.tcp_timeout,
    )

    post_probe_sample(
        config,
        {
            "airport_id": airport["id"],
            "sampled_at": sampled_at,
            "sample_type": "availability",
            "availability": http_ok,
            "source": config.source,
        },
    )

    for latency in latency_samples:
        post_probe_sample(
            config,
            {
                "airport_id": airport["id"],
                "sampled_at": sampled_at,
                "sample_type": "latency",
                "latency_ms": latency,
                "source": config.source,
            },
        )

    return {
        "airport_id": airport["id"],
        "airport_name": airport["name"],
        "website_url": website_url,
        "tcp_host": tcp_host,
        "tcp_port": config.tcp_port,
        "http_ok": http_ok,
        "http_status": http_status,
        "latency_samples_ms": latency_samples,
    }


def check_http_ok(url: str, timeout: int) -> tuple[bool, int | None]:
    request = Request(url, method="GET", headers={"User-Agent": "GateRank-Stability-Monitor/1.0"})
    try:
        with urlopen(request, timeout=timeout) as response:
            status = int(response.status)
            return status in {200, 301, 302, 403}, status
    except HTTPError as exc:
        status = int(exc.code)
        return status in {200, 301, 302, 403}, status
    except URLError:
        return False, None


def tcp_latency_ms(host: str, port: int, timeout: int) -> float | None:
    start = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return round((time.perf_counter() - start) * 1000, 2)
    except OSError:
        return None


def collect_latency_samples(host: str, port: int, count: int, timeout: int) -> list[float]:
    samples: list[float] = []
    for _ in range(count):
        latency = tcp_latency_ms(host, port, timeout)
        if latency is not None:
            samples.append(latency)
        time.sleep(0.3)
    return samples


def post_probe_sample(config: Config, payload: dict[str, Any]) -> dict[str, Any]:
    return request_json(config, "POST", "/api/v1/admin/probe-samples", payload)


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
        "User-Agent": "GateRank-Stability-Monitor/1.0",
    }
    if config.admin_bearer_token:
        headers["Authorization"] = f"Bearer {config.admin_bearer_token}"
    else:
        headers["x-api-key"] = config.admin_api_key
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(f"{config.api_base}{path}", data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=max(config.http_timeout, config.tcp_timeout)) as response:
            charset = response.headers.get_content_charset("utf-8")
            data = response.read().decode(charset)
            return json.loads(data) if data else {}
    except HTTPError as exc:
        payload_text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed: {exc.code} {payload_text}") from exc
    except URLError as exc:
        raise RuntimeError(f"{method} {path} failed: {exc}") from exc


def extract_host(url: str) -> str:
    parsed = urlparse(url)
    return parsed.hostname or url


def choose_website(airport: dict[str, Any]) -> str:
    websites = airport.get("websites") or []
    if isinstance(websites, list):
        for value in websites:
            if isinstance(value, str) and value.strip():
                return value.strip()
    website = airport.get("website")
    if isinstance(website, str) and website.strip():
        return website.strip()
    raise ValueError(f"airport {airport.get('id')} has no website configured")


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
