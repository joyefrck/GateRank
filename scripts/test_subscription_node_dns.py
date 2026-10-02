import socket
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from scripts.subscription_node_dns import normalize_dns_resolvers, resolve_node_addresses


class SubscriptionNodeDnsTests(unittest.TestCase):
    def test_invalid_resolvers_are_rejected_without_echoing_credentials(self):
        for value in (["https://user:secret@dns.example/dns-query"], ["file:///tmp/dns"], "192.0.2.53", ["192.0.2.53#RULES"]):
            with self.assertRaisesRegex(ValueError, "invalid_node_dns_resolver"):
                normalize_dns_resolvers(value)

    def test_custom_dns_uses_no_system_configuration_and_honors_ipv6(self):
        resolver = MagicMock()
        resolver.resolve.return_value = [SimpleNamespace(address="192.0.2.10"), SimpleNamespace(address="192.0.2.11")]
        with patch("dns.resolver.Resolver", return_value=resolver) as make_resolver:
            addresses = resolve_node_addresses("hk.example.test", 443, ["192.0.2.53"], False, 2)
        make_resolver.assert_called_once_with(configure=False)
        self.assertEqual(resolver.nameservers[0].address, "192.0.2.53")
        self.assertEqual([a[4][0] for a in addresses], ["192.0.2.10", "192.0.2.11"])
        self.assertEqual(resolver.resolve.call_args.args, ("hk.example.test", "A"))

    def test_custom_dns_failure_never_uses_system_dns(self):
        import dns.exception
        resolver = MagicMock()
        resolver.resolve.side_effect = dns.exception.Timeout()
        with patch("dns.resolver.Resolver", return_value=resolver), patch("socket.getaddrinfo") as system:
            with self.assertRaisesRegex(RuntimeError, "subscription_node_dns_failed"):
                resolve_node_addresses("hk.example.test", 443, ["192.0.2.53"], False, 1)
        system.assert_not_called()

    def test_system_dns_keeps_all_addresses_and_filters_ipv6_when_disabled(self):
        values = [(socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("2001:db8::1", 443, 0, 0)),
                  (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.10", 443)),
                  (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.11", 443))]
        with patch("socket.getaddrinfo", return_value=values):
            self.assertEqual(resolve_node_addresses("hk.example.test", 443, [], None, 1), values)
            self.assertEqual(resolve_node_addresses("hk.example.test", 443, [], False, 1), values[1:])

    def test_numeric_node_does_not_need_dns(self):
        with patch("dns.resolver.Resolver") as resolver:
            result = resolve_node_addresses("192.0.2.10", 443, ["192.0.2.53"], False, 1)
        resolver.assert_not_called()
        self.assertEqual(result[0][4], ("192.0.2.10", 443))
