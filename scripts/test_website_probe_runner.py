import unittest
from unittest.mock import patch
from scripts import website_probe_runner as w

class WebsiteProbeTests(unittest.TestCase):
    def test_veilx_challenge_requires_all_markers(self):
        body = '<title>安全验证</title><script src="/_waf/abc.js"></script>'
        self.assertTrue(w.is_waf_challenge('Nginx/VeilX-Edge', body))
        self.assertFalse(w.is_waf_challenge('nginx', body))
        self.assertFalse(w.is_waf_challenge('Nginx/VeilX-Edge', 'application error'))

    def test_private_targets_rejected_before_connection(self):
        with patch.object(w.socket, 'getaddrinfo', return_value=[(2, 1, 6, '', ('127.0.0.1', 443))]):
            with self.assertRaises(ValueError):
                w.resolve_public('example.com', 443)

    def test_mixed_public_private_answers_rejected(self):
        answers = [(2, 1, 6, '', ('8.8.8.8',443)),(2, 1, 6, '', ('10.0.0.1',443))]
        with patch.object(w.socket, 'getaddrinfo', return_value=answers):
            with self.assertRaises(ValueError): w.resolve_public('example.com',443)

    def test_success_sanitizes_url(self):
        with patch.object(w, 'resolve_public', return_value=['8.8.8.8']), \
             patch.object(w, 'inspect_tls', return_value=(88, True)), \
             patch.object(w, 'request_url', return_value=(200, {}, '')):
            result = w.probe_website('https://example.com/?token=secret#/register')
        self.assertEqual(result['status'], 'accessible')
        self.assertNotIn('secret', str(result))
        self.assertEqual(result['ssl_days_left'],88)

    def test_waf_is_distinct_from_generic_418(self):
        for headers, body, expected in [({'server':'Nginx/VeilX-Edge'}, '<title>安全验证</title><script src="/_waf/a.js"></script>', 'waf_challenge'), ({}, 'error', 'service_error')]:
            with patch.object(w, 'resolve_public', return_value=['8.8.8.8']), \
                 patch.object(w, 'inspect_tls', return_value=(88,True)), \
                 patch.object(w, 'request_url', return_value=(418,headers,body)):
                self.assertEqual(w.probe_website('https://example.com/')['status'],expected)

    def test_private_redirect_is_rejected(self):
        def resolve(host,port):
            if host == 'private.example': raise ValueError('NON_PUBLIC_TARGET')
            return ['8.8.8.8']
        with patch.object(w, 'resolve_public', side_effect=resolve), \
             patch.object(w, 'inspect_tls', return_value=(88,True)), \
             patch.object(w, 'request_url', return_value=(302,{'location':'https://private.example/'},'')):
            self.assertEqual(w.probe_website('https://example.com')['status'],'config_error')

if __name__ == '__main__': unittest.main()

class NetworkFailureTests(unittest.TestCase):
    def test_failed_http_with_valid_tls_is_not_a_python_exception(self):
        with patch.object(w,'resolve_public',return_value=['8.8.8.8']), \
             patch.object(w,'inspect_tls',return_value=(88,True)), \
             patch.object(w,'request_url',side_effect=OSError()):
            result = w.probe_website('https://example.com/')
        self.assertEqual(result['status'],'tls_only')
        self.assertTrue(result['retried'])

class HttpEvidenceTests(unittest.TestCase):
    def test_418_body_timeout_keeps_status(self):
        from urllib.parse import urlsplit
        response = unittest.mock.Mock(status=418)
        response.getheaders.return_value = [('server','nginx')]
        response.read.side_effect = TimeoutError()
        conn = unittest.mock.Mock()
        conn.getresponse.return_value = response
        with patch.object(w.socket,'create_connection'), patch.object(w.http.client,'HTTPConnection',return_value=conn):
            status, headers, body = w.request_url(urlsplit('http://example.com/'),'8.8.8.8',1)
        self.assertEqual(status,418)
        self.assertEqual(body,'')
