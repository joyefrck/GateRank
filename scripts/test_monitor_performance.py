import base64
import json
import os
import ssl
import subprocess
import sys
import unittest
from unittest.mock import MagicMock, call, patch

from scripts.monitor_performance import (
    Config,
    NodeAvailabilityResult,
    NodeProbeResult,
    SpeedTargetResult,
    build_config,
    build_run_payload,
    check_nodes_availability,
    collect_airport_results,
    fetch_subscription,
    filter_legacy_enabled_airports,
    list_airports,
    nodes_from_snapshot,
    normalize_subscription_text,
    parse_node_line,
    parse_nodes,
    performance_node_key,
    probe_node_proxy_http_availability,
    probe_node,
    resolve_selected_nodes,
    run_for_airport,
    select_nodes,
    target_download_median,
    test_proxy_real_latency,
    test_speed_targets,
)


class PickLastRandom:
    def choice(self, values):
        return values[-1]

    def shuffle(self, values):
        values.reverse()


def node_to_test_snapshot(node):
    return {
        "name": node.name,
        "region": node.region,
        "type": node.node_type,
        "outbound": node.outbound,
        "raw_uri": node.raw_uri,
    }


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

    def test_normalize_subscription_text_keeps_clash_yaml_for_parsing(self) -> None:
        clash_yaml = "mixed-port: 7890\nproxies:\n  - name: HK Reality\n    type: vless\n"
        normalized, subscription_format = normalize_subscription_text(clash_yaml)

        self.assertEqual(subscription_format, "clash_yaml")
        self.assertEqual(normalized, clash_yaml.strip())

    def test_fetch_subscription_uses_explicit_user_agent(self) -> None:
        config = self.make_config()
        response = MagicMock()
        response.__enter__.return_value = response
        response.headers.get_content_charset.return_value = "utf-8"
        response.read.return_value = b"trojan://secret@example.com:443#HK-1"

        with patch("scripts.monitor_performance.urlopen", return_value=response) as urlopen_mock:
            subscription = fetch_subscription(
                config,
                "https://sub.example.com/token",
                user_agent="ClashMeta/1.19.8",
            )

        request = urlopen_mock.call_args.args[0]
        self.assertEqual(request.get_header("User-agent"), "ClashMeta/1.19.8")
        self.assertEqual(subscription, "trojan://secret@example.com:443#HK-1")

    def test_parse_clash_vless_reality_node_builds_sing_box_outbound(self) -> None:
        clash_yaml = """
mixed-port: 7890
proxies:
  - name: JP Reality
    type: vless
    server: jp.example.com
    port: 443
    uuid: 11111111-1111-1111-1111-111111111111
    encryption: none
    udp: true
    tls: true
    flow: xtls-rprx-vision
    client-fingerprint: chrome
    servername: cdn.example.com
    skip-cert-verify: true
    reality-opts:
      public-key: pubkey123
      short-id: abcd
"""
        nodes, unsupported_nodes = parse_nodes(clash_yaml, "clash_yaml")

        self.assertEqual(unsupported_nodes, [])
        self.assertEqual(len(nodes), 1)
        node = nodes[0]
        self.assertEqual(node.name, "JP Reality")
        self.assertEqual(node.region, "JP")
        self.assertEqual(node.node_type, "vless")
        self.assertEqual(node.raw_uri, "clash://vless/JP Reality")
        self.assertEqual(node.outbound["type"], "vless")
        self.assertEqual(node.outbound["server"], "jp.example.com")
        self.assertEqual(node.outbound["server_port"], 443)
        self.assertEqual(node.outbound["uuid"], "11111111-1111-1111-1111-111111111111")
        self.assertEqual(node.outbound["flow"], "xtls-rprx-vision")
        self.assertEqual(node.outbound["tls"]["server_name"], "cdn.example.com")
        self.assertEqual(node.outbound["tls"]["insecure"], True)
        self.assertEqual(node.outbound["tls"]["utls"], {"enabled": True, "fingerprint": "chrome"})
        self.assertEqual(node.outbound["tls"]["reality"]["public_key"], "pubkey123")
        self.assertEqual(node.outbound["tls"]["reality"]["short_id"], "abcd")

    def test_parse_clash_yaml_keeps_supported_nodes_when_some_types_are_unsupported(self) -> None:
        clash_yaml = """
proxies:
  - name: HK SS
    type: ss
    server: hk.example.com
    port: 8388
    cipher: aes-256-gcm
    password: secret
  - name: unsupported-node
    type: hysteria2
    server: h2.example.com
    port: 443
    password: secret
"""
        nodes, unsupported_nodes = parse_nodes(clash_yaml, "clash_yaml")

        self.assertEqual([node.name for node in nodes], ["HK SS"])
        self.assertEqual(nodes[0].outbound["type"], "shadowsocks")
        self.assertEqual(len(unsupported_nodes), 1)
        self.assertEqual(unsupported_nodes[0]["uri"], "clash://hysteria2/unsupported-node")
        self.assertEqual(unsupported_nodes[0]["reason"], "unsupported_clash_proxy_type_hysteria2")

    def test_parse_clash_yaml_common_proxy_types(self) -> None:
        clash_yaml = """
proxies:
  - name: HK VMess
    type: vmess
    server: vmess.example.com
    port: 443
    uuid: 11111111-1111-1111-1111-111111111111
    cipher: auto
    alterId: 0
    tls: true
    servername: edge.example.com
    network: ws
    ws-opts:
      path: /ws
      headers:
        Host: cdn.example.com
  - name: US Trojan
    type: trojan
    server: trojan.example.com
    port: 443
    password: secret
    network: grpc
    grpc-opts:
      grpc-service-name: grpc-service
  - name: SG AnyTLS
    type: anytls
    server: anytls.example.com
    port: 443
    password: secret
    sni: real.example.com
"""
        nodes, unsupported_nodes = parse_nodes(clash_yaml, "clash_yaml")

        self.assertEqual(unsupported_nodes, [])
        self.assertEqual([node.node_type for node in nodes], ["vmess", "trojan", "anytls"])
        self.assertEqual(nodes[0].outbound["transport"]["type"], "ws")
        self.assertEqual(nodes[0].outbound["transport"]["path"], "/ws")
        self.assertEqual(nodes[0].outbound["transport"]["headers"]["Host"], "cdn.example.com")
        self.assertEqual(nodes[0].outbound["tls"]["server_name"], "edge.example.com")
        self.assertEqual(nodes[1].outbound["transport"]["type"], "grpc")
        self.assertEqual(nodes[1].outbound["transport"]["service_name"], "grpc-service")
        self.assertEqual(nodes[2].outbound["type"], "anytls")
        self.assertEqual(nodes[2].outbound["tls"]["server_name"], "real.example.com")

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

    def test_select_nodes_skips_other_when_detected_regions_exist(self) -> None:
        uris = [
            "trojan://password@hk.example.com:443#HK-A",
            "trojan://password@de.example.com:443#DE-A",
            "trojan://password@nl.example.com:443#NL-A",
        ]
        nodes = [parse_node_line(uri) for uri in uris]
        selected = select_nodes([node for node in nodes if node is not None], rng=PickLastRandom())
        self.assertEqual([node.name for node in selected], ["HK-A"])

    def test_select_nodes_skips_informational_and_other_nodes_by_default(self) -> None:
        traffic_node = parse_node_line("trojan://password@info.example.com:443#剩余流量：1008.61 GB")
        assert traffic_node is not None
        self.assertIsNone(traffic_node.region)

        nodes = [
            node for node in [
                traffic_node,
                parse_node_line("trojan://password@hk.example.com:443#香港IEPL专线 01"),
                parse_node_line("trojan://password@nl.example.com:443#荷兰BGP多线 01"),
            ]
            if node is not None
        ]

        selected = select_nodes(nodes, rng=PickLastRandom())

        self.assertEqual([node.name for node in selected], ["香港IEPL专线 01"])

    def test_resolve_selected_nodes_keeps_default_region_selection_without_preferences(self) -> None:
        nodes = [
            node for node in [
                parse_node_line("trojan://password@hk.example.com:443#HK-A"),
                parse_node_line("trojan://password@jp.example.com:443#JP-A"),
            ]
            if node is not None
        ]
        availability = [NodeAvailabilityResult(node=node, available=True) for node in nodes]

        result = resolve_selected_nodes(nodes, {"mode": "default", "selected_keys": []}, availability)

        self.assertEqual(result.mode, "default")
        self.assertEqual([node.name for node in result.selected_nodes], ["HK-A", "JP-A"])

    def test_resolve_selected_nodes_uses_only_available_configured_nodes(self) -> None:
        nodes = [
            node for node in [
                parse_node_line("trojan://password@hk.example.com:443#HK-A"),
                parse_node_line("trojan://password@jp.example.com:443#JP-A"),
            ]
            if node is not None
        ]
        hk_key = performance_node_key(nodes[0])
        jp_key = performance_node_key(nodes[1])
        availability = [
            NodeAvailabilityResult(node=nodes[0], available=False, error_code="connection refused"),
            NodeAvailabilityResult(node=nodes[1], available=True),
        ]

        result = resolve_selected_nodes(nodes, {"mode": "specified", "selected_keys": [hk_key, jp_key, "missing"]}, availability)

        self.assertEqual(result.mode, "specified")
        self.assertEqual(result.configured_node_count, 3)
        self.assertEqual([node.name for node in result.selected_nodes], ["JP-A"])
        self.assertEqual(result.skipped_configured_nodes[0]["reason"], "configured_node_unavailable")
        self.assertEqual(result.skipped_configured_nodes[1]["reason"], "configured_node_not_found")

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

    def test_check_nodes_availability_uses_proxy_http_mode_when_configured(self) -> None:
        config = self.make_config()
        config.node_availability_check = "proxy_http"
        node = parse_node_line("trojan://password@hk.example.com:443#HK-A")
        assert node is not None

        with patch("scripts.monitor_performance.probe_node_proxy_http_availability") as proxy_probe:
            proxy_probe.return_value = NodeAvailabilityResult(
                node=node,
                available=True,
                error_code=None,
                check="proxy_http",
                tcp_reachable=True,
            )
            results = check_nodes_availability(config, [node])

        self.assertEqual(results[0].available, True)
        self.assertEqual(results[0].check, "proxy_http")
        self.assertEqual(results[0].tcp_reachable, True)
        proxy_probe.assert_called_once_with(config, node)

    def test_proxy_http_availability_returns_after_primary_target_succeeds(self) -> None:
        config = self.make_config()
        node = parse_node_line("trojan://password@hk.example.com:443#HK-A")
        assert node is not None

        with (
            patch("scripts.monitor_performance.probe_node_availability", return_value=NodeAvailabilityResult(
                node=node, available=True, check="tcp", tcp_reachable=True,
            )),
            patch("scripts.monitor_performance.run_sing_box", return_value=(MagicMock(), "/tmp/test.json")),
            patch("scripts.monitor_performance.stop_sing_box"),
            patch("scripts.monitor_performance.test_proxy_http_once") as request_once,
        ):
            result = probe_node_proxy_http_availability(config, node)

        self.assertTrue(result.available)
        request_once.assert_called_once_with(config, config.test_url_latency)

    def test_proxy_http_availability_recovers_from_tls_eof_with_fallback_target(self) -> None:
        config = self.make_config()
        node = parse_node_line("trojan://password@jp.example.com:443#JP-A")
        assert node is not None
        tls_eof = ssl.SSLEOFError(8, "UNEXPECTED_EOF_WHILE_READING")

        with (
            patch("scripts.monitor_performance.probe_node_availability", return_value=NodeAvailabilityResult(
                node=node, available=True, check="tcp", tcp_reachable=True,
            )),
            patch("scripts.monitor_performance.run_sing_box", return_value=(MagicMock(), "/tmp/test.json")),
            patch("scripts.monitor_performance.stop_sing_box"),
            patch("scripts.monitor_performance.time.sleep"),
            patch("scripts.monitor_performance.test_proxy_http_once", side_effect=[tls_eof, tls_eof, None]) as request_once,
        ):
            result = probe_node_proxy_http_availability(config, node)

        self.assertTrue(result.available)
        self.assertEqual(request_once.call_args_list, [
            call(config, config.test_url_latency),
            call(config, config.test_url_latency),
            call(config, "https://cp.cloudflare.com/generate_204"),
        ])

    def test_proxy_http_availability_reports_ssl_eof_after_all_targets_fail(self) -> None:
        config = self.make_config()
        node = parse_node_line("trojan://password@sg.example.com:443#SG-A")
        assert node is not None
        tls_eof = ssl.SSLEOFError(8, "UNEXPECTED_EOF_WHILE_READING")

        with (
            patch("scripts.monitor_performance.probe_node_availability", return_value=NodeAvailabilityResult(
                node=node, available=True, check="tcp", tcp_reachable=True,
            )),
            patch("scripts.monitor_performance.run_sing_box", return_value=(MagicMock(), "/tmp/test.json")),
            patch("scripts.monitor_performance.stop_sing_box"),
            patch("scripts.monitor_performance.time.sleep"),
            patch("scripts.monitor_performance.test_proxy_http_once", side_effect=tls_eof) as request_once,
        ):
            result = probe_node_proxy_http_availability(config, node)

        self.assertFalse(result.available)
        self.assertEqual(result.error_code, "proxy_ssl_eof")
        self.assertEqual(request_once.call_count, 6)

    def test_build_config_defaults_to_three_latency_attempts_and_three_second_interval(self) -> None:
        env = {
            "ADMIN_API_KEY": "test-key",
            "AIRPORT_ID": "1",
        }
        with patch.dict(os.environ, env, clear=True), patch.object(sys, "argv", ["monitor_performance.py"]):
            config = build_config()

        self.assertEqual(config.latency_attempts, 3)
        self.assertEqual(config.latency_sample_interval_seconds, 3)
        self.assertEqual(config.request_loss_attempts, 10)
        self.assertEqual(config.request_loss_sample_interval_seconds, 0.5)
        self.assertEqual(config.performance_concurrency, 4)
        self.assertEqual(config.node_availability_check, "proxy_http")
        self.assertEqual(config.speed_timeout, 10)
        self.assertEqual(config.speed_connections, 2)

    def test_probe_node_uses_proxy_http_request_failures_for_packet_loss(self) -> None:
        config = self.make_config()
        node = parse_node_line("trojan://password@hk.example.com:443#HK-A")
        assert node is not None

        with (
            patch("scripts.monitor_performance.run_sing_box", return_value=(MagicMock(), "/tmp/test.json")),
            patch("scripts.monitor_performance.stop_sing_box"),
            patch(
                "scripts.monitor_performance.test_node_connect_latency",
                return_value=([21.0, 22.0, 23.0], ["t1", "t2", "t3"], 0, 3),
            ),
            patch(
                "scripts.monitor_performance.test_proxy_http_latency",
                return_value=([180.0] * 8, 2, 10),
            ),
            patch(
                "scripts.monitor_performance.test_proxy_real_latency",
                return_value=([180.0, 150.0], ["p1", "p2"], 0, 2),
            ),
            patch(
                "scripts.monitor_performance.test_speed_targets",
                return_value=[
                    SpeedTargetResult("cachefly-50mb", 70.0, True, None, 10_000_000, 1000),
                    SpeedTargetResult("cloudflare-50mb", 90.0, True, None, 12_000_000, 1000),
                ],
            ),
        ):
            result = probe_node(config, node)

        self.assertEqual(result.failures, 2)
        self.assertEqual(result.total_attempts, 10)
        self.assertEqual(result.connect_failures, 0)
        self.assertEqual(result.connect_total_attempts, 3)
        self.assertEqual(result.connect_latency_samples_ms, [21.0, 22.0, 23.0])
        self.assertEqual(result.latency_samples_ms, [150.0])
        self.assertEqual(result.latency_sampled_at, ["p2"])
        self.assertEqual(result.download_mbps, 80.0)

    def test_proxy_real_latency_uses_minimum_of_two_proxy_requests(self) -> None:
        config = self.make_config()
        response = MagicMock()
        response.__enter__.return_value = response
        opener = MagicMock()
        opener.open.return_value = response

        with (
            patch("scripts.monitor_performance.build_proxy_opener", return_value=opener),
            patch("scripts.monitor_performance.time.perf_counter", side_effect=[0.0, 0.12, 1.0, 1.07]),
            patch("scripts.monitor_performance.time.sleep"),
            patch("scripts.monitor_performance.shanghai_now_iso", side_effect=["t1", "t2"]),
        ):
            samples, sampled_at, failures, attempts = test_proxy_real_latency(config)

        self.assertEqual(samples, [120.0, 70.0])
        self.assertEqual(sampled_at, ["t1", "t2"])
        self.assertEqual(failures, 0)
        self.assertEqual(attempts, 2)
        self.assertEqual(min(samples), 70.0)

    def test_speed_targets_keep_raw_evidence_and_use_valid_median(self) -> None:
        config = self.make_config()
        targets = [
            {"target_key": "cachefly-50mb", "url": "https://cachefly.cachefly.net/50mb.test"},
            {"target_key": "cloudflare-50mb", "url": "https://speed.cloudflare.com/__down?bytes=50000000"},
        ]

        with patch(
            "scripts.monitor_performance.test_speed_detailed",
            side_effect=[(40.0, 5_000_000, 1.0), (100.0, 12_500_000, 1.0)],
        ):
            results = test_speed_targets(config, targets)

        self.assertEqual([row.target_key for row in results], ["cachefly-50mb", "cloudflare-50mb"])
        self.assertEqual(results[0].bytes_downloaded, 5_000_000)
        self.assertEqual(results[1].duration_ms, 1000.0)
        self.assertTrue(all(row.valid for row in results))
        self.assertEqual(target_download_median(results), 70.0)

    def test_build_config_accepts_tcp_node_availability_check(self) -> None:
        env = {
            "ADMIN_API_KEY": "test-key",
            "AIRPORT_ID": "1",
            "NODE_AVAILABILITY_CHECK": "tcp",
        }
        with patch.dict(os.environ, env, clear=True), patch.object(sys, "argv", ["monitor_performance.py"]):
            config = build_config()

        self.assertEqual(config.node_availability_check, "tcp")

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

    def test_filter_legacy_enabled_airports_obeys_each_airport_switch(self) -> None:
        config = self.make_config()
        airports = [
            {"id": 1, "name": "Center enabled"},
            {"id": 2, "name": "Center disabled"},
        ]

        def fake_get_json(_config, path):
            enabled = "/airports/1/" in path
            return {
                "settings": [
                    {
                        "probe_id": "legacy-control",
                        "test_enabled": enabled,
                        "include_in_result": enabled,
                    },
                ],
            }

        with patch("scripts.monitor_performance.get_json", side_effect=fake_get_json):
            enabled, skipped = filter_legacy_enabled_airports(
                config,
                airports,
                "2026-08-10",
            )

        self.assertEqual([airport["id"] for airport in enabled], [1])
        self.assertEqual(skipped, [{"airport_id": 2, "airport_name": "Center disabled"}])

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

    def test_run_for_airport_uses_matching_stored_snapshot_without_fetching_subscription(self) -> None:
        config = self.make_config()
        airport = {"id": 1, "name": "Alpha", "subscription_url": "https://sub.example.com"}
        snapshot = {
            "id": 12,
            "captured_at": "2026-05-12T10:00:00+08:00",
            "subscription_url": "https://sub.example.com",
            "subscription_format": "plain",
            "nodes": [{
                "name": "HK-1",
                "region": "HK",
                "type": "trojan",
                "outbound": {"type": "trojan", "tag": "proxy", "server": "hk.example.com", "server_port": 443, "password": "secret"},
                "raw_uri": "trojan://secret@hk.example.com:443#HK-1",
            }],
        }

        def fake_probe_node(_config, node):
            return NodeProbeResult(
                node=node,
                latency_samples_ms=[100],
                latency_sampled_at=["2026-05-13T12:00:00+08:00"],
                proxy_latency_samples_ms=[180],
                download_mbps=50,
                failures=0,
                total_attempts=1,
                connect_latency_samples_ms=[21, 22, 23],
                target_results=[
                    SpeedTargetResult("cachefly-50mb", 40.0, True, None, 5_000_000, 1000),
                    SpeedTargetResult("cloudflare-50mb", 60.0, True, None, 7_500_000, 1000),
                ],
            )

        with (
            patch("scripts.monitor_performance.fetch_subscription", side_effect=AssertionError("subscription should not be fetched during performance runs")),
            patch("scripts.monitor_performance.post_subscription_node_snapshot", side_effect=AssertionError("performance runs should not save fresh snapshots")),
            patch("scripts.monitor_performance.get_latest_subscription_node_snapshot", return_value=snapshot),
            patch("scripts.monitor_performance.check_nodes_availability", return_value=[
                NodeAvailabilityResult(nodes_from_snapshot(snapshot)[0][0], True),
            ]),
            patch("scripts.monitor_performance.get_performance_node_selection", return_value={"mode": "default", "selected_keys": []}),
            patch("scripts.monitor_performance.probe_node", side_effect=fake_probe_node),
        ):
            result = run_for_airport(config, airport, "2026-05-13T12:00:00+08:00")

        payload = result["payload"]
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["diagnostics"]["node_source"], "stored_snapshot")
        self.assertEqual(payload["diagnostics"]["cache_snapshot_id"], 12)
        self.assertEqual(payload["diagnostics"]["cache_subscription_url_matches_current"], True)
        self.assertEqual(payload["diagnostics"]["node_availability_check"], "proxy_http")
        self.assertEqual(payload["diagnostics"]["node_availability_error_summary"], [])
        self.assertEqual(payload["diagnostics"]["node_availability"][0]["check"], "tcp")
        self.assertEqual(payload["diagnostics"]["node_availability"][0]["tcp_reachable"], None)
        self.assertEqual(payload["probe_id"], "legacy-control")
        self.assertEqual(payload["test_profile"], "proxy_multi_target_v2")
        self.assertEqual(payload["calibration_status"], "not_required")
        self.assertEqual(payload["median_latency_ms"], 100.0)
        self.assertEqual(payload["target_results"][0]["node_key"], performance_node_key(nodes_from_snapshot(snapshot)[0][0]))
        self.assertEqual(
            [row["target_key"] for row in payload["target_results"]],
            ["cachefly-50mb", "cloudflare-50mb"],
        )

    def test_run_for_airport_records_tcp_node_availability_check_in_diagnostics(self) -> None:
        config = self.make_config()
        config.node_availability_check = "tcp"
        airport = {"id": 1, "name": "Alpha", "subscription_url": "https://sub.example.com"}
        snapshot = {
            "id": 12,
            "captured_at": "2026-05-12T10:00:00+08:00",
            "subscription_url": "https://sub.example.com",
            "subscription_format": "plain",
            "nodes": [{
                "name": "HK-1",
                "region": "HK",
                "type": "trojan",
                "outbound": {"type": "trojan", "tag": "proxy", "server": "hk.example.com", "server_port": 443, "password": "secret"},
                "raw_uri": "trojan://secret@hk.example.com:443#HK-1",
            }],
        }

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
            patch("scripts.monitor_performance.get_latest_subscription_node_snapshot", return_value=snapshot),
            patch("scripts.monitor_performance.check_nodes_availability", return_value=[
                NodeAvailabilityResult(nodes_from_snapshot(snapshot)[0][0], True, check="tcp", tcp_reachable=True),
            ]),
            patch("scripts.monitor_performance.get_performance_node_selection", return_value={"mode": "default", "selected_keys": []}),
            patch("scripts.monitor_performance.probe_node", side_effect=fake_probe_node),
        ):
            result = run_for_airport(config, airport, "2026-05-13T12:00:00+08:00")

        payload = result["payload"]
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["diagnostics"]["node_availability_check"], "tcp")
        self.assertEqual(payload["diagnostics"]["node_availability"][0]["check"], "tcp")
        self.assertEqual(payload["diagnostics"]["node_availability"][0]["tcp_reachable"], True)

    def test_run_for_airport_skips_when_no_stored_snapshot_exists(self) -> None:
        config = self.make_config()
        airport = {"id": 1, "name": "Alpha", "subscription_url": "https://one-time.example.com/sub"}

        with (
            patch("scripts.monitor_performance.fetch_subscription", side_effect=AssertionError("subscription should not be fetched during performance runs")),
            patch("scripts.monitor_performance.get_latest_subscription_node_snapshot", side_effect=RuntimeError("404 not found")),
            patch("scripts.monitor_performance.check_nodes_availability", side_effect=AssertionError("missing snapshot should not be tested")),
            patch("scripts.monitor_performance.probe_node", side_effect=AssertionError("missing snapshot should not be probed")),
        ):
            result = run_for_airport(config, airport, "2026-05-13T12:00:00+08:00")

        payload = result["payload"]
        self.assertEqual(payload["status"], "skipped")
        self.assertEqual(payload["error_code"], "missing_subscription_node_snapshot")
        self.assertEqual(payload["diagnostics"]["node_source"], "none")
        self.assertEqual(payload["selected_nodes"], [])
        self.assertEqual(payload["tested_nodes"], [])

    def test_run_for_airport_skips_stale_snapshot_subscription_url(self) -> None:
        config = self.make_config()
        airport = {"id": 1, "name": "Alpha", "subscription_url": "https://new.example.com/sub"}
        snapshot = {
            "id": 12,
            "captured_at": "2026-05-12T10:00:00+08:00",
            "subscription_url": "https://old.example.com/sub",
            "subscription_format": "plain",
            "nodes": [{
                "name": "Old-SG-1",
                "region": "SG",
                "type": "trojan",
                "outbound": {"type": "trojan", "tag": "proxy", "server": "sg.example.com", "server_port": 443, "password": "secret"},
                "raw_uri": "trojan://secret@sg.example.com:443#Old-SG-1",
            }],
        }
        with (
            patch("scripts.monitor_performance.fetch_subscription", side_effect=AssertionError("subscription should not be fetched during performance runs")),
            patch("scripts.monitor_performance.get_latest_subscription_node_snapshot", return_value=snapshot),
            patch("scripts.monitor_performance.check_nodes_availability", side_effect=AssertionError("stale snapshot should not be tested")),
            patch("scripts.monitor_performance.probe_node", side_effect=AssertionError("stale snapshot should not be probed")),
        ):
            result = run_for_airport(config, airport, "2026-05-13T12:00:00+08:00")

        payload = result["payload"]
        self.assertEqual(payload["status"], "skipped")
        self.assertEqual(payload["error_code"], "stale_subscription_node_snapshot")
        self.assertEqual(payload["diagnostics"]["node_source"], "none")
        self.assertEqual(payload["diagnostics"]["cache_snapshot_id"], 12)
        self.assertEqual(payload["diagnostics"]["cache_subscription_url_matches_current"], False)
        self.assertEqual(payload["selected_nodes"], [])
        self.assertEqual(payload["tested_nodes"], [])

    def test_run_for_airport_does_not_fallback_when_all_configured_nodes_are_unavailable(self) -> None:
        config = self.make_config()
        airport = {"id": 1, "name": "Alpha", "subscription_url": "https://sub.example.com"}
        hk_node = parse_node_line("trojan://secret@hk.example.com:443#HK-1")
        jp_node = parse_node_line("trojan://secret@jp.example.com:443#JP-1")
        assert hk_node is not None
        assert jp_node is not None
        snapshot = {
            "id": 12,
            "captured_at": "2026-05-12T10:00:00+08:00",
            "subscription_url": "https://sub.example.com",
            "subscription_format": "plain",
            "nodes": [node_to_test_snapshot(hk_node), node_to_test_snapshot(jp_node)],
        }

        with (
            patch("scripts.monitor_performance.fetch_subscription", side_effect=AssertionError("subscription should not be fetched during performance runs")),
            patch("scripts.monitor_performance.get_latest_subscription_node_snapshot", return_value=snapshot),
            patch("scripts.monitor_performance.get_performance_node_selection", return_value={
                "mode": "specified",
                "selected_keys": [performance_node_key(hk_node), performance_node_key(jp_node)],
            }),
            patch("scripts.monitor_performance.check_nodes_availability", return_value=[
                NodeAvailabilityResult(hk_node, False, "timeout"),
                NodeAvailabilityResult(jp_node, False, "connection refused"),
            ]),
            patch("scripts.monitor_performance.probe_node", side_effect=AssertionError("probe_node should not run")),
        ):
            result = run_for_airport(config, airport, "2026-05-13T12:00:00+08:00")

        payload = result["payload"]
        self.assertEqual(payload["status"], "skipped")
        self.assertEqual(payload["selected_nodes"], [])
        self.assertEqual(payload["tested_nodes"], [])
        self.assertEqual(payload["diagnostics"]["node_selection_mode"], "specified")
        self.assertEqual(payload["diagnostics"]["configured_node_count"], 2)
        self.assertEqual(
            [item["reason"] for item in payload["diagnostics"]["skipped_configured_nodes"]],
            ["configured_node_unavailable", "configured_node_unavailable"],
        )

    def test_capture_subscription_nodes_saves_parsed_snapshot(self) -> None:
        from scripts.capture_subscription_nodes import capture_for_airport

        config = self.make_config()
        airport = {"id": 1, "name": "Alpha", "subscription_url": "https://one-time.example.com/sub"}
        saved_snapshots = []

        with (
            patch("scripts.capture_subscription_nodes.fetch_subscription", return_value="trojan://secret@hk.example.com:443#HK-1"),
            patch("scripts.capture_subscription_nodes.post_subscription_node_snapshot", side_effect=lambda _config, _airport_id, payload: saved_snapshots.append(payload) or {"snapshot_id": 33}),
        ):
            summary = capture_for_airport(config, airport, "2026-05-13T12:00:00+08:00")

        self.assertEqual(summary["snapshot_id"], 33)
        self.assertEqual(summary["airport_id"], 1)
        self.assertEqual(summary["subscription_format"], "plain")
        self.assertEqual(summary["parsed_nodes_count"], 1)
        self.assertEqual(summary["supported_nodes_count"], 1)
        self.assertEqual(summary["unsupported_nodes_count"], 0)
        self.assertEqual(saved_snapshots[0]["source"], "test-performance")
        self.assertEqual(saved_snapshots[0]["nodes"][0]["raw_uri"], "trojan://secret@hk.example.com:443#HK-1")

    def test_capture_subscription_nodes_main_skips_missing_links_and_continues_after_failure(self) -> None:
        from scripts import capture_subscription_nodes

        config = self.make_config()
        config.all_airports = True
        airports = [
            {"id": 1, "name": "No Link", "subscription_url": ""},
            {"id": 2, "name": "Broken", "subscription_url": "https://broken.example/sub"},
            {"id": 3, "name": "Good", "subscription_url": "https://good.example/sub"},
        ]
        with (
            patch.object(capture_subscription_nodes, "build_config", return_value=config),
            patch.object(capture_subscription_nodes, "resolve_airports", return_value=airports),
            patch.object(
                capture_subscription_nodes,
                "shanghai_now_iso",
                return_value="2026-07-14T01:00:00+08:00",
            ),
            patch.object(
                capture_subscription_nodes,
                "capture_for_airport",
                side_effect=[
                    RuntimeError("subscription_fetch_or_parse_failed"),
                    {"airport_id": 3, "snapshot_id": 9},
                ],
            ) as capture_mock,
            patch("builtins.print") as print_mock,
        ):
            exit_code = capture_subscription_nodes.main()

        payload = json.loads(print_mock.call_args.args[0])
        self.assertEqual(exit_code, 1)
        self.assertEqual(capture_mock.call_count, 2)
        self.assertEqual(payload["airport_count"], 3)
        self.assertEqual(payload["target_count"], 2)
        self.assertEqual(payload["success_count"], 1)
        self.assertEqual(payload["failure_count"], 1)
        self.assertEqual(payload["skipped_count"], 1)
        self.assertEqual(
            payload["skipped"],
            [{"airport_id": 1, "airport_name": "No Link", "reason": "missing_subscription_url"}],
        )

    def test_capture_subscription_nodes_single_airport_without_link_still_fails(self) -> None:
        from scripts.capture_subscription_nodes import capture_for_airport

        with self.assertRaisesRegex(RuntimeError, "^missing_subscription_url$"):
            capture_for_airport(
                self.make_config(),
                {"id": 1, "name": "No Link", "subscription_url": ""},
                "2026-07-14T01:00:00+08:00",
            )

    def test_fetch_parsed_subscription_accepts_direct_vless_without_fetch(self) -> None:
        from scripts.capture_subscription_nodes import fetch_parsed_subscription

        config = self.make_config()
        direct_uri = (
            "vless://11111111-1111-1111-1111-111111111111@47.80.3.248:12043"
            "?encryption=none&security=reality&flow=xtls-rprx-vision&type=tcp"
            "&sni=dash.cloudflare.com&pbk=O7nRDHG9Gq9vJHxpHzojS92OP8liC6aCgIFeFY4GkTQ"
            "&fp=chrome#direct-reality"
        )

        with patch(
            "scripts.capture_subscription_nodes.fetch_subscription",
            side_effect=AssertionError("direct node URI must not be fetched"),
        ) as fetch_mock:
            subscription_format, nodes, unsupported_nodes = fetch_parsed_subscription(config, direct_uri)

        fetch_mock.assert_not_called()
        self.assertEqual(subscription_format, "plain")
        self.assertEqual(unsupported_nodes, [])
        self.assertEqual(len(nodes), 1)
        node = nodes[0]
        self.assertEqual(node.node_type, "vless")
        self.assertEqual(node.outbound["server"], "47.80.3.248")
        self.assertEqual(node.outbound["server_port"], 12043)
        self.assertEqual(node.outbound["flow"], "xtls-rprx-vision")
        self.assertEqual(node.outbound["tls"]["server_name"], "dash.cloudflare.com")
        self.assertEqual(node.outbound["tls"]["utls"]["fingerprint"], "chrome")
        self.assertEqual(
            node.outbound["tls"]["reality"]["public_key"],
            "O7nRDHG9Gq9vJHxpHzojS92OP8liC6aCgIFeFY4GkTQ",
        )

    def test_fetch_parsed_subscription_prefers_clashmeta_and_keeps_anytls(self) -> None:
        from scripts.capture_subscription_nodes import fetch_parsed_subscription

        config = self.make_config()
        subscription_url = "https://sub.example.com/secret-token"
        clash_yaml = """
proxies:
  - name: JP Reality
    type: vless
    server: jp.example.com
    port: 443
    uuid: 11111111-1111-1111-1111-111111111111
    tls: true
  - name: US AnyTLS
    type: anytls
    server: us.example.com
    port: 443
    password: secret
    sni: edge.example.com
  - name: unsupported-node
    type: hysteria2
    server: h2.example.com
    port: 443
    password: secret
"""

        with patch("scripts.capture_subscription_nodes.fetch_subscription", return_value=clash_yaml) as fetch_mock:
            subscription_format, nodes, unsupported_nodes = fetch_parsed_subscription(config, subscription_url)

        fetch_mock.assert_called_once_with(
            config,
            subscription_url,
            user_agent="ClashMeta/1.19.8",
        )
        self.assertEqual(subscription_format, "clash_yaml")
        self.assertEqual([node.node_type for node in nodes], ["vless", "anytls"])
        self.assertEqual(len(unsupported_nodes), 1)
        self.assertEqual(unsupported_nodes[0]["reason"], "unsupported_clash_proxy_type_hysteria2")

    def test_fetch_parsed_subscription_falls_back_after_clashmeta_fetch_failure(self) -> None:
        from scripts.capture_subscription_nodes import fetch_parsed_subscription

        config = self.make_config()
        subscription_url = "https://sub.example.com/secret-token"

        with patch(
            "scripts.capture_subscription_nodes.fetch_subscription",
            side_effect=[RuntimeError("primary fetch failed"), "trojan://secret@hk.example.com:443#HK-1"],
        ) as fetch_mock:
            subscription_format, nodes, unsupported_nodes = fetch_parsed_subscription(config, subscription_url)

        self.assertEqual(
            fetch_mock.call_args_list,
            [
                call(config, subscription_url, user_agent="ClashMeta/1.19.8"),
                call(config, subscription_url, user_agent="GateRank-Performance-Monitor/1.0"),
            ],
        )
        self.assertEqual(subscription_format, "plain")
        self.assertEqual([node.node_type for node in nodes], ["trojan"])
        self.assertEqual(unsupported_nodes, [])

    def test_fetch_parsed_subscription_falls_back_after_unusable_clashmeta_response(self) -> None:
        from scripts.capture_subscription_nodes import fetch_parsed_subscription

        config = self.make_config()
        subscription_url = "https://sub.example.com/secret-token"
        fallback = "trojan://secret@hk.example.com:443#HK-1"

        for primary_response in (
            '{"outbounds": [{"type": "direct"}]}',
            "hysteria2://secret@example.com:443#unsupported",
        ):
            with self.subTest(primary_response=primary_response):
                with patch(
                    "scripts.capture_subscription_nodes.fetch_subscription",
                    side_effect=[primary_response, fallback],
                ) as fetch_mock:
                    subscription_format, nodes, unsupported_nodes = fetch_parsed_subscription(config, subscription_url)

                self.assertEqual(fetch_mock.call_count, 2)
                self.assertEqual(subscription_format, "plain")
                self.assertEqual([node.node_type for node in nodes], ["trojan"])
                self.assertEqual(unsupported_nodes, [])

    def test_fetch_parsed_subscription_reports_safe_error_when_all_attempts_fail(self) -> None:
        from scripts.capture_subscription_nodes import fetch_parsed_subscription

        config = self.make_config()
        subscription_url = "https://sub.example.com/private-token"
        secret = "private-password"

        with patch(
            "scripts.capture_subscription_nodes.fetch_subscription",
            side_effect=[
                RuntimeError(f"failed {subscription_url}"),
                RuntimeError(f"failed {secret}"),
            ],
        ):
            with self.assertRaisesRegex(RuntimeError, "^subscription_fetch_or_parse_failed$") as context:
                fetch_parsed_subscription(config, subscription_url)

        self.assertNotIn(subscription_url, str(context.exception))
        self.assertNotIn(secret, str(context.exception))

    def test_capture_subscription_nodes_script_runs_from_repo_root_without_import_error(self) -> None:
        env = {**os.environ, "PYTHONPATH": ""}
        result = subprocess.run(
            [sys.executable, "scripts/capture_subscription_nodes.py"],
            cwd=os.getcwd(),
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertNotIn("ModuleNotFoundError", result.stderr)

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
