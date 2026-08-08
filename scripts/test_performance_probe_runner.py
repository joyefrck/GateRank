import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import MagicMock, patch

from scripts.performance_probe_runner import (
    ProbeRunnerConfig,
    TargetResult,
    build_node_summary,
    request_probe_json,
    run_once,
)


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

    def test_build_node_summary_uses_only_valid_target_median(self) -> None:
        summary = build_node_summary([
            TargetResult("a", 40.0, True, None, 1000, 200.0, 200),
            TargetResult("b", 100.0, True, None, 1000, 80.0, 200),
            TargetResult("c", 1000.0, False, "timeout", 0, 1000.0, None),
        ])

        self.assertEqual(summary.download_mbps, 70.0)
        self.assertEqual(summary.valid_target_count, 2)

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

    def test_failed_calibration_uploads_no_node_evidence(self) -> None:
        config = self.make_config()
        job = {
            "job_id": "job-1",
            "airport_id": 9,
            "probe_id": "cn-shanghai",
            "snapshot": {"subscription_format": "plain", "nodes": []},
            "calibration": {"url": "https://calibration.example/file", "minimum_mbps": 160},
            "speed_targets": [{"target_key": "a", "url": "https://target.example/file"}],
        }
        uploads = []

        def fake_request(_config, method, path, payload=None, worker_id=None):
            del worker_id
            if method == "GET":
                return job
            uploads.append((path, payload))
            return {"run_id": 44}

        with patch("scripts.performance_probe_runner.request_probe_json", side_effect=fake_request), patch(
            "scripts.performance_probe_runner.measure_direct_download",
            return_value=120.0,
        ):
            result = run_once(config)

        self.assertEqual(result["status"], "calibration_failed")
        self.assertEqual(uploads[0][0], "/runs")
        self.assertEqual(uploads[0][1]["calibration_status"], "failed")
        self.assertEqual(uploads[0][1]["tested_nodes"], [])
        self.assertEqual(uploads[0][1]["target_results"], [])


if __name__ == "__main__":
    unittest.main()
