#!/usr/bin/env python3
"""Independent regional website checks; no subscription access or browser scripts."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import http.client
from http.client import HTTPException
import ipaddress
import json
import math
import os
import re
import signal
import socket
import ssl
import time
from urllib.parse import urlsplit, urlunsplit, urljoin
from urllib.request import Request, urlopen


def is_waf_challenge(server, body):
    return ('veilx' in server.lower() and re.search(r'<title>\s*安全验证\s*</title>', body, re.I) is not None
            and re.search(r'''["']/_waf/''', body) is not None)


def parse_url(raw):
    url = urlsplit(raw)
    if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or len(raw) > 4096:
        raise ValueError('INVALID_WEBSITE_URL')
    if url.port is not None and not 1 <= url.port <= 65535:
        raise ValueError('INVALID_WEBSITE_URL')
    return url._replace(fragment='')


def safe_url(url):
    return urlunsplit(url._replace(query='', fragment=''))


def resolve_public(host, port):
    addresses = list(dict.fromkeys(row[4][0] for row in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)))
    if not addresses: raise OSError('NO_ADDRESSES')
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global or getattr(ip, 'ipv4_mapped', None) or (ip.version == 6 and (ip.sixtofour or ip.teredo)):
            raise ValueError('NON_PUBLIC_TARGET')
    return sorted(addresses, key=lambda address: ':' in address)


def inspect_tls(host, port, address, timeout):
    with socket.create_connection((address, port), timeout=timeout) as raw:
        with ssl.create_default_context().wrap_socket(raw, server_hostname=host) as sock:
            expiry = ssl.cert_time_to_seconds(sock.getpeercert()['notAfter'])
            return math.floor((expiry - time.time()) / 86400), True


def request_url(url, address, timeout):
    port = url.port or (443 if url.scheme == 'https' else 80)
    connection = http.client.HTTPConnection(url.hostname, port, timeout=timeout)
    try:
        sock = socket.create_connection((address, port), timeout=timeout)
        if url.scheme == 'https':
            # Match center behavior: HTTP evidence and certificate trust are separate observations.
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            try: sock = context.wrap_socket(sock, server_hostname=url.hostname)
            except BaseException:
                sock.close()
                raise
        connection.sock = sock
        connection.request('GET', urlunsplit(('', '', url.path or '/', url.query, '')),
                           headers={'Host':url.netloc, 'User-Agent':'GateRank-Risk-Check/1.0',
                                    'Accept':'text/html,application/xhtml+xml', 'Connection':'close'})
        response = connection.getresponse()
        headers = {key.lower(): value for key, value in response.getheaders()}
        body = ''
        if response.status == 418:
            try: body = response.read(8192).decode('utf-8', errors='replace')
            except (OSError, HTTPException): pass  # Preserve a known HTTP error when its body stalls or truncates.
        return response.status, headers, body
    finally:
        connection.close()


def probe_website(raw):
    start = time.monotonic()
    deadline = start + 30
    result = {'status':'internal_error', 'http_status':None, 'ssl_days_left':None, 'tls_authorized':None,
              'final_url':None, 'ssl_target_url':None, 'error_code':None, 'duration_ms':0,
              'root_fallback':False, 'retried':False, 'attempts':[]}
    def remaining():
        seconds = min(5, deadline - time.monotonic())
        if seconds <= 0: raise TimeoutError()
        return seconds
    def attempt(stage, url, round_no, http=None, error=None):
        result['attempts'].append({'stage':stage, 'url':safe_url(url), 'round':round_no,
                                   'http_status':http, 'error_code':error})
    def alarm(_signum, _frame): raise TimeoutError()
    previous = signal.signal(signal.SIGALRM, alarm)
    signal.setitimer(signal.ITIMER_REAL, 30)
    try:
        parsed = parse_url(raw)
        cache = {}
        def addresses(url, round_no):
            key = (url.hostname, url.port or (443 if url.scheme == 'https' else 80))
            if key not in cache:
                cache[key] = resolve_public(*key)
                attempt('dns', url, round_no)
            return cache[key]
        original_addresses = addresses(parsed, 1)
        if parsed.scheme == 'https':
            result['ssl_target_url'] = safe_url(parsed)
            for address in original_addresses:
                try:
                    days, trusted = inspect_tls(parsed.hostname, parsed.port or 443, address, remaining())
                    result.update(ssl_days_left=days, tls_authorized=trusted)
                    attempt('tls',parsed,1)
                    break
                except ssl.SSLCertVerificationError:
                    result['tls_authorized'] = False
                    attempt('tls',parsed,1,error='TLS_CERTIFICATE_UNTRUSTED')
                    break
                except (OSError, TimeoutError): attempt('tls',parsed,1,error='TLS_UNAVAILABLE')
        last_failure = None
        for round_no in (1,2):
            if round_no == 2: result['retried'] = True; cache.clear()
            root = parsed._replace(path='/',query='')
            candidates = [parsed] if parsed == root else [parsed,root]
            for candidate in candidates:
                url, seen = candidate, set()
                http, status, error = None, 'unreachable', 'CONNECTION_FAILED'
                for hop in range(6):
                    if url.geturl() in seen:
                        status,error = 'service_error','REDIRECT_LOOP'; break
                    seen.add(url.geturl())
                    for address in addresses(url,round_no):
                        try:
                            http,headers,body = request_url(url,address,remaining())
                            attempt('http',url,round_no,http=http)
                            break
                        except (OSError, TimeoutError, HTTPException):
                            attempt('http',url,round_no,error='CONNECTION_FAILED')
                    if http is None: break
                    error = None
                    if http == 418 and is_waf_challenge(headers.get('server',''),body): status='waf_challenge'; break
                    if headers.get('cf-mitigated') == 'challenge': status='challenge'; break
                    if http in (301,302,303,307,308):
                        location = headers.get('location')
                        if not location or hop == 5:
                            status,error='service_error','REDIRECT_LIMIT' if hop == 5 else 'REDIRECT_NO_LOCATION'; break
                        url = parse_url(urljoin(url.geturl(),location)); http = None
                        continue
                    status = 'accessible' if 200 <= http < 300 else 'restricted' if http in (401,403,429) else 'service_error'
                    error = f'HTTP_{http}' if status == 'service_error' else None
                    break
                outcome = {'status':status,'http_status':http,'error_code':error,'final_url':safe_url(url)}
                if status in ('accessible','challenge','waf_challenge','restricted'):
                    result.update(outcome,root_fallback=candidate != parsed)
                    return result
                if last_failure is None or status == 'service_error': last_failure = outcome
            if last_failure and last_failure['http_status'] and last_failure['http_status'] < 500: break
        result.update(last_failure or {})
        if result['status'] == 'unreachable' and result['ssl_days_left'] is not None: result['status']='tls_only'
    except ValueError:
        result.update(status='config_error',error_code='NON_PUBLIC_OR_INVALID_TARGET')
    except (OSError, TimeoutError):
        result.update(status='internal_error',error_code='PROBE_TIMEOUT')
    except Exception:
        result.update(status='internal_error',error_code='INTERNAL_ERROR')
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)
        result['duration_ms'] = round((time.monotonic()-start)*1000)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check-url')
    args = parser.parse_args()
    if args.check_url:
        print(json.dumps(probe_website(args.check_url),ensure_ascii=False)); return
    base, token = os.getenv('PROBE_API_BASE','').rstrip('/'), os.getenv('PROBE_API_TOKEN','')
    if not base.startswith('https://') or len(token) < 24: raise ValueError('PROBE_CONFIGURATION_INVALID')
    def request(path, payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        req = Request(base+path,data=data,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json',
                      'Accept':'application/json','User-Agent':'GateRank-Performance-Probe/1.0'})
        with urlopen(req,timeout=10) as response:
            return json.loads(response.read(32768)) if response.status != 204 else None
    job = request('/website-jobs')
    if job:
        result = probe_website(job['target_url'])
        request('/website-runs',{**result,'job_id':job['job_id'],'lease_token':job['lease_token']})
        print(json.dumps({'status':result['status'],'http_status':result['http_status']}))
    else: print('{"status":"idle"}')

if __name__ == '__main__':
    try: main()
    except Exception:
        print('{"status":"failed","error_code":"WEBSITE_WORKER_FAILED"}')
        raise SystemExit(1)
