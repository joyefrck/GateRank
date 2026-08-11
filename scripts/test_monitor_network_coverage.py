import unittest
from unittest.mock import patch

from scripts.monitor_network_coverage import (
    build_failure_payload,
    collect_airport,
    error_summary,
    sanitize_node_error,
    sanitize_node_name,
    resolve_network_coverage_nodes,
)
from scripts.monitor_performance import Config, NodeAvailabilityResult, NodeSourceResult, ParsedNode


class NetworkCoverageCollectorTests(unittest.TestCase):
    def make_config(self) -> Config:
        return Config(
            api_base="http://127.0.0.1:8787",
            admin_api_key="test-key",
            admin_bearer_token=None,
            all_airports=False,
            airport_id=1,
            airport_keyword=None,
            airport_status=None,
            http_timeout=2,
            proxy_port=7890,
            proxy_startup_timeout=2,
            latency_attempts=1,
            latency_sample_interval_seconds=0,
            speed_timeout=1,
            speed_connections=1,
            performance_concurrency=1,
            page_size=100,
            source="manual-network-coverage",
            test_url_latency="https://example.com/204",
            test_url_speed="https://example.com/down",
            sing_box_bin="sing-box",
            trigger_aggregate=False,
            trigger_recompute=False,
        )

    def test_collect_airport_posts_only_sanitized_node_identity_and_health(self) -> None:
        config = self.make_config()
        nodes = [
            ParsedNode("HK-01", "vless", "HK", {"uuid": "secret", "server": "a", "server_port": 443}, "vless://secret"),
            ParsedNode("JP-01", "trojan", "JP", {"password": "secret", "server": "b", "server_port": 443}, "trojan://secret"),
        ]
        source = NodeSourceResult(nodes, [{"uri": "secret", "reason": "unsupported"}], "plain", "fresh", {})
        probes = [
            NodeAvailabilityResult(nodes[0], True, check="proxy_http", tcp_reachable=True),
            NodeAvailabilityResult(nodes[1], False, "request timed out at secret.example", "proxy_http", True),
        ]
        posted = []
        with patch("scripts.monitor_network_coverage.resolve_network_coverage_nodes", return_value=source), \
             patch("scripts.monitor_network_coverage.probe_node_proxy_http_availability", side_effect=probes), \
             patch("scripts.monitor_network_coverage.post_coverage_run", side_effect=lambda _c, _id, payload: posted.append(payload) or {"run_id": 9, "status": "success", "score_n": 55}):
            summary = collect_airport(config, {"id": 1, "subscription_url": "https://secret.example/sub"}, "2026-08-11T01:00:00+08:00")

        self.assertEqual(summary["healthy_nodes_count"], 1)
        self.assertEqual(summary["unsupported_nodes_count"], 1)
        self.assertEqual(posted[0]["nodes"][1]["error_code"], "proxy_http_timeout")
        serialized = str(posted[0])
        self.assertNotIn("raw_uri", serialized)
        self.assertNotIn("password", serialized)
        self.assertNotIn("uuid", serialized)
        self.assertNotIn("secret.example", serialized)

    def test_all_unhealthy_nodes_are_still_a_complete_success(self) -> None:
        config = self.make_config()
        node = ParsedNode("US-01", "vless", "US", {"server": "a", "server_port": 443}, "vless://redacted")
        source = NodeSourceResult([node], [], "plain", "fresh", {})
        probe = NodeAvailabilityResult(node, False, "timeout", "proxy_http", True)
        posted = []
        with patch("scripts.monitor_network_coverage.resolve_network_coverage_nodes", return_value=source), \
             patch("scripts.monitor_network_coverage.probe_node_proxy_http_availability", return_value=probe), \
             patch("scripts.monitor_network_coverage.post_coverage_run", side_effect=lambda _c, _id, payload: posted.append(payload) or {"run_id": 10, "status": "success", "score_n": 0}):
            collect_airport(config, {"id": 1, "subscription_url": "https://example.invalid/sub"}, "2026-08-11T01:00:00+08:00")
        self.assertEqual(posted[0]["status"], "success")
        self.assertFalse(posted[0]["nodes"][0]["healthy"])

    def test_unsupported_only_snapshot_is_a_valid_zero_detected_run(self) -> None:
        config = self.make_config()
        snapshot = {
            "id": 4,
            "subscription_url": "https://example.invalid/sub",
            "subscription_format": "plain",
            "nodes": [],
            "unsupported_nodes": [{"type": "hysteria1", "reason": "unsupported"}],
        }
        posted = []
        with patch("scripts.monitor_network_coverage.get_latest_subscription_node_snapshot", return_value=snapshot), \
             patch("scripts.monitor_network_coverage.post_coverage_run", side_effect=lambda _c, _id, payload: posted.append(payload) or {"run_id": 11, "status": "success", "score_n": 0}):
            summary = collect_airport(config, {"id": 1, "subscription_url": snapshot["subscription_url"]}, "2026-08-11T01:00:00+08:00")
        self.assertEqual(summary["detected_nodes_count"], 0)
        self.assertEqual(summary["unsupported_nodes_count"], 1)
        self.assertEqual(posted[0]["status"], "success")

    def test_snapshot_url_mismatch_fails_without_exposing_urls(self) -> None:
        config = self.make_config()
        with patch("scripts.monitor_network_coverage.get_latest_subscription_node_snapshot", return_value={
            "subscription_url": "https://secret.example/token",
            "nodes": [],
            "unsupported_nodes": [],
        }):
            with self.assertRaisesRegex(RuntimeError, "stale_subscription_node_snapshot") as raised:
                resolve_network_coverage_nodes(config, 1, "https://current.example/sub")
        self.assertNotIn("secret.example", str(raised.exception))

    def test_failure_payload_never_contains_subscription_data(self) -> None:
        payload = build_failure_payload(1, "2026-08-11T01:00:00+08:00", "scheduler-performance", "failed", "subscription_fetch_or_parse_failed", "network coverage collection failed")
        self.assertEqual(payload["source"], "scheduler-network-coverage")
        self.assertEqual(payload["nodes"], [])
        self.assertNotIn("subscription_url", payload)

    def test_error_summary_groups_sanitized_codes(self) -> None:
        self.assertEqual(error_summary([
            {"healthy": False, "error_code": "timeout"},
            {"healthy": False, "error_code": "timeout"},
            {"healthy": True, "error_code": None},
        ]), [{"error_code": "timeout", "count": 2}])
        self.assertEqual(sanitize_node_error("tcp_unreachable:1.2.3.4"), "tcp_unreachable")
        self.assertEqual(sanitize_node_name("vless://secret@example.com"), "[redacted-node-name]")
        self.assertNotIn("550e8400-e29b-41d4-a716-446655440000", sanitize_node_name("JP 550e8400-e29b-41d4-a716-446655440000"))


if __name__ == "__main__":
    unittest.main()
