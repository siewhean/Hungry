#!/usr/bin/env python3
"""Offline tests for the stall-logo spreadsheet sanitizer and URL validators (no network)."""

from __future__ import annotations

import socket
import sys
import unittest
from unittest import mock
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data" / "stall_logos"))

import find_logo_candidates as flc  # noqa: E402
from find_logo_candidates import _check_peer, _ip_blocked, candidate_url_ok, fetch_url_ok, safe_cell  # noqa: E402


def fake_resolver(*addrs):
    def resolve(host, port, proto=0):
        return [(socket.AF_INET, socket.SOCK_STREAM, proto, "", (a, port)) for a in addrs]
    return resolve


class SafeCellTest(unittest.TestCase):
    def test_escapes_formula_prefixes(self):
        for v in ("=HYPERLINK(\"x\")", "+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"):
            self.assertEqual(safe_cell(v), "'" + v)

    def test_leaves_safe_values(self):
        for v in ("Toast Box", "https://a.sg/x.png", "", 12, None, "a=b"):
            self.assertEqual(safe_cell(v), v)


class UrlValidatorTest(unittest.TestCase):
    def test_candidate_schemes(self):
        self.assertTrue(candidate_url_ok("https://brand.sg/logo.png"))
        self.assertTrue(candidate_url_ok("http://brand.sg/logo.png"))
        for u in ("data:image/png;base64,AAA", "javascript:alert(1)", "file:///etc/passwd",
                  "ftp://brand.sg/a.png", "//brand.sg/a.png", "https:///nohost"):
            self.assertFalse(candidate_url_ok(u), u)

    def test_candidate_ip_literals(self):
        for u in ("http://127.0.0.1/a", "http://10.0.0.5/a", "http://169.254.169.254/latest", "http://[::1]/a",
                  "http://0.0.0.0/a", "http://224.0.0.1/a", "http://[::ffff:192.168.1.1]/a", "http://240.0.0.1/a"):
            self.assertFalse(candidate_url_ok(u), u)
        self.assertTrue(candidate_url_ok("http://8.8.8.8/a"))

    def test_fetch_requires_public_resolution(self):
        self.assertTrue(fetch_url_ok("https://brand.sg/", resolve=fake_resolver("93.184.216.34")))
        self.assertFalse(fetch_url_ok("https://brand.sg/", resolve=fake_resolver("93.184.216.34", "127.0.0.1")))
        self.assertFalse(fetch_url_ok("https://brand.sg/", resolve=fake_resolver("192.168.0.2")))
        self.assertFalse(fetch_url_ok("ftp://brand.sg/", resolve=fake_resolver("93.184.216.34")))

        def failing(*_a, **_k):
            raise socket.gaierror("no dns")
        self.assertFalse(fetch_url_ok("https://brand.sg/", resolve=failing))


class AllowGlobalOnlyTest(unittest.TestCase):
    def test_blocks_wrapped_and_shared_ranges(self):
        for ip in ("::ffff:10.0.0.1", "64:ff9b::a00:1", "100.64.1.1", "2002:0a00:0001::", "127.0.0.1", "::1",
                   "169.254.169.254", "fe80::1", "0.0.0.0"):
            self.assertTrue(_ip_blocked(ip), ip)

    def test_allows_global(self):
        for ip in ("8.8.8.8", "2606:4700:4700::1111", "64:ff9b::808:808", "::ffff:8.8.8.8"):
            self.assertFalse(_ip_blocked(ip), ip)


class FakeSock:
    def __init__(self, peer):
        self.peer, self.closed = peer, False

    def getpeername(self):
        return (self.peer, 443)

    def close(self):
        self.closed = True


class PeerCheckTest(unittest.TestCase):
    def test_rejects_and_closes_private_peer(self):
        sock = FakeSock("10.0.0.7")
        with self.assertRaises(OSError):
            _check_peer(sock)
        self.assertTrue(sock.closed)

    def test_accepts_global_peer(self):
        sock = FakeSock("93.184.216.34")
        _check_peer(sock)
        self.assertFalse(sock.closed)

    def test_connection_subclass_checks_peer_after_connect(self):
        sock = FakeSock("127.0.0.1")
        conn = flc._PeerHTTPConnection("brand.sg")
        with mock.patch("http.client.HTTPConnection.connect", lambda self: setattr(self, "sock", sock)):
            with self.assertRaises(OSError):
                conn.connect()
        self.assertTrue(sock.closed)

    def test_opener_uses_peer_handlers(self):
        kinds = {type(h) for h in flc.SITE_OPENER.handlers}
        self.assertIn(flc._PeerHTTPHandler, kinds)
        self.assertIn(flc._PeerHTTPSHandler, kinds)
        self.assertIn(flc._SafeRedirect, kinds)


if __name__ == "__main__":
    unittest.main()
