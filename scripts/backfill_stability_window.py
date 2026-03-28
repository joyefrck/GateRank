#!/usr/bin/env python3
"""
Backfill aggregate + recompute for a recent date window.

Example:
  cd /Users/joyefrack/Documents/GitHub/GateRank && \
  ADMIN_API_KEY=... \
  /usr/bin/python3 scripts/backfill_stability_window.py --days 30
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_API_BASE = "http://127.0.0.1:8787"
SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")


@dataclass
class Config:
    api_base: str
    admin_api_key: str | None
    admin_bearer_token: str | None
    days: int
    end_date: str


def main() -> int:
    try:
        config = build_config()
        dates = build_dates(config.end_date, config.days)
        results: list[dict[str, object]] = []

        for date in dates:
            aggregate = post_admin_action(
                config,
                f"/api/v1/admin/jobs/aggregate?{urlencode({'date': date})}",
            )
            recompute = post_admin_action(
                config,
                f"/api/v1/admin/scores/recompute?{urlencode({'date': date})}",
            )
            results.append(
                {
                    "date": date,
                    "aggregate": aggregate,
                    "recompute": recompute,
                }
            )

        print(
            json.dumps(
                {
                    "window_days": config.days,
                    "end_date": config.end_date,
                    "dates": dates,
                    "results": results,
                },
                ensure_ascii=False,
            )
        )
        return 0
    except Exception as exc:  # pragma: no cover - script entrypoint
        print(f"[backfill_stability_window] {exc}", file=sys.stderr)
        return 1


def build_config() -> Config:
    parser = argparse.ArgumentParser(description="Backfill recent aggregate + recompute runs.")
    parser.add_argument("--api-base", default=os.getenv("API_BASE", DEFAULT_API_BASE))
    parser.add_argument("--admin-api-key", default=os.getenv("ADMIN_API_KEY"))
    parser.add_argument("--admin-bearer-token", default=os.getenv("ADMIN_BEARER_TOKEN"))
    parser.add_argument("--days", type=int, default=int(os.getenv("BACKFILL_DAYS", "30")))
    parser.add_argument("--end-date", default=os.getenv("END_DATE") or shanghai_today())
    args = parser.parse_args()

    if not args.admin_api_key and not args.admin_bearer_token:
        raise ValueError("ADMIN_API_KEY or ADMIN_BEARER_TOKEN is required")
    if args.days <= 0:
        raise ValueError("days must be positive")

    return Config(
        api_base=args.api_base.rstrip("/"),
        admin_api_key=args.admin_api_key,
        admin_bearer_token=args.admin_bearer_token,
        days=args.days,
        end_date=args.end_date,
    )


def build_dates(end_date: str, days: int) -> list[str]:
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    start = end - timedelta(days=days - 1)
    return [(start + timedelta(days=offset)).isoformat() for offset in range(days)]


def shanghai_today() -> str:
    return datetime.now(SHANGHAI_TZ).date().isoformat()


def post_admin_action(config: Config, path: str) -> dict[str, object]:
    url = f"{config.api_base}{path}"
    request = Request(url, method="POST")
    if config.admin_api_key:
        request.add_header("x-api-key", config.admin_api_key)
    if config.admin_bearer_token:
        request.add_header("Authorization", f"Bearer {config.admin_bearer_token}")
    request.add_header("Content-Type", "application/json")

    try:
        with urlopen(request, timeout=30) as response:
            payload = response.read().decode("utf-8")
    except HTTPError as exc:  # pragma: no cover - network wrapper
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{path} failed with HTTP {exc.code}: {body}") from exc
    except URLError as exc:  # pragma: no cover - network wrapper
        raise RuntimeError(f"{path} failed: {exc.reason}") from exc

    return json.loads(payload)


if __name__ == "__main__":
    raise SystemExit(main())
