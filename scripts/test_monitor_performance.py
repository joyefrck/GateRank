import base64
import json
import os
import sys
import unittest
from unittest.mock import patch

from scripts.monitor_performance import (
    Config,
    NodeAvailabilityResult,
    NodeProbeResult,
    build_config,
    build_run_payload,
    check_nodes_availability,
    collect_airport_results,
    list_airports,
    nodes_from_snapshot,
    normalize_subscription_text,
    parse_node_line,
    run_for_airport,
    select_nodes,
)


class PickLastRandom:
    def choice(self, values):
        return values[-1]

    def shuffle(self, values):
        values.reverse()


class MonitorPerformanceTests(unittest.TestCase):
    def make_config(self) -> Config:
        return Config(
            api_base="http://127.0.0.1:8787",
            admin_api_key="test-key",
            admin_bearer_token=None,
            all_airports=False,
            airport_id=1,
            airport_keyword=None,
            airport_status=None,
            http_timeout=1,
            proxy_port=7890,
            proxy_startup_timeout=1,
            latency_attempts=1,
            latency_sample_interval_seconds=0,
            speed_timeout=1,
            speed_connections=1,
            performance_concurrency=4,
            page_size=100,
            source="test-performance",
            test_url_latency="https://www.google.com/generate_204",
            test_url_speed="https://speed.cloudflare.com/__down?bytes=1000",
            sing_box_bin="sing-box",
            trigger_aggregate=False,
            trigger_recompute=False,
        )

    def test_normalize_subscription_text_supports_base64(self) -> None:
        plain = "trojan://pass@example.com:443?type=ws&host=cdn.example.com&path=%2Fws#HK-1"
        encoded = base64.b64encode(plain.encode("utf-8")).decode("utf-8")
        normalized, subscription_format = normalize_subscription_text(encoded)
        self.assertEqual(subscription_format, "base64")
        self.assertEqual(normalized, plain)

    def test_parse_vmess_node_builds_transport_and_tls(self) -> None:
        payload = {
            "ps": "HK vmess",
            "add": "vmess.example.com",
            "port": "443",
            "id": "11111111-1111-1111-1111-111111111111",
            "aid": "0",
            "scy": "auto",
            "net": "ws",
            "path": "/ws",
            "host": "cdn.example.com",
            "tls": "tls",
            "sni": "edge.example.com",
        }
        uri = "vmess://" + base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
        node = parse_node_line(uri)
        assert node is not None
        self.assertEqual(node.region, "HK")
        self.assertEqual(node.outbound["transport"]["type"], "ws")
        self.assertEqual(node.outbound["transport"]["headers"]["Host"], "cdn.example.com")
        self.assertEqual(node.outbound["tls"]["server_name"], "edge.example.com")

    def test_parse_vless_reality_node(self) -> None:
        uri = (
            "vless://11111111-1111-1111-1111-111111111111@example.com:443"
            "?security=reality&sni=cdn.example.com&pbk=pubkey123&sid=abcd&type=grpc&serviceName=mygrpc#JP"
        )
        node = parse_node_line(uri)
        assert node is not None
        self.assertEqual(node.region, "JP")
        self.assertEqual(node.outbound["transport"]["type"], "grpc")
        self.assertEqual(node.outbound["tls"]["reality"]["public_key"], "pubkey123")

    def test_parse_shadowsocks_and_trojan_nodes(self) -> None:
        ss_creds = base64.b64encode(b"aes-256-gcm:secret").decode("utf-8").rstrip("=")
        ss_uri = f"ss://{ss_creds}@1.2.3.4:8388#SG"
        trojan_uri = "trojan://password@example.com:443?type=ws&host=cdn.example.com&path=%2Fws#US"

        ss_node = parse_node_line(ss_uri)
        trojan_node = parse_node_line(trojan_uri)
        assert ss_node is not None
        assert trojan_node is not None

        self.assertEqual(ss_node.region, "SG")
        self.assertEqual(ss_node.outbound["method"], "aes-256-gcm")
        self.assertEqual(trojan_node.region, "US")
        self.assertEqual(trojan_node.outbound["transport"]["type"], "ws")

    def test_parse_london_and_seoul_nodes_detects_display_regions(self) -> None:
        london_node = parse_node_line("trojan://password@london.example.com:443#London-1")
        seoul_node = parse_node_line("trojan://password@seoul.example.com:443#Seoul-1")
        fukuoka_node = parse_node_line("trojan://password@fukuoka.example.com:443#Fukuoka-1")
        assert london_node is not None
        assert seoul_node is not None
        assert fukuoka_node is not None

        self.assertEqual(london_node.region, "UK")
        self.assertEqual(seoul_node.region, "KR")
        self.assertIsNone(fukuoka_node.region)

    def test_parse_anytls_node_builds_tls_outbound(self) -> None:
        uri = "anytls://letmein@example.com/?sni=real.example.com&insecure=1#HK-anytls"
        node = parse_node_line(uri)
        assert node is not None

        self.assertEqual(node.node_type, "anytls")
        self.assertEqual(node.region, "HK")
        self.assertEqual(node.outbound["type"], "anytls")
        self.assertEqual(node.outbound["server"], "example.com")
        self.assertEqual(node.outbound["server_port"], 443)
        self.assertEqual(node.outbound["password"], "letmein")
        self.assertEqual(node.outbound["tls"]["enabled"], True)
        self.assertEqual(node.outbound["tls"]["server_name"], "real.example.com")
        self.assertEqual(node.outbound["tls"]["insecure"], True)

    def test_select_nodes_randomly_picks_one_node_per_detected_region(self) -> None:
        uris = [
            "trojan://password@hk.example.com:443#HK-A",
            "trojan://password@hk2.example.com:443#HK-B",
            "trojan://password@sg.example.com:443#SG-A",
            "trojan://password@jp.example.com:443#JP-A",
            "trojan://password@jp2.example.com:443#JP-B",
            "trojan://password@us.example.com:443#硅谷-A",
        ]
        nodes = [parse_node_line(uri) for uri in uris]
        selected = select_nodes([node for node in nodes if node is not None], rng=PickLastRandom())
        self.assertEqual([node.name for node in selected], ["HK-B", "JP-B", "SG-A", "硅谷-A"])

    def test_select_nodes_groups_unknown_regions_as_other(self) -> None:
        uris = [
            "trojan://password@hk.example.com:443#HK-A",
            "trojan://password@de.example.com:443#DE-A",
            "trojan://password@nl.example.com:443#NL-A",
        ]
        nodes = [parse_node_line(uri) for uri in uris]
        selected = select_nodes([node for node in nodes if node is not None], rng=PickLastRandom())
        self.assertEqual([node.name for node in selected], ["HK-A", "NL-A"])

    def test_check_nodes_availability_reports_percentages_for_all_supported_nodes(self) -> None:
        uris = [
            f"trojan://password@node{index}.example.com:443#HK-{index}"
            for index in range(20)
        ]
        nodes = [node for node in (parse_node_line(uri) for uri in uris) if node is not None]

        def fake_probe(_config, node):
            index = int(node.name.rsplit("-", 1)[1])
            return NodeAvailabilityResult(node=node, available=index < 15)

        results = check_nodes_availability(None, nodes, probe_fn=fake_probe)
        available = sum(1 for item in results if item.available)
        unavailable = len(results) - available

        self.assertEqual(available, 15)
        self.assertEqual(unavailable, 5)
        self.assertEqual(round(available / len(results) * 100, 2), 75.0)
        self.assertEqual(round(unavailable / len(results) * 100, 2), 25.0)

    def test_build_config_defaults_to_six_latency_attempts_and_three_second_interval(self) -> None:
        env = {
            "ADMIN_API_KEY": "test-key",
            "AIRPORT_ID": "1",
        }
        with patch.dict(os.environ, env, clear=True), patch.object(sys, "argv", ["monitor_performance.py"]):
            config = build_config()

        self.assertEqual(config.latency_attempts, 6)
        self.assertEqual(config.latency_sample_interval_seconds, 3)
        self.assertEqual(config.performance_concurrency, 4)

    def test_build_config_rejects_non_ascii_admin_api_key(self) -> None:
        env = {
            "ADMIN_API_KEY": "山水云",
            "AIRPORT_ID": "1",
        }
        with patch.dict(os.environ, env, clear=True), patch.object(sys, "argv", ["monitor_performance.py"]):
            with self.assertRaisesRegex(
                ValueError,
                "ADMIN_API_KEY must be ASCII because it is sent as HTTP header x-api-key",
            ):
                build_config()

    def test_list_airports_filters_down_and_unlisted_airports(self) -> None:
        config = self.make_config()
        with patch("scripts.monitor_performance.get_json", return_value={
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

    def test_collect_airport_results_uses_distinct_proxy_ports_and_keeps_going_after_failure(self) -> None:
        config = self.make_config()
        config.performance_concurrency = 2
        airports = [
            {"id": 1, "name": "A"},
            {"id": 2, "name": "B"},
            {"id": 3, "name": "C"},
        ]
        ports: list[int] = []
        results: list[dict[str, object]] = []
        failures: list[dict[str, object]] = []

        def fake_run_for_airport(worker_config, airport, _sampled_at):
            ports.append(worker_config.proxy_port)
            if airport["id"] == 2:
                raise RuntimeError("subscription blocked")
            return {
                "payload": {"airport_id": airport["id"]},
                "summary": {"airport_id": airport["id"], "status": "success"},
            }

        with (
            patch("scripts.monitor_performance.run_for_airport", side_effect=fake_run_for_airport),
            patch("scripts.monitor_performance.post_performance_run", return_value={"run_id": 9}),
        ):
            submitted_any = collect_airport_results(config, airports, "2026-05-16T00:10:00+08:00", results, failures)

        self.assertEqual(submitted_any, True)
        self.assertEqual(sorted(ports), [7890, 7891, 7892])
        self.assertEqual(sorted(item["airport_id"] for item in results), [1, 3])
        self.assertEqual(failures, [{"airport_id": 2, "airport_name": "B", "error": "subscription blocked"}])

    def test_build_run_payload_preserves_latency_sample_timestamps(self) -> None:
        payload = build_run_payload(
            airport_id=1,
            sampled_at="2026-05-07T00:00:00+08:00",
            source="scheduler-performance",
            status="success",
            latency_samples_ms=[100, 120, 300],
            latency_sampled_at=[
                "2026-05-07T00:00:00+08:00",
                "2026-05-07T00:00:03+08:00",
                "2026-05-07T00:00:06+08:00",
            ],
        )
        self.assertEqual(payload["latency_samples_ms"], [100, 120, 300])
        self.assertEqual(
            payload["latency_sampled_at"],
            [
                "2026-05-07T00:00:00+08:00",
                "2026-05-07T00:00:03+08:00",
                "2026-05-07T00:00:06+08:00",
            ],
        )

    def test_run_for_airport_saves_snapshot_when_subscription_parses(self) -> None:
        config = self.make_config()
        airport = {"id": 1, "name": "Alpha", "subscription_url": "https://sub.example.com"}
        saved_snapshots = []

        def fake_probe_node(_config, node):
            return NodeProbeResult(
                node=node,
                latency_samples_ms=[100],
                latency_sampled_at=["2026-05-13T12:00:00+08:00"],
                proxy_latency_samples_ms=[180],
                download_mbps=50,
                failures=0,
                total_attempts=1,
            )

        with (
            patch("scripts.monitor_performance.fetch_subscription", return_value="trojan://secret@hk.example.com:443#HK-1"),
            patch("scripts.monitor_performance.post_subscription_node_snapshot", side_effect=lambda _config, _airport_id, payload: saved_snapshots.append(payload) or {"snapshot_id": 9}),
            patch("scripts.monitor_performance.check_nodes_availability", return_value=[
                NodeAvailabilityResult(parse_node_line("trojan://secret@hk.example.com:443#HK-1"), True),
            ]),
            patch("scripts.monitor_performance.probe_node", side_effect=fake_probe_node),
        ):
            result = run_for_airport(config, airport, "2026-05-13T12:00:00+08:00")

        payload = result["payload"]
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["diagnostics"]["node_source"], "fresh_subscription")
        self.assertEqual(payload["diagnostics"]["snapshot_id"], 9)
        self.assertEqual(saved_snapshots[0]["nodes"][0]["raw_uri"], "trojan://secret@hk.example.com:443#HK-1")
        self.assertEqual(saved_snapshots[0]["nodes"][0]["outbound"]["server"], "hk.example.com")

    def test_run_for_airport_uses_cached_snapshot_when_subscription_fetch_fails(self) -> None:
        config = self.make_config()
        airport = {"id": 1, "name": "Alpha", "subscription_url": "https://one-time.example.com/sub"}
        snapshot = {
            "id": 12,
            "captured_at": "2026-05-12T10:00:00+08:00",
            "subscription_url": "https://old.example.com/sub",
            "subscription_format": "plain",
            "nodes": [{
                "name": "SG-1",
                "region": "SG",
                "type": "trojan",
                "outbound": {"type": "trojan", "tag": "proxy", "server": "sg.example.com", "server_port": 443, "password": "secret"},
                "raw_uri": "trojan://secret@sg.example.com:443#SG-1",
            }],
        }

        def fake_probe_node(_config, node):
            return NodeProbeResult(
                node=node,
                latency_samples_ms=[90],
                latency_sampled_at=["2026-05-13T12:00:00+08:00"],
                proxy_latency_samples_ms=[120],
                download_mbps=60,
                failures=0,
                total_attempts=1,
            )

        with (
            patch("scripts.monitor_performance.fetch_subscription", side_effect=RuntimeError("already used")),
            patch("scripts.monitor_performance.get_latest_subscription_node_snapshot", return_value=snapshot),
            patch("scripts.monitor_performance.check_nodes_availability", return_value=[
                NodeAvailabilityResult(nodes_from_snapshot(snapshot)[0][0], True),
            ]),
            patch("scripts.monitor_performance.probe_node", side_effect=fake_probe_node),
        ):
            result = run_for_airport(config, airport, "2026-05-13T12:00:00+08:00")

        payload = result["payload"]
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["selected_nodes"][0]["name"], "SG-1")
        self.assertEqual(payload["diagnostics"]["node_source"], "cached_snapshot")
        self.assertEqual(payload["diagnostics"]["cache_snapshot_id"], 12)
        self.assertEqual(payload["diagnostics"]["subscription_refresh_error_code"], "subscription_fetch_failed")

    def test_run_for_airport_uses_cached_snapshot_when_subscription_format_is_unsupported(self) -> None:
        config = self.make_config()
        airport = {"id": 1, "name": "Alpha", "subscription_url": "https://sub.example.com"}
        snapshot = {
            "id": 13,
            "captured_at": "2026-05-12T10:00:00+08:00",
            "subscription_url": "https://sub.example.com",
            "subscription_format": "plain",
            "nodes": [{
                "name": "JP-1",
                "region": "JP",
                "type": "trojan",
                "outbound": {"type": "trojan", "tag": "proxy", "server": "jp.example.com", "server_port": 443, "password": "secret"},
                "raw_uri": "trojan://secret@jp.example.com:443#JP-1",
            }],
        }

        with (
            patch("scripts.monitor_performance.fetch_subscription", return_value="proxies:\n  - name: JP"),
            patch("scripts.monitor_performance.get_latest_subscription_node_snapshot", return_value=snapshot),
            patch("scripts.monitor_performance.check_nodes_availability", return_value=[
                NodeAvailabilityResult(nodes_from_snapshot(snapshot)[0][0], True),
            ]),
            patch("scripts.monitor_performance.probe_node", return_value=NodeProbeResult(
                node=nodes_from_snapshot(snapshot)[0][0],
                latency_samples_ms=[88],
                latency_sampled_at=["2026-05-13T12:00:00+08:00"],
                proxy_latency_samples_ms=[],
                download_mbps=None,
                failures=0,
                total_attempts=1,
            )),
        ):
            result = run_for_airport(config, airport, "2026-05-13T12:00:00+08:00")

        self.assertEqual(result["payload"]["status"], "success")
        self.assertEqual(result["payload"]["diagnostics"]["node_source"], "cached_snapshot")
        self.assertEqual(result["payload"]["diagnostics"]["subscription_refresh_error_code"], "unsupported_subscription_format")

    def test_run_for_airport_keeps_original_failure_when_no_cached_snapshot_exists(self) -> None:
        config = self.make_config()
        airport = {"id": 1, "name": "Alpha", "subscription_url": "https://one-time.example.com/sub"}
        with (
            patch("scripts.monitor_performance.fetch_subscription", side_effect=RuntimeError("already used")),
            patch("scripts.monitor_performance.get_latest_subscription_node_snapshot", side_effect=RuntimeError("404 not found")),
        ):
            result = run_for_airport(config, airport, "2026-05-13T12:00:00+08:00")

        self.assertEqual(result["payload"]["status"], "failed")
        self.assertEqual(result["payload"]["error_code"], "subscription_fetch_failed")
        self.assertEqual(result["payload"]["diagnostics"]["node_source"], "none")

    def test_nodes_from_snapshot_skips_cached_nodes_without_server_or_port(self) -> None:
        nodes, invalid_nodes = nodes_from_snapshot({
            "nodes": [
                {
                    "name": "Broken",
                    "region": "HK",
                    "type": "trojan",
                    "outbound": {"type": "trojan", "server": "hk.example.com"},
                    "raw_uri": "trojan://secret@hk.example.com:443#Broken",
                },
                {
                    "name": "Valid",
                    "region": "HK",
                    "type": "trojan",
                    "outbound": {"type": "trojan", "server": "valid.example.com", "server_port": 443},
                    "raw_uri": "trojan://secret@valid.example.com:443#Valid",
                },
            ],
        })

        self.assertEqual([node.name for node in nodes], ["Valid"])
        self.assertEqual(invalid_nodes[0]["name"], "Broken")
        self.assertEqual(invalid_nodes[0]["reason"], "cached_node_missing_server")


if __name__ == "__main__":
    unittest.main()
