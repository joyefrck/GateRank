#!/usr/bin/env python3
"""
Capture reusable subscription nodes for GateRank without running performance probes.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.monitor_performance import (
    CLASH_META_SUBSCRIPTION_USER_AGENT,
    Config,
    DEFAULT_SUBSCRIPTION_USER_AGENT,
    ParsedNode,
    build_config,
    fetch_subscription,
    normalize_subscription_text,
    parse_nodes,
    post_subscription_node_snapshot,
    resolve_airports,
    shanghai_now_iso,
    node_to_snapshot,
)

DIRECT_NODE_URI_SCHEMES = (
    "vless://",
    "vmess://",
    "trojan://",
    "ss://",
    "anytls://",
)


def main() -> int:
    try:
        config = build_config()
        captured_at = shanghai_now_iso()
        airports = resolve_airports(config)
        skipped = []
        targets = airports
        if config.all_airports:
            skipped = [
                {
                    "airport_id": airport.get("id"),
                    "airport_name": airport.get("name"),
                    "reason": "missing_subscription_url",
                }
                for airport in airports
                if not str(airport.get("subscription_url") or "").strip()
            ]
            targets = [
                airport
                for airport in airports
                if str(airport.get("subscription_url") or "").strip()
            ]
        results: list[dict[str, Any]] = []
        failures: list[dict[str, Any]] = []

        for airport in targets:
            try:
                results.append(capture_for_airport(config, airport, captured_at))
            except Exception as exc:
                failures.append({
                    "airport_id": airport.get("id"),
                    "airport_name": airport.get("name"),
                    "error": str(exc),
                })

        output: dict[str, Any] = {
            "captured_at": captured_at,
            "airport_count": len(airports),
            "target_count": len(targets),
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
        print(f"[capture_subscription_nodes] {exc}", file=sys.stderr)
        return 1


def capture_for_airport(config: Config, airport: dict[str, Any], captured_at: str) -> dict[str, Any]:
    airport_id = int(airport["id"])
    subscription_url = str(airport.get("subscription_url") or "").strip()
    if not subscription_url:
        raise RuntimeError("missing_subscription_url")

    subscription_format, parsed_nodes, unsupported_nodes = fetch_parsed_subscription(config, subscription_url)

    snapshot = post_subscription_node_snapshot(
        config,
        airport_id,
        {
            "airport_id": airport_id,
            "captured_at": captured_at,
            "source": config.source,
            "subscription_url": subscription_url,
            "subscription_format": subscription_format,
            "parsed_nodes_count": len(parsed_nodes) + len(unsupported_nodes),
            "supported_nodes_count": len(parsed_nodes),
            "nodes": [node_to_snapshot(node) for node in parsed_nodes],
            "unsupported_nodes": unsupported_nodes,
        },
    )

    return {
        "airport_id": airport_id,
        "snapshot_id": snapshot.get("snapshot_id"),
        "captured_at": captured_at,
        "subscription_format": subscription_format,
        "parsed_nodes_count": len(parsed_nodes) + len(unsupported_nodes),
        "supported_nodes_count": len(parsed_nodes),
        "unsupported_nodes_count": len(unsupported_nodes),
    }


def fetch_parsed_subscription(
    config: Config,
    subscription_url: str,
) -> tuple[str, list[ParsedNode], list[dict[str, str]]]:
    if subscription_url.lower().startswith(DIRECT_NODE_URI_SCHEMES):
        normalized_subscription, subscription_format = normalize_subscription_text(subscription_url)
        parsed_nodes, unsupported_nodes = parse_nodes(normalized_subscription, subscription_format)
        if parsed_nodes:
            return subscription_format, parsed_nodes, unsupported_nodes
        raise RuntimeError("subscription_fetch_or_parse_failed")

    for user_agent in (
        CLASH_META_SUBSCRIPTION_USER_AGENT,
        DEFAULT_SUBSCRIPTION_USER_AGENT,
    ):
        try:
            subscription_text = fetch_subscription(
                config,
                subscription_url,
                user_agent=user_agent,
            )
            normalized_subscription, subscription_format = normalize_subscription_text(subscription_text)
            if not normalized_subscription:
                continue
            parsed_nodes, unsupported_nodes = parse_nodes(normalized_subscription, subscription_format)
            if parsed_nodes:
                return subscription_format, parsed_nodes, unsupported_nodes
        except Exception:
            continue

    raise RuntimeError("subscription_fetch_or_parse_failed")


if __name__ == "__main__":
    raise SystemExit(main())
