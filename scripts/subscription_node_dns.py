"""Bounded, subscription-scoped resolution of proxy server addresses."""
from __future__ import annotations

import ipaddress
import socket
import time
from typing import Any
from urllib.parse import urlparse


def dns_endpoint(value: str) -> tuple[str, str, int, str]:
    try:
        if not isinstance(value, str) or not value.strip() or len(value) > 512:
            raise ValueError
        value = value.strip()
        try:
            return "udp", str(ipaddress.ip_address(value)), 53, value
        except ValueError:
            pass
        parsed = urlparse(value if "://" in value else "udp://" + value)
        if (parsed.scheme not in {"udp", "tcp", "tls", "https"} or not parsed.hostname
                or parsed.username or parsed.password or parsed.fragment or parsed.query):
            raise ValueError
        if parsed.scheme != "https" and parsed.path not in {"", "/"}:
            raise ValueError
        port = parsed.port or {"udp": 53, "tcp": 53, "tls": 853, "https": 443}[parsed.scheme]
        if not 1 <= port <= 65535:
            raise ValueError
        return parsed.scheme, parsed.hostname, port, value
    except (ValueError, TypeError):
        raise ValueError("invalid_node_dns_resolver") from None


def normalize_dns_resolvers(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > 8:
        raise ValueError("invalid_node_dns_resolver")
    result = []
    for item in value:
        dns_endpoint(item)
        if item.strip() not in result:
            result.append(item.strip())
    return result


def _numeric_address(ip: str, port: int) -> tuple:
    address = ipaddress.ip_address(ip)
    family = socket.AF_INET if address.version == 4 else socket.AF_INET6
    target = (str(address), port) if address.version == 4 else (str(address), port, 0, 0)
    return family, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", target


def _custom_addresses(host: str, resolvers: list[str], ipv6: bool | None, timeout: float) -> list[str]:
    # Import only when needed, so old snapshots retain their system-DNS behavior.
    import dns.exception
    import dns.nameserver
    import dns.resolver

    deadline = time.monotonic() + timeout
    for value in resolvers:
        scheme, server, port, original = dns_endpoint(value)
        resolver = dns.resolver.Resolver(configure=False)
        resolver.timeout = min(2, timeout)
        if scheme == "https":
            nameserver = dns.nameserver.DoHNameserver(original)
        else:
            try:
                address = str(ipaddress.ip_address(server))
            except ValueError:
                # Bootstrap only the resolver hostname, within the same deadline.
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                try:
                    address = dns.resolver.Resolver().resolve(
                        server, "A", lifetime=remaining, search=False)[0].address
                except (dns.exception.DNSException, OSError, ValueError):
                    continue
            nameserver = (dns.nameserver.DoTNameserver(address, port, hostname=server)
                          if scheme == "tls" else dns.nameserver.Do53Nameserver(address, port))
        resolver.nameservers = [nameserver]
        addresses = []
        for record_type in (["A"] if ipv6 is False else ["A", "AAAA"]):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            try:
                answer = resolver.resolve(host, record_type, tcp=scheme == "tcp",
                                          lifetime=remaining, search=False)
                addresses.extend(str(ipaddress.ip_address(record.address)) for record in answer)
            except (dns.exception.DNSException, OSError, ValueError):
                continue
        if addresses:
            return list(dict.fromkeys(addresses))
    raise RuntimeError("subscription_node_dns_failed")


def resolve_node_addresses(host: str, port: int, resolvers: list[str],
                           ipv6: bool | None, timeout: float) -> list[tuple]:
    try:
        numeric = _numeric_address(host, port)
    except ValueError:
        numeric = None
    if numeric:
        return [numeric]
    if resolvers:
        return [_numeric_address(ip, port) for ip in _custom_addresses(
            host, normalize_dns_resolvers(resolvers), ipv6, max(0.1, timeout))]
    addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    if ipv6 is False:
        addresses = [a for a in addresses if a[0] == socket.AF_INET]
    unique = list(dict.fromkeys(addresses))
    if not unique:
        raise RuntimeError("node_address_resolve_failed")
    return unique
