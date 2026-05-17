import os
import sys
import unittest
from unittest.mock import patch

from scripts.monitor_stability import build_config, collect_latency_samples, list_airports


class MonitorStabilityTests(unittest.TestCase):
    def test_build_config_defaults_to_six_latency_samples_and_three_second_interval(self) -> None:
        env = {
            "ADMIN_API_KEY": "test-key",
            "AIRPORT_ID": "1",
        }
        with patch.dict(os.environ, env, clear=True), patch.object(sys, "argv", ["monitor_stability.py"]):
            config = build_config()

        self.assertEqual(config.latency_sample_count, 6)
        self.assertEqual(config.latency_sample_interval_seconds, 3)

    def test_build_config_rejects_non_ascii_admin_api_key(self) -> None:
        env = {
            "ADMIN_API_KEY": "山水云",
            "AIRPORT_ID": "1",
        }
        with patch.dict(os.environ, env, clear=True), patch.object(sys, "argv", ["monitor_stability.py"]):
            with self.assertRaisesRegex(
                ValueError,
                "ADMIN_API_KEY must be ASCII because it is sent as HTTP header x-api-key",
            ):
                build_config()

    def test_collect_latency_samples_returns_timestamped_samples_with_configured_gaps(self) -> None:
        latencies = iter([10.0, 11.0, 12.0, 13.0, 14.0, 15.0])
        timestamps = iter(
            [
                "2026-05-07T00:00:00+08:00",
                "2026-05-07T00:00:03+08:00",
                "2026-05-07T00:00:06+08:00",
                "2026-05-07T00:00:09+08:00",
                "2026-05-07T00:00:12+08:00",
                "2026-05-07T00:00:15+08:00",
            ],
        )
        sleeps: list[float] = []

        samples = collect_latency_samples(
            "example.com",
            443,
            6,
            5,
            3,
            latency_fn=lambda _host, _port, _timeout: next(latencies),
            sleep_fn=sleeps.append,
            now_fn=lambda: next(timestamps),
        )

        self.assertEqual([sample["latency_ms"] for sample in samples], [10.0, 11.0, 12.0, 13.0, 14.0, 15.0])
        self.assertEqual(
            [sample["sampled_at"] for sample in samples],
            [
                "2026-05-07T00:00:00+08:00",
                "2026-05-07T00:00:03+08:00",
                "2026-05-07T00:00:06+08:00",
                "2026-05-07T00:00:09+08:00",
                "2026-05-07T00:00:12+08:00",
                "2026-05-07T00:00:15+08:00",
            ],
        )
        self.assertEqual(sleeps, [3, 3, 3, 3, 3])

    def test_list_airports_filters_down_and_unlisted_airports(self) -> None:
        config = build_test_config()
        with patch("scripts.monitor_stability.get_json", return_value={
            "total": 4,
            "items": [
                {"id": 1, "name": "Listed", "status": "normal", "is_listed": True},
                {"id": 2, "name": "Unlisted", "status": "normal", "is_listed": False},
                {"id": 3, "name": "Down", "status": "down", "is_listed": True},
                {"id": 4, "name": "Legacy", "status": "risk"},
            ],
        }):
            airports = list_airports(config, None)

        self.assertEqual([airport["id"] for airport in airports], [1, 4])


def build_test_config():
    env = {
        "ADMIN_API_KEY": "test-key",
        "AIRPORT_ID": "1",
    }
    with patch.dict(os.environ, env, clear=True), patch.object(sys, "argv", ["monitor_stability.py"]):
        return build_config()


if __name__ == "__main__":
    unittest.main()
