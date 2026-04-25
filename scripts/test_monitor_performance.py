import base64
import json
import unittest

from scripts.monitor_performance import (
    normalize_subscription_text,
    parse_node_line,
    select_nodes,
)


class PickLastRandom:
    def choice(self, values):
        return values[-1]

    def shuffle(self, values):
        values.reverse()


class MonitorPerformanceTests(unittest.TestCase):
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

    def test_select_nodes_randomly_picks_one_node_per_priority_region(self) -> None:
        uris = [
            "trojan://password@hk.example.com:443#HK-A",
            "trojan://password@hk2.example.com:443#HK-B",
            "trojan://password@sg.example.com:443#SG-A",
            "trojan://password@jp.example.com:443#JP-A",
            "trojan://password@jp2.example.com:443#JP-B",
            "trojan://password@us.example.com:443#US-A",
        ]
        nodes = [parse_node_line(uri) for uri in uris]
        selected = select_nodes([node for node in nodes if node is not None], rng=PickLastRandom())
        self.assertEqual([node.name for node in selected], ["HK-B", "JP-B", "SG-A"])

    def test_select_nodes_randomly_fills_remaining_slots(self) -> None:
        uris = [
            "trojan://password@hk.example.com:443#HK-A",
            "trojan://password@de.example.com:443#DE-A",
            "trojan://password@nl.example.com:443#NL-A",
        ]
        nodes = [parse_node_line(uri) for uri in uris]
        selected = select_nodes([node for node in nodes if node is not None], rng=PickLastRandom())
        self.assertEqual([node.name for node in selected], ["HK-A", "NL-A", "DE-A"])


if __name__ == "__main__":
    unittest.main()
