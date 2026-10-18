#!/usr/bin/env python3
"""Offline tests for the stall-logo spreadsheet sanitizer and URL validators (no network)."""

from __future__ import annotations

import socket
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data" / "stall_logos"))

from find_logo_candidates import candidate_url_ok, fetch_url_ok, safe_cell  # noqa: E402


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


if __name__ == "__main__":
    unittest.main()
