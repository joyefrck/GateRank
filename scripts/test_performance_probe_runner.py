import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import MagicMock, patch

from scripts.performance_probe_runner import (
    NodeMeasurement,
    ProbeRunnerConfig,
    TargetResult,
    build_node_summary,
    build_success_payload,
    measure_node,
    measure_network_coverage,
    legacy_config,
    run_sing_box,
    request_probe_json,
    run_once,
)
from scripts.monitor_performance import ParsedNode, NodeAvailabilityResult, performance_node_key


class PerformanceProbeRunnerTests(unittest.TestCase):
    def make_config(self) -> ProbeRunnerConfig:
        return ProbeRunnerConfig(
            api_base="https://gaterank.example",
            api_token="test-probe-token-with-enough-entropy",
            worker_id="worker-a",
            http_timeout=2,
            proxy_port=7890,
            proxy_startup_timeout=2,
            latency_attempts=1,
            request_loss_attempts=1,
            speed_timeout=1,
            speed_connections=1,
            sing_box_bin="sing-box",
        )

    def test_coverage_checks_all_nodes_without_speed_or_p_selection(self) -> None:
        nodes = [ParsedNode(f"node-{i}", "vless", "HK", {"server": "node.example", "server_port": 443}, f"vless://secret-{i}") for i in range(9)]
        snapshot = {"nodes": [{"name": n.name, "type": n.node_type, "region": n.region, "outbound": n.outbound, "raw_uri": n.raw_uri} for n in nodes]}
        job = {"job_id": "coverage-1", "test_profile": "network_coverage_proxy_http_v1", "snapshot": snapshot,
               "selected_node_keys": [performance_node_key(nodes[0])]}
        def check(config, node):
            return NodeAvailabilityResult(node=node, available=node.name != "node-2", error_code="tcp_unreachable:secret" if node.name == "node-2" else None)
        with (
            patch("scripts.performance_probe_runner.request_probe_json", side_effect=[job, {}]) as request,
            patch("scripts.performance_probe_runner.ensure_sing_box"),
            patch("scripts.performance_probe_runner.probe_node_proxy_http_availability", side_effect=check) as probe,
            patch("scripts.performance_probe_runner.measure_node") as speed,
        ):
            result = run_once(self.make_config())
        self.assertEqual(result["status"], "success")
        self.assertEqual(probe.call_count, 9)
        speed.assert_not_called()
        payload = request.call_args_list[-1].args[3]
        self.assertEqual(len(payload["nodes"]), 9)
        self.assertEqual(sum(n["healthy"] for n in payload["nodes"]), 8)
        self.assertNotIn("secret", json.dumps(payload))

    def test_coverage_infrastructure_failure_is_not_all_unhealthy(self) -> None:
        node = ParsedNode("HK", "vless", "HK", {}, "vless://secret")
        with patch("scripts.performance_probe_runner.ensure_sing_box", side_effect=RuntimeError("singbox_not_found")):
            result = measure_network_coverage({"job_id": "1"}, self.make_config(), [node], [])
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["nodes"], [])
        with (
            patch("scripts.performance_probe_runner.ensure_sing_box"),
            patch("scripts.performance_probe_runner.probe_node_proxy_http_availability", return_value=NodeAvailabilityResult(node=node, available=False, error_code="proxy_start_failed")),
        ):
            self.assertEqual(measure_network_coverage({"job_id": "1"}, self.make_config(), [node], [])["status"], "failed")

    def test_proxy_start_failure_cleans_process_and_sensitive_temp_config(self) -> None:
        node = ParsedNode("HK", "vless", "HK", {"server": "example.com", "password": "secret"}, "vless://secret")
        proc = MagicMock()
        proc.poll.return_value = None
        with (
            patch("scripts.monitor_performance.shutil.which", return_value="/bin/sing-box"),
            patch("scripts.monitor_performance.subprocess.Popen", return_value=proc) as spawn,
            patch("scripts.monitor_performance.wait_for_port", side_effect=RuntimeError("singbox_start_failed")),
        ):
            with self.assertRaisesRegex(RuntimeError, "singbox_start_failed"):
                run_sing_box(legacy_config(self.make_config(), "https://example.com"), node)
        proc.terminate.assert_called_once()
        self.assertFalse(Path(spawn.call_args.args[0][-1]).exists())

    def test_build_node_summary_uses_only_valid_target_median(self) -> None:
        summary = build_node_summary([
            TargetResult("a", 40.0, True, None, 1000, 200.0, 200),
            TargetResult("b", 100.0, True, None, 1000, 80.0, 200),
            TargetResult("c", 1000.0, False, "timeout", 0, 1000.0, None),
        ])

        self.assertEqual(summary.download_mbps, 70.0)
        self.assertEqual(summary.valid_target_count, 2)

    def test_regional_latency_uses_node_medians_and_retains_measurement_evidence(self) -> None:
        config = self.make_config()
        node = ParsedNode("HK-A", "trojan", "HK", {}, "trojan://secret")
        measurements = []
        for values in ([100, 110, 120, 130, 900], [300, 400, 500]):
            def sample(_config, *, diagnostics):
                diagnostics.update({"samples_ms": list(values), "warmup_samples_ms": [950, 850],
                                    "failures": 5 - len(values), "attempts": 5})
                return list(values), [f"t{i}" for i in range(len(values))], 5 - len(values), 5
            with (
                patch("scripts.performance_probe_runner.run_sing_box", return_value=(MagicMock(), "/tmp/test.json")),
                patch("scripts.performance_probe_runner.stop_sing_box"),
                patch("scripts.performance_probe_runner.test_node_connect_latency", return_value=([10], ["t"], 0, 1)),
                patch("scripts.performance_probe_runner.test_proxy_real_latency", side_effect=sample),
                patch("scripts.performance_probe_runner.test_proxy_http_latency", return_value=([80], 1, 10)),
                patch("scripts.performance_probe_runner.test_speed_targets", return_value=[
                    TargetResult("a", 100, True, None, 1000, 1000),
                ]),
            ):
                measurements.append(measure_node(config, node, [{"target_key": "a", "url": "https://example.com"}]))
        self.assertEqual(measurements[0].latency_samples_ms, [120])
        self.assertEqual(measurements[1].latency_samples_ms, [400])
        payload = build_success_payload({"job_id": "job-1", "airport_id": 9}, config, [node, node], measurements, [])
        self.assertEqual(payload["median_latency_ms"], 260)
        self.assertEqual(payload["packet_loss_percent"], 10)
        self.assertEqual(payload["diagnostics"]["latency_measurement"], "proxy_http_warmup2_median5_v1")
        self.assertEqual(payload["diagnostics"]["latency_nodes"][0]["samples_ms"], [100, 110, 120, 130, 900])
        self.assertEqual(payload["diagnostics"]["latency_nodes"][1]["failures"], 2)
        self.assertNotIn("secret", json.dumps(payload["diagnostics"]))

    def test_request_probe_json_sends_bearer_token_without_logging_it(self) -> None:
        config = self.make_config()
        response = MagicMock()
        response.status = 200
        response.__enter__.return_value = response
        response.read.return_value = json.dumps({"job_id": "job-1"}).encode()

        with patch("scripts.performance_probe_runner.urlopen", return_value=response) as urlopen_mock:
            result = request_probe_json(config, "GET", "/jobs")

        request = urlopen_mock.call_args.args[0]
        self.assertEqual(request.get_header("Authorization"), f"Bearer {config.api_token}")
        self.assertEqual(result, {"job_id": "job-1"})

    def test_insufficient_node_latency_stays_null_in_uploaded_run(self) -> None:
        config = self.make_config()
        node = ParsedNode("HK-A", "trojan", "HK", {}, "trojan://secret")
        evidence = {"samples_ms": [100, 120], "failures": 3, "median_ms": None}
        measurement = NodeMeasurement(node, [], [], [110], 0, 10, 0, 3,
                                      [TargetResult("a", 100, True, None, 1000, 1000)],
                                      "node_probe_partial", latency_diagnostics=evidence)
        payload = build_success_payload({"job_id": "job-1", "airport_id": 9}, config, [node], [measurement], [])
        self.assertIsNone(payload["median_latency_ms"])
        self.assertEqual(payload["status"], "partial")
        self.assertEqual(payload["diagnostics"]["latency_nodes"][0]["samples_ms"], [100, 120])

    def test_run_once_exits_cleanly_when_queue_is_empty(self) -> None:
        config = self.make_config()
        with patch("scripts.performance_probe_runner.request_probe_json", return_value=None) as request_mock:
            result = run_once(config)

        self.assertEqual(result, {"status": "idle"})
        request_mock.assert_called_once_with(config, "GET", "/jobs", worker_id="worker-a")

    def test_runner_script_starts_from_repo_root_without_import_error(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        result = subprocess.run(
            [sys.executable, "scripts/performance_probe_runner.py", "--help"],
            cwd=repo_root,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_run_without_calibration_executes_proxy_measurements(self) -> None:
        config = self.make_config()
        node = ParsedNode(
            name="HK-A",
            node_type="trojan",
            region="HK",
            outbound={"type": "trojan", "server": "node.example", "server_port": 443},
            raw_uri="trojan://redacted@node.example:443#HK-A",
        )
        job = {
            "job_id": "job-1",
            "airport_id": 9,
            "probe_id": "cn-shanghai",
            "test_profile": "proxy_multi_target_v2",
            "snapshot": {"subscription_format": "plain", "parsed_nodes_count": 1, "supported_nodes_count": 1},
            "calibration": {"mode": "not_required"},
            "speed_targets": [
                {"target_key": "cachefly-50mb", "url": "https://cachefly.cachefly.net/50mb.test"},
                {"target_key": "cloudflare-50mb", "url": "https://speed.cloudflare.com/__down?bytes=50000000"},
            ],
        }
        uploads = []
        measurement = NodeMeasurement(
            node=node,
            latency_samples_ms=[45.0],
            latency_sampled_at=["2026-08-08T12:00:00+08:00"],
            proxy_latency_samples_ms=[45.0, 52.0],
            proxy_failures=0,
            proxy_attempts=2,
            connect_failures=0,
            connect_attempts=1,
            targets=[
                TargetResult("cachefly-50mb", 80.0, True, None, 10_000_000, 1000.0, None),
                TargetResult("cloudflare-50mb", 120.0, True, None, 15_000_000, 1000.0, None),
            ],
            error_code=None,
        )

        def fake_request(_config, method, path, payload=None, worker_id=None):
            del worker_id
            if method == "GET":
                return job
            uploads.append((path, payload))
            return {"run_id": 44}

        with (
            patch("scripts.performance_probe_runner.request_probe_json", side_effect=fake_request),
            patch("scripts.performance_probe_runner.nodes_from_snapshot", return_value=([node], [])),
            patch("scripts.performance_probe_runner.resolve_job_nodes", return_value=[node]),
            patch("scripts.performance_probe_runner.measure_node", return_value=measurement),
        ):
            result = run_once(config)

        self.assertEqual(result["status"], "success")
        self.assertEqual(uploads[0][0], "/runs")
        self.assertEqual(uploads[0][1]["calibration_status"], "not_required")
        self.assertIsNone(uploads[0][1]["calibration_mbps"])
        self.assertEqual(uploads[0][1]["median_download_mbps"], 100.0)
        self.assertEqual(uploads[0][1]["diagnostics"]["test_profile"], "proxy_multi_target_v2")
        self.assertEqual(len(uploads[0][1]["target_results"]), 2)

    def test_all_target_failures_do_not_report_zero_speed(self) -> None:
        summary = build_node_summary([
            TargetResult("a", None, False, "download_failed", 0, 0, None),
            TargetResult("b", None, False, "empty_download", 0, 1000.0, None),
        ])

        self.assertIsNone(summary.download_mbps)
        self.assertEqual(summary.valid_target_count, 0)


if __name__ == "__main__":
    unittest.main()
