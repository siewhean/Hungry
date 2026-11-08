#!/usr/bin/env python3
"""Tests for menu_run_quarantine.py. Tiny temp fixtures only; no network, no real data.

Run:  python3 scripts/menu_run_quarantine.test.py
"""
from __future__ import annotations

import contextlib
import csv
import hashlib
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import menu_run_quarantine as q  # noqa: E402

KEYS = ["stall_licence_no", "stall_name", "source_url", "source", "verified", "menu_title", "menu_hours", "category",
        "item_name", "price_sgd", "discounted_price_sgd", "price_from", "variation_prices_sgd", "description",
        "image_url", "sold_out", "crawl_timestamp"]


def U(tag):
    return f"https://foodpanda.sg/restaurant/{tag}/x"


A1URL = "https://alpha.example/bedok"
SHARED = U("shared")
SIG = "https://sigma.example/menu"
MASTER = {
    "L_A1": ("Alpha Cafe (Bedok)", A1URL), "L_A2": ("Alpha Cafe (Tampines)", U("bbbb")), "L_A3": ("Alpha Cafe (Clementi)", ""),
    "L_B1": ("Bravo Noodles", U("cccc")), "L_C1": ("Charlie Grill", SHARED), "L_D1": ("Delta Bar", SHARED),
    "L_S1": ("Sigma Kopi (One)", SIG), "L_S2": ("Sigma Kopi (Two)", SIG),
    "L_E1": ("Echo Eatery", U("eeee")), "L_F1": ("Foxtrot Foods", U("ffff")), "L_N1": ("November Nasi", U("nnnn")),
    "CE10G68E000": ("% Arabica", ""),
    "L_A4": ("Alpha Cafe (Jurong)", U("a444")), "L_A5": ("Alpha Cafe (Woodlands)", U("a555")),
    "L_T1": ("Two Men Bagel House - Plaza Singapura", ""), "L_T2": ("TWO MEN BAGEL HOUSE (Bedok Mall)", ""), "L_T3": ("Two Bao Shop", ""),
    "L_G1": ("Song Fa Bak Kut Teh @ Jewel", ""), "L_G2": ("Song Fa Bak Kut Teh", ""), "L_G3": ("Song Kee Noodles", ""),
    "L_U1": ("Uncorr Kopi (One)", U("u111")), "L_U2": ("Uncorr Kopi (Two)", U("u222")),
}


def R(lic="L_B1", item="Nasi Lemak", price=5.0, url=None, source="foodpanda", ts="2026-11-05 11:00:00", **kw):
    row = {k: "" for k in KEYS}
    row.update(stall_licence_no=lic, stall_name=MASTER.get(lic, ("Unknown Stall",))[0], source_url=MASTER.get(lic, ("", ""))[1] if url is None else url,
              source=source, verified=True, item_name=item, price_sgd=price, discounted_price_sgd=None, price_from=False,
              variation_prices_sgd=[], sold_out=False, crawl_timestamp=ts, category="Mains")
    row.update(kw)
    return row


def five(lic, tag="Dish", url=None, **kw):
    return [R(lic, f"{tag} {i}", 4.0 + i, url=url, **kw) for i in range(5)]


class Env(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.addCleanup(self._td.cleanup)
        self.tmp = Path(self._td.name).resolve()
        self.inp = self.tmp / "in"
        self.inp.mkdir()
        self.out = self.tmp / "out"
        self.master_path = self.tmp / "master.csv"
        self.write_master()

    # ---- fixtures
    def write_master(self, extra=()):
        with open(self.master_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["F&B Name", "Registered Business Name", "SFA Licence", "Menu URL", "Full Address"])
            for lic, (name, url) in MASTER.items():
                w.writerow([name, "", lic, url, ""])
            for r in extra:
                w.writerow(r)

    def write_inputs(self, rows, crosswalk=(), review=(), raw_lines=(), review_raw=()):
        with open(self.inp / "menus_consolidated_2026-11-08.jsonl", "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r) + "\n")
            for line in raw_lines:
                f.write(line + "\n")
        with open(self.inp / "verified_crosswalk_menu_urls_2026-11-08.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["stall_licence_no", "stall_name", "matched_menu_url"])
            for lic in crosswalk:
                w.writerow([lic, "x", "https://foodpanda.sg/restaurant/zz/x"])
        with open(self.inp / "review_list_2026-11-08.jsonl", "w", encoding="utf-8") as f:
            for rec in review:
                f.write(json.dumps(rec) + "\n")
            for line in review_raw:
                f.write(line + "\n")
        (self.inp / "resolved_brand_menu_urls_2026-11-08.csv").write_text("stall_licence_no,resolved_menu_url\n", encoding="utf-8")
        (self.inp / "discovered_website_menu_urls_2026-11-08.csv").write_text("", encoding="utf-8")

    def run_main(self, *extra, write=True, free_fn=None):
        argv = ["--input-dir", str(self.inp), "--master", str(self.master_path), "--out-dir", str(self.out), *extra]
        if write:
            argv.append("--write")
        kw = {"free_fn": free_fn} if free_fn else {}
        buf, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(err):
            code = q.main(argv, **kw)
        return code, buf.getvalue()

    def out_rows(self):
        rows = {}
        for bucket, name in q.BUCKET_FILES.items():
            p = self.out / name
            rows[bucket] = [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines()] if p.exists() else []
        return rows

    def go(self, rows, *extra, **inputs):
        self.write_inputs(rows, **inputs)
        code, _ = self.run_main(*extra)
        self.assertEqual(code, 0)
        return self.out_rows()

    @staticmethod
    def find(rows, **match):
        hits = [r for b in rows.values() for r in b if all(r.get(k) == v for k, v in match.items())]
        assert len(hits) >= 1, (match, hits)
        return hits[0]


class ReasonCodes(Env):
    def test_crosswalk_positive_negative(self):
        rows = self.go([R("L_B1"), R("L_A1")], crosswalk=["L_B1"])
        self.assertIn("Q_CROSSWALK_LICENSE", self.find(rows, stall_licence_no="L_B1")["reason_codes"])
        self.assertNotIn("Q_CROSSWALK_LICENSE", self.find(rows, stall_licence_no="L_A1")["reason_codes"])
        self.assertTrue((self.out / "quarantined_crosswalk_menu_urls.csv").exists())
        report = json.loads((self.out / "report.json").read_text())
        self.assertEqual(report["crosswalk_file"]["rows"], 1)

    def test_unreported_batch(self):
        rows = self.go([R("L_B1", ts="2026-11-08T19:05:00Z"), R("L_A1", ts="2026-11-08T18:05:00Z", item="y")])
        self.assertIn("Q_UNREPORTED_BATCH", self.find(rows, stall_licence_no="L_B1")["reason_codes"])
        self.assertNotIn("Q_UNREPORTED_BATCH", self.find(rows, stall_licence_no="L_A1")["reason_codes"])

    def test_review_licence_both_reason_keys(self):
        review = [{"stall_licence_no": "L_A1", "reason": "UNIT_MISMATCH"}, {"stall_licence_no": "L_B1", "rejection_reason": "BLOCKED"}]
        rows = self.go([R("L_A1"), R("L_B1"), R("L_E1")], review=review)
        self.assertEqual(self.find(rows, stall_licence_no="L_A1")["review_reason"], "UNIT_MISMATCH")
        self.assertEqual(self.find(rows, stall_licence_no="L_B1")["review_reason"], "BLOCKED")
        self.assertIn("Q_REVIEW_LICENCE", self.find(rows, stall_licence_no="L_B1")["reason_codes"])
        self.assertNotIn("Q_REVIEW_LICENCE", self.find(rows, stall_licence_no="L_E1")["reason_codes"])

    def test_bad_review_line_counted(self):
        self.write_inputs([R("L_A1")], review_raw=["{not json"])
        code, _ = self.run_main("--max-error-rate", "0.9")
        self.assertEqual(code, 0)
        errs = (self.out / "errors.jsonl").read_text().splitlines()
        self.assertEqual(len(errs), 1)
        self.assertEqual(json.loads(errs[0])["file"], "review_list_2026-11-08.jsonl")

    def test_no_licence_empty_unknown_and_multi_cell_splitting(self):
        rows = self.go([R("", item="a", url=U("zz")), R("L_NOPE", item="b", url=U("zz")),
                        R("L_A1; L_A2", item="c", url=A1URL), R("L_A1; L_NOPE", item="d", url=A1URL),
                        R("L_E1", item="e")])
        codes = lambda item: self.find(rows, item_name=item)["reason_codes"]  # noqa: E731
        self.assertIn("Q_NO_LICENCE", codes("a"))
        self.assertIn("Q_NO_LICENCE", codes("b"))
        self.assertNotIn("Q_NO_LICENCE", codes("c"))
        self.assertIn("Q_NO_LICENCE", codes("d"))
        self.assertNotIn("Q_NO_LICENCE", codes("e"))

    def test_url_owned_by_other_licence_and_exceptions(self):
        rows = self.go([
            R("L_B1", item="other", url=A1URL),                 # A1's URL on B1
            R("L_A1", item="own"),                                   # own URL
            R("L_S1", item="samebrand"),                             # shared by S1+S2, same brand, own licence lists it
            R("L_C1", item="unrelated"),                             # shared by C1+D1, different brands
            R("L_E1", item="blank", url=""),                         # not any licence's URL
            R("L_F1", item="foreign", url="https://nowhere.example/m"),
        ])
        c = lambda item: self.find(rows, item_name=item)["reason_codes"]  # noqa: E731
        self.assertIn("Q_URL_OWNED_BY_OTHER_LICENCE", c("other"))
        self.assertEqual(c("own"), [])
        self.assertEqual(self.find(rows, item_name="own")["bucket"], "KEEP_CONDITIONAL")
        self.assertNotIn("Q_URL_OWNED_BY_OTHER_LICENCE", c("samebrand"))
        self.assertEqual(c("samebrand"), [])
        self.assertIn("Q_URL_OWNED_BY_OTHER_LICENCE", c("unrelated"))
        self.assertEqual(c("blank"), ["Q_URL_NOT_OWN_MASTER_URL"])
        self.assertEqual(c("foreign"), ["Q_URL_NOT_OWN_MASTER_URL"])

    def test_same_brand_url_policy_sidecar(self):
        batch = [R("L_A3", item="brandrow", url=A1URL, source="brand_official_site", ts="2026-11-08T18:01:00Z")]
        strict = self.go(batch)
        self.assertEqual(self.find(strict, item_name="brandrow")["bucket"], "QUARANTINE")
        self.assertIn("Q_URL_OWNED_BY_OTHER_LICENCE", self.find(strict, item_name="brandrow")["reason_codes"])
        self.tearDown(); self.setUp()  # fresh dirs
        sidecar = self.go(batch, "--same-brand-url-policy", "sidecar")
        row = self.find(sidecar, item_name="brandrow")
        self.assertEqual(row["bucket"], "DOWNGRADE")
        self.assertEqual(row["reason_codes"], ["D_BRAND_COPY"])

    def test_shared_dish_set_unrelated_vs_same_brand(self):
        rows = self.go(five("L_E1", "Zed") + five("L_F1", "Zed") + five("L_A1", "Yak") + five("L_A2", "Yak") + five("L_N1", "Xi")[:4] + five("L_B1", "Xi")[:4])
        self.assertIn("Q_SHARED_DISH_SET_UNRELATED", self.find(rows, stall_licence_no="L_E1")["reason_codes"])
        self.assertIn("Q_SHARED_DISH_SET_UNRELATED", self.find(rows, stall_licence_no="L_F1")["reason_codes"])
        a1 = self.find(rows, stall_licence_no="L_A1")
        self.assertNotIn("Q_SHARED_DISH_SET_UNRELATED", a1["reason_codes"])
        self.assertIn("D_BRAND_COPY", a1["reason_codes"])
        self.assertEqual(a1["bucket"], "DOWNGRADE")
        self.assertEqual(self.find(rows, stall_licence_no="L_N1")["reason_codes"], [])  # identical but only 4 dishes: not flagged

    def test_wrong_source_host(self):
        cases = [("https://linktr.ee/bravo", "foodpanda", True), ("https://chateraisesg.getz.co/menu", "brand_official_site", True),
                 ("https://cdn.shopify.com/s/files/menu.pdf", "brand_official_site", True), ("https://bravo.example/menu.pdf", "brand_official_site", True),
                 ("https://shop.tabsquare.ai/order", "foodpanda", True), ("https://foodpanda.sg/restaurant/q/z", "brand_official_site", True),
                 ("https://foodpanda.sg/restaurant/q/z", "foodpanda", False), ("https://bravo.example/menu", "brand_official_site", False)]
        rows = self.go([R("L_B1", item=f"i{n}", url=u, source=s) for n, (u, s, _) in enumerate(cases)])
        for n, (u, s, expect) in enumerate(cases):
            with self.subTest(url=u, source=s):
                self.assertEqual("R_WRONG_SOURCE_HOST" in self.find(rows, item_name=f"i{n}")["reason_codes"], expect)

    def test_wrong_source_host_audit_seeds(self):
        rows = self.go([R("CE10G68E000", item="ara", url="https://arabica.sg/arabica-store/arabica-singapore-313-somerset/", source="brand_official_site"),
                        R("CE10G68E000", item="ara2", url="https://arabica.sg/arabica-store/arabica-singapore-nex/", source="brand_official_site")])
        self.assertIn("R_WRONG_SOURCE_HOST", self.find(rows, item_name="ara")["reason_codes"])
        self.assertNotIn("R_WRONG_SOURCE_HOST", self.find(rows, item_name="ara2")["reason_codes"])

    def test_brand_domains_allow_list(self):
        bd = self.tmp / "brand_domains.json"
        bd.write_text(json.dumps({"Bravo Noodles": ["bravo.example"]}))
        rows = self.go([R("L_B1", item="ok", url="https://www.bravo.example/menu", source="brand_official_site"),
                        R("L_B1", item="bad", url="https://other.example/menu", source="brand_official_site"),
                        R("L_B1", item="owner_ok_linktree", url="https://bravo.example/x", source="brand_official_site")], "--brand-domains", str(bd))
        self.assertNotIn("R_WRONG_SOURCE_HOST", self.find(rows, item_name="ok")["reason_codes"])
        self.assertIn("R_WRONG_SOURCE_HOST", self.find(rows, item_name="bad")["reason_codes"])
        self.tearDown(); self.setUp()
        bd = self.tmp / "brand_domains.json"
        bd.write_text(json.dumps({"Bravo Noodles": "linktr.ee"}))  # owner explicitly allows the link-in-bio host
        rows = self.go([R("L_B1", item="lt", url="https://linktr.ee/bravo", source="brand_official_site")], "--brand-domains", str(bd))
        self.assertNotIn("R_WRONG_SOURCE_HOST", self.find(rows, item_name="lt")["reason_codes"])

    def test_no_price_brand(self):
        null5 = [R("L_N1", f"n{i}", None, source="brand_official_site") for i in range(5)]
        null4 = [R("L_E1", f"e{i}", None, source="brand_official_site") for i in range(4)]
        priced = [R("L_F1", f"f{i}", 3.0 + i, source="brand_official_site") for i in range(5)]
        platform = [R("L_A1", f"a{i}", None, source="foodpanda") for i in range(5)]
        rows = self.go(null5 + null4 + priced + platform)
        self.assertIn("R_NO_PRICE_BRAND", self.find(rows, stall_licence_no="L_N1")["reason_codes"])
        self.assertEqual(self.find(rows, stall_licence_no="L_N1")["bucket"], "RE-SOURCE")
        for lic in ("L_E1", "L_F1", "L_A1"):
            self.assertNotIn("R_NO_PRICE_BRAND", self.find(rows, stall_licence_no=lic)["reason_codes"], lic)
        self.assertIsNone(self.find(rows, stall_licence_no="L_N1")["price_sgd"])

    def test_brand_copy_both_rules(self):
        rows = self.go([
            R("L_B1", item="site", source="brand_official_site", ts="2026-11-08T18:01:00Z", url="https://bravo.example/m"),  # rule 1
            R("L_A1", item="Kopi", price=1.5), R("L_A2", item="Kopi", price=1.5),                                         # rule 2
            R("L_A1", item="Teh", price=1.5), R("L_A2", item="Teh", price=2.0),                                           # different price
        ])
        self.assertEqual(self.find(rows, item_name="site")["reason_codes"], ["D_BRAND_COPY"])
        for lic in ("L_A1", "L_A2"):
            self.assertIn("D_BRAND_COPY", self.find(rows, stall_licence_no=lic, item_name="Kopi")["reason_codes"])
            self.assertNotIn("D_BRAND_COPY", self.find(rows, stall_licence_no=lic, item_name="Teh")["reason_codes"])
        down = self.find(rows, item_name="site")
        self.assertEqual(down["catalogue_scope"], "brand")
        self.assertIs(down["verified"], False)

    def test_bucket_severity_ordering(self):
        t18 = dict(source="brand_official_site", ts="2026-11-08T18:01:00Z")
        rows = self.go([
            R("L_B1", item="all3", url="https://linktr.ee/b", **t18),          # Q (crosswalk) + R + D
            R("L_E1", item="rd", url="https://linktr.ee/e", **t18),            # R + D
            R("L_F1", item="d", url="https://ffff.example/m", **t18),          # D
            R("L_N1", item="none"),                                            # nothing
        ], crosswalk=["L_B1"])
        self.assertEqual(self.find(rows, item_name="all3")["bucket"], "QUARANTINE")
        self.assertEqual(self.find(rows, item_name="all3")["reason_codes"], ["D_BRAND_COPY", "Q_CROSSWALK_LICENSE", "R_WRONG_SOURCE_HOST"])
        self.assertEqual(self.find(rows, item_name="rd")["bucket"], "RE-SOURCE")
        self.assertEqual(self.find(rows, item_name="d")["bucket"], "DOWNGRADE")
        self.assertEqual(self.find(rows, item_name="none")["bucket"], "KEEP_CONDITIONAL")
        self.assertEqual(q.bucket_for([]), "KEEP_CONDITIONAL")
        self.assertEqual(q.bucket_for(["D_BRAND_COPY", "R_NO_PRICE_BRAND"]), "RE-SOURCE")


class Hygiene(Env):
    def test_price_flags_and_null_stays_null(self):
        rows = self.go([R("L_N1", "cheap", 0.2), R("L_N1", "dear", 250), R("L_N1", "fine", 5.0), R("L_N1", "nullp", None)])
        self.assertIs(self.find(rows, item_name="cheap")["price_review"], True)
        self.assertEqual(self.find(rows, item_name="cheap")["price_sgd"], 0.2)  # never altered
        self.assertIs(self.find(rows, item_name="dear")["price_review"], True)
        self.assertNotIn("price_review", self.find(rows, item_name="fine"))
        self.assertIsNone(self.find(rows, item_name="nullp")["price_sgd"])
        self.assertNotIn("price_review", self.find(rows, item_name="nullp"))

    def test_dedupe_keeps_first_and_counts(self):
        rows = self.go([R("L_N1", "Nasi  Lemak", 5.0, description="first"), R("L_N1", "nasi lemak", 5.0, description="second"),
                        R("L_N1", "Nasi Lemak", 6.0, description="other price"), R("L_N1", "Nasi Lemak", None), R("L_N1", "Nasi Lemak", None)])
        got = [r["description"] for r in rows["KEEP_CONDITIONAL"] if r["item_name"].lower().startswith("nasi")]
        self.assertEqual(sorted(got), ["", "first", "other price"])
        report = json.loads((self.out / "report.json").read_text())
        self.assertEqual(report["buckets"]["KEEP_CONDITIONAL"]["duplicates_removed"], 2)
        self.assertEqual(report["buckets"]["KEEP_CONDITIONAL"]["written"], 3)

    def test_entity_decoding_and_trim(self):
        rows = self.go([R("L_N1", "  Fish &amp; Chips ", description="Tom &amp;amp; Jerry  \n"), R("L_N1", " plain ", description="x")])
        r = self.find(rows, item_name="Fish & Chips")
        self.assertEqual(r["description"], "Tom & Jerry")
        self.assertIn("item_name:html_entities_decoded", r["fixes"])
        self.assertIn("description:html_entities_decoded", r["fixes"])
        self.assertIn("item_name:whitespace_trimmed", self.find(rows, item_name="plain")["fixes"])

    def test_image_params_stripped_and_thumbnail_flagged_not_invented(self):
        self.assertEqual(q.strip_image_params("https://i.example/a.jpg?width=128&height=128&itok=Zx&v=3"), ("https://i.example/a.jpg?v=3", ["width", "height", "itok"]))
        self.assertEqual(q.strip_image_params("https://i.example/a.jpg?w=1"), ("https://i.example/a.jpg", ["w"]))
        self.assertEqual(q.strip_image_params("https://i.example/a.jpg"), ("https://i.example/a.jpg", []))
        drupal = "https://i.example/sites/styles/medium/public/a.jpg?itok=abc"
        wix = "https://static.wixstatic.com/media/a.jpg/v1/fill/w_320,h_320,al_c/a.jpg"
        full = "https://i.example/a.jpg?width=640"
        rows = self.go([R("L_N1", "drupal", image_url=drupal), R("L_N1", "wix", image_url=wix), R("L_N1", "full", image_url=full)])
        d = self.find(rows, item_name="drupal")
        self.assertEqual(d["image_url"], "https://i.example/sites/styles/medium/public/a.jpg")  # query stripped, path NOT rewritten
        self.assertIs(d["image_thumbnail"], True)
        self.assertIs(self.find(rows, item_name="wix")["image_thumbnail"], True)
        self.assertEqual(self.find(rows, item_name="wix")["image_url"], wix)
        f = self.find(rows, item_name="full")
        self.assertEqual(f["image_url"], "https://i.example/a.jpg")
        self.assertNotIn("image_thumbnail", f)

    def test_timestamp_handling(self):
        self.assertEqual(q.normalise_timestamp("14-07-2026"), ("2026-07-14", "crawl_timestamp:legacy_date_to_iso_date", True))
        self.assertEqual(q.normalise_timestamp("2026-11-05 11:39:22"), ("2026-11-05T11:39:22", "crawl_timestamp:space_to_T", True))
        self.assertEqual(q.normalise_timestamp("2026-11-08T18:11:54.365742"), ("2026-11-08T18:11:54.365742", None, True))
        self.assertEqual(q.normalise_timestamp("2026-11-08T18:36:00Z"), ("2026-11-08T18:36:00Z", None, False))
        self.assertEqual(q.normalise_timestamp("2026-11-08T18:36:00+08:00")[2], False)
        self.assertEqual(q.normalise_timestamp("32-13-2026")[1], "crawl_timestamp:unrecognised_format")
        row = R("L_N1", ts="14-07-2026")
        fixes = []
        q.hygiene(row, "KEEP_CONDITIONAL", fixes)
        self.assertEqual((row["crawl_timestamp"], row["crawl_timestamp_raw"], row["timestamp_tz_missing"]), ("2026-07-14", "14-07-2026", True))
        rows = self.go([R("L_N1", "naive", ts="2026-11-05 11:39:22"), R("L_E1", "zulu", ts="2026-11-05T11:39:22Z")])
        self.assertEqual(self.find(rows, item_name="naive")["crawl_timestamp"], "2026-11-05T11:39:22")
        self.assertIs(self.find(rows, item_name="naive")["timestamp_tz_missing"], True)
        self.assertNotIn("timestamp_tz_missing", self.find(rows, item_name="zulu"))

    def test_verified_false_basis_and_source_type_on_every_output_row(self):
        rows = self.go([R("L_N1", "kept"), R("L_B1", "quar", source="brand_official_site", url="https://bravo.example/m"), R("", "nolic", source="web")],
                       crosswalk=["L_B1"])
        for r in (self.find(rows, item_name=i) for i in ("kept", "quar", "nolic")):
            self.assertIs(r["verified"], False)
            self.assertEqual(r["price_basis"], "unknown")
        self.assertIn("verified:reset_to_false", self.find(rows, item_name="kept")["fixes"])
        self.assertEqual(self.find(rows, item_name="kept")["source_type"], "delivery_platform")
        self.assertEqual(self.find(rows, item_name="quar")["source_type"], "official_site")
        self.assertEqual(self.find(rows, item_name="nolic")["source_type"], "unknown")


class LegacySlice(Env):
    def test_legacy_rows_untouched_except_no_licence(self):
        legacy = [R("L_A1", "blankurl", url="", ts="14-07-2026"),
                  R("L_A2", "disclaimer", ts="14-07-2026", description="Menu item and price not independently verified; do not publish"),
                  R("L_B1", "clean", ts="14-07-2026"),
                  R("", "nolic", url="", ts="14-07-2026", description="&amp; keep")]
        rows = self.go(legacy + [R("L_E1", "new")])
        flat = [r["item_name"] for b in rows.values() for r in b]
        self.assertEqual(sorted(flat), ["new", "nolic"])
        nolic = self.find(rows, item_name="nolic")
        self.assertEqual(nolic["bucket"], "QUARANTINE")
        self.assertEqual(nolic["slice"], "legacy")
        self.assertEqual(nolic["description"], "&amp; keep")        # old row text not rewritten
        self.assertEqual(nolic["crawl_timestamp"], "14-07-2026")     # nor its date
        report = json.loads((self.out / "report.json").read_text())
        ls = report["legacy_slice"]
        self.assertEqual((ls["legacy_verified_false_needed"], ls["legacy_blank_source_url"], ls["legacy_disclaimer"]), (3, 2, 1))
        self.assertEqual(report["totals"]["legacy_rows"], 4)


class Safety(Env):
    def snapshot(self, root):
        return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path(root).rglob("*")) if p.is_file()}

    def test_dry_run_writes_nothing(self):
        self.write_inputs([R("L_N1")])
        before = self.snapshot(self.tmp)
        code, out = self.run_main(write=False)
        self.assertEqual(code, 0)
        self.assertIn("DRY RUN", out)
        self.assertFalse(self.out.exists())
        self.assertEqual(before, self.snapshot(self.tmp))

    def test_refuses_output_inside_git_repo(self):
        repo = self.tmp / "repo"
        (repo / ".git").mkdir(parents=True)
        self.out = repo / "deep" / "out"
        self.write_inputs([R("L_N1")])
        for write in (True, False):
            code, _ = self.run_main(write=write)
            self.assertEqual(code, 2)
        self.assertFalse(self.out.exists())

    def test_refuses_output_overlapping_sources(self):
        self.write_inputs([R("L_N1")])
        for bad in (self.inp, self.inp / "sub", self.tmp):  # equals source dir, inside it, contains it
            self.out = bad
            before = self.snapshot(self.tmp)
            code, _ = self.run_main()
            self.assertEqual(code, 2, bad)
            self.assertEqual(before, self.snapshot(self.tmp))
        self.assertFalse((self.inp / "sub").exists())

    def test_sources_are_never_modified(self):
        self.write_inputs([R("L_N1"), R("", "x")], crosswalk=["L_B1"])
        before = self.snapshot(self.tmp)
        mtimes = {p: p.stat().st_mtime_ns for p in list(self.inp.iterdir()) + [self.master_path]}
        self.assertEqual(self.run_main()[0], 0)
        after = self.snapshot(self.tmp)
        self.assertEqual({k: v for k, v in before.items()}, {k: v for k, v in after.items() if not k.startswith("out")})
        self.assertEqual(mtimes, {p: p.stat().st_mtime_ns for p in mtimes})

    def test_atomic_write_failure_leaves_nothing(self):
        self.write_inputs([R("L_N1"), R("L_E1")])
        real = os.replace

        def flaky(src, dst, *a, **k):
            if Path(dst).name == "report.json":
                raise OSError("disk exploded")
            return real(src, dst, *a, **k)
        with mock.patch.object(q.os, "replace", flaky):
            with self.assertRaises(OSError):
                self.run_main()
        self.assertEqual(sorted(p.name for p in self.out.iterdir()), [])  # no outputs, no temp files, no backups

    def test_atomic_failure_restores_previous_outputs(self):
        self.write_inputs([R("L_N1")])
        self.assertEqual(self.run_main()[0], 0)
        before = self.snapshot(self.out)
        real, calls = os.replace, []

        def flaky(src, dst, *a, **k):
            if Path(dst).name == "report.md" and not calls:
                calls.append(1)
                raise OSError("boom")  # fails once; the rollback's own os.replace calls must still work
            return real(src, dst, *a, **k)
        with mock.patch.object(q.os, "replace", flaky):
            with self.assertRaises(OSError):
                self.run_main()
        self.assertEqual(before, self.snapshot(self.out))
        self.assertFalse([p for p in self.out.iterdir() if p.name.startswith(".")])

    def test_idempotent_rerun_is_byte_identical_except_run_json(self):
        self.write_inputs(five("L_A1") + five("L_A2") + [R("", "x"), R("L_N1", "m &amp; n")], crosswalk=["L_B1"])
        self.assertEqual(self.run_main()[0], 0)
        first = self.snapshot(self.out)
        run1 = json.loads((self.out / "run.json").read_text())
        self.assertEqual(self.run_main()[0], 0)
        second = self.snapshot(self.out)
        run2 = json.loads((self.out / "run.json").read_text())
        first.pop("run.json"), second.pop("run.json")
        self.assertEqual(first, second)
        self.assertNotEqual(run1["run_id"], run2["run_id"])
        self.assertEqual(sorted(p.name for p in self.out.iterdir()), sorted(set(first) | {"run.json"}))

    def test_low_disk_refuses(self):
        self.write_inputs([R("L_N1")])
        code, _ = self.run_main(free_fn=lambda p: 10)
        self.assertEqual(code, 3)
        self.assertFalse(self.out.exists())
        code, _ = self.run_main(write=False, free_fn=lambda p: 10)
        self.assertEqual(code, 3)
        total = sum(p.stat().st_size for p in list(self.inp.iterdir()) + [self.master_path])
        code, _ = self.run_main(free_fn=lambda p: 3 * total - 1)
        self.assertEqual(code, 3)
        code, _ = self.run_main(free_fn=lambda p: 3 * total)
        self.assertEqual(code, 0)

    def test_error_rate_threshold(self):
        many = [R("L_N1", f"i{i}", 1.0 + i / 100) for i in range(2000)]
        self.write_inputs(many, raw_lines=["{broken"])
        code, _ = self.run_main()
        self.assertEqual(code, 0)  # 1/2001 < 0.1%
        errs = [json.loads(l) for l in (self.out / "errors.jsonl").read_text().splitlines()]
        self.assertEqual([(e["file"], e["line"]) for e in errs], [("menus_consolidated_2026-11-08.jsonl", 2001)])
        self.tearDown(); self.setUp()
        self.write_inputs([R("L_N1"), R("L_E1")], raw_lines=["{broken", "[1,2]"])
        code, _ = self.run_main()
        self.assertEqual(code, 5)
        self.assertEqual(sorted(p.name for p in self.out.iterdir()), ["errors.jsonl"])  # no bucket files on a failed run
        self.assertEqual(len((self.out / "errors.jsonl").read_text().splitlines()), 2)

    def test_manifest_records_hashes_and_script_provenance(self):
        self.write_inputs([R("L_N1")])
        self.assertEqual(self.run_main()[0], 0)
        man = json.loads((self.out / "manifest.json").read_text())
        for key, path in (("menus", self.inp / "menus_consolidated_2026-11-08.jsonl"), ("master", self.master_path)):
            self.assertEqual(man["inputs"][key]["sha256"], hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertTrue(man["inputs_unchanged_after_run"])
        self.assertIn("git_head", man["script"])
        self.assertEqual(len(man["script"]["script_sha256"]), 64)

    def test_mismatches_are_printed_loudly(self):
        self.write_inputs([R("L_N1")])
        _, out = self.run_main(write=False)
        self.assertIn("!!! MISMATCH menus.rows", out)


class BrandCatalogueTests(Env):
    def cat(self):
        p = self.out / "brand_catalogue.jsonl"
        return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines()]

    def test_catalogue_dedupes_across_outlets_and_counts_outlets(self):
        t18 = dict(source="brand_official_site", ts="2026-11-08T18:01:00Z", url=A1URL)
        self.go([R("L_A1", "Kopi", 1.5, **t18), R("L_A2", "kopi ", 1.5, **t18), R("L_A1", "Kopi", 1.5, **t18), R("L_A1", "Teh", 1.5, **t18),
                 R("L_A2", "Teh", 2.0, **t18), R("L_A1", "Solo", 3.0, **t18)], "--same-brand-url-policy", "sidecar")
        rows = {(r["item_name"].strip().lower(), r["price_sgd"]): r for r in self.cat()}
        kopi = rows[("kopi", 1.5)]
        self.assertEqual((kopi["brand"], kopi["outlet_licences"], kopi["outlet_count"]), ("alpha cafe", ["L_A1", "L_A2"], 2))
        self.assertEqual(kopi["catalogue_scope"], "brand")
        self.assertIs(kopi["verified"], False)
        self.assertEqual(kopi["price_basis"], "unknown")
        self.assertTrue(kopi["source_url"] and kopi["crawl_timestamp"])
        self.assertEqual(len([r for r in self.cat() if r["item_name"] == "Kopi"]), 1)   # one row per brand+dish+price
        self.assertEqual(rows[("teh", 1.5)]["outlet_licences"], ["L_A1"])
        self.assertEqual(rows[("teh", 2.0)]["outlet_licences"], ["L_A2"])              # different price = different row
        self.assertEqual(rows[("solo", 3.0)]["outlet_count"], 1)
        stats = json.loads((self.out / "report.json").read_text())["brand_catalogue"]
        self.assertEqual((stats["rows"], stats["brands"], stats["brands_with_price_conflicts"]), (4, 1, 1))
        self.assertEqual(stats["top_brands_by_outlet_count"][0], {"brand": "alpha cafe", "outlet_count": 2, "rows": 4})
        self.assertIn("by brand key only", (self.out / "report.md").read_text())

    def test_outlet_map_lookup_by_brand_key(self):
        self.go([R("L_A1", "Kopi", 1.5), R("L_A2", "Kopi", 1.5), R("L_A1", "Teh", 1.5), R("L_A2", "Teh", 1.5)])  # rule-2 copies (same price)
        with open(self.out / "brand_outlet_map.csv", newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual([(r["licence"], r["outlet_name"], r["brand_key"], r["catalogue_row_count"]) for r in rows],
                         [("L_A1", "Alpha Cafe (Bedok)", "alpha cafe", "2"), ("L_A2", "Alpha Cafe (Tampines)", "alpha cafe", "2")])

    def test_wrong_host_quarantined_and_review_rows_never_reach_catalogue(self):
        t18 = dict(source="brand_official_site", ts="2026-11-08T18:01:00Z")
        rows = self.go([R("L_B1", "Wrong", 2.0, url="https://linktr.ee/b", **t18), R("L_E1", "Wrong", 2.0, url="https://cdn.shopify.com/m.pdf", **t18),
                        R("L_F1", "Good", 2.0, url="https://ffff.example/m", **t18), R("L_N1", "Xwalk", 2.0, url="https://nnnn.example/m", **t18)],
                       crosswalk=["L_N1"])
        self.assertEqual(self.find(rows, item_name="Wrong", stall_licence_no="L_B1")["bucket"], "RE-SOURCE")
        self.assertEqual(self.find(rows, item_name="Wrong", stall_licence_no="L_E1")["bucket"], "RE-SOURCE")
        self.assertEqual([r["item_name"] for r in self.cat()], ["Good"])
        with open(self.out / "brand_outlet_map.csv", newline="", encoding="utf-8") as f:
            self.assertEqual([r["licence"] for r in csv.DictReader(f)], ["L_F1"])

    def test_catalogue_priceless_brand_counted(self):
        t18 = dict(source="brand_official_site", ts="2026-11-08T18:01:00Z")
        self.go([R("L_F1", f"f{i}", None, url="https://ffff.example/m", **t18) for i in range(2)] + [R("L_F1", "f9", 4.0, url="https://ffff.example/m", **t18)])
        self.assertEqual(json.loads((self.out / "report.json").read_text())["brand_catalogue"]["brands_mostly_priceless"], 1)

    def test_catalogue_files_are_idempotent(self):
        self.write_inputs([R("L_A1", "Kopi", 1.5), R("L_A2", "Kopi", 1.5)])
        self.assertEqual(self.run_main()[0], 0)
        first = {n: (self.out / n).read_bytes() for n in ("brand_catalogue.jsonl", "brand_outlet_map.csv")}
        self.assertTrue(all(first.values()))
        self.assertEqual(self.run_main()[0], 0)
        self.assertEqual(first, {n: (self.out / n).read_bytes() for n in first})

    def test_output_in_subfolder_of_existing_output_dir(self):
        self.out = self.tmp / "strict"
        self.write_inputs([R("L_A1", "Kopi", 1.5), R("L_A2", "Kopi", 1.5)])
        self.assertEqual(self.run_main()[0], 0)
        before = {p.name: p.read_bytes() for p in self.out.iterdir() if p.is_file()}
        self.out = self.tmp / "strict" / "sidecar"
        self.assertEqual(self.run_main("--same-brand-url-policy", "sidecar")[0], 0)
        self.assertTrue((self.out / "brand_catalogue.jsonl").exists())
        self.assertEqual(before, {p.name: p.read_bytes() for p in (self.tmp / "strict").iterdir() if p.is_file()})


class FullNameBrandIdentity(Env):
    def keymap(self):
        with open(self.out / "brand_key_map.csv", newline="", encoding="utf-8") as f:
            return {r["licence"]: r for r in csv.DictReader(f)}

    def test_core_name_strips_outlet_qualifiers_but_keeps_distinguishing_words(self):
        places = frozenset({"jewel changi airport", "funan", "bedok mall"})
        cases = {
            "Two Men Bagel House - Plaza Singapura": "two men bagel house", "TWO MEN BAGEL HOUSE (Bedok Mall)": "two men bagel house",
            "Fun Toast @ Jewel": "fun toast", "Song Fa Bak Kut Teh": "song fa bak kut teh", "Luckin Coffee Outlet": "luckin coffee",
            "The Coffee Bean &amp; Tea Leaf (Singapore) Pte Ltd #01-23": "coffee bean and tea leaf", "Fun Toast Funan": "fun toast",
            "Fun Toast Jewel Changi Airport": "fun toast", "Kopi at Tampines Mall": "kopi", "Crêpe Maison Kiosk": "crepe maison",
            "% Arabica": "arabica", "Yong Yun Pte. Ltd.": "yong yun",
        }
        for raw, want in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(q.core_name(raw, places), want)
        self.assertIn("newton food centre", q.build_places(["500 CLEMENCEAU AVENUE NORTH #01-32,NEWTON FOOD CENTRE,Singapore 229495"]))
        self.assertIn("clemenceau avenue north", q.build_places(["500 CLEMENCEAU AVENUE NORTH #01-32,NEWTON FOOD CENTRE,Singapore 229495"]))

    def test_names_that_share_one_word_are_different(self):
        self.assertEqual(q.names_match("two men bagel house", "two men bagel house"), "NAME_EQUAL")
        self.assertIsNone(q.names_match("two men bagel house", "two bao shop"))
        self.assertIsNone(q.names_match("song fa bak kut teh", "song kee noodles"))
        self.assertIsNone(q.names_match("ajisen ramen", "ajisen tanjiro"))
        self.assertIsNone(q.names_match("luckin", "luckin coffee"))   # containing is not equal
        self.assertEqual(q.names_match("breadtalk", "bread talk"), "NAME_FUZZY")
        self.assertEqual(q.names_match("ps cafe", "pscafe"), "NAME_FUZZY")

    def rows3(self, lic, tag, **kw):
        return [R(lic, f"{tag} {i}", 3.0 + i, **kw) for i in range(3)]

    def test_keys_follow_full_names_and_need_corroboration(self):
        rows = (self.rows3("L_T1", "Bagel") + self.rows3("L_T2", "Bagel") + self.rows3("L_T3", "Bao")             # dish overlap corroborates T1+T2
                + self.rows3("L_G1", "Soup", source="brand_official_site", url="https://songfa.example/a", ts="2026-11-08T18:01:00Z")
                + self.rows3("L_G2", "Broth", source="brand_official_site", url="https://songfa.example/b", ts="2026-11-08T18:01:00Z")  # same host
                + self.rows3("L_G3", "Noodle", source="brand_official_site", url="https://songkee.example/m", ts="2026-11-08T18:01:00Z")
                + self.rows3("L_U1", "Kopi") + self.rows3("L_U2", "Teh"))                                        # equal names, nothing corroborates
        self.go(rows)
        km = self.keymap()
        self.assertEqual({km[l]["brand_key"] for l in ("L_T1", "L_T2")}, {"two men bagel house"})
        self.assertEqual(km["L_T3"]["brand_key"], "two bao shop")
        self.assertEqual(km["L_G1"]["brand_key"], km["L_G2"]["brand_key"])
        self.assertEqual(km["L_G1"]["brand_key"], "song fa bak kut teh")
        self.assertIn("CORROB_URL", km["L_G1"]["evidence_codes"])
        self.assertEqual(km["L_G3"]["brand_key"], "song kee noodles")
        self.assertIn("SHARES_FIRST_WORD:song", km["L_G3"]["evidence_codes"])
        self.assertEqual(km["L_G3"]["confidence"], "medium")
        self.assertEqual(km["L_T1"]["normalised_core"], "two men bagel house")
        self.assertNotEqual(km["L_U1"]["brand_key"], km["L_U2"]["brand_key"])        # equal names alone never merge
        self.assertEqual((km["L_U1"]["confidence"], km["L_U2"]["confidence"]), ("low", "low"))
        self.assertIn("NAME_EQUAL_UNCORROBORATED", km["L_U1"]["evidence_codes"])

    def test_review_file_shows_old_key_split_and_competing_names(self):
        self.go(self.rows3("L_T1", "Bagel") + self.rows3("L_T2", "Bagel") + self.rows3("L_T3", "Bao") + self.rows3("L_U1", "Kopi") + self.rows3("L_U2", "Teh"))
        with open(self.out / "brand_review.csv", newline="", encoding="utf-8") as f:
            review = list(csv.DictReader(f))
        split = [r for r in review if r["case_type"] == "OLD_KEY_SPLIT" and r["old_key"] == "two"][0]
        self.assertEqual(split["new_keys"], "two bao shop | two men bagel house")
        self.assertIn("Two Bao Shop", split["master_name"])
        low = {r["licence"]: r for r in review if r["case_type"] == "LICENCE_LOW"}
        self.assertIn("Uncorr Kopi (Two)", low["L_U1"]["competing_names"])
        report = json.loads((self.out / "report.json").read_text())["brand_identity"]
        self.assertIn("two", [x["old_key"] for x in report["split_old_keys"]])
        self.assertLess(report["old_keys_all"], report["new_keys_all"] + 1)
        template = json.loads((self.out / "brand_overrides.template.json").read_text())
        self.assertEqual((template["merge"], template["split"]), ([], []))
        self.assertTrue(all(c["decision"] == "" for c in template["review_cases"]))
        self.assertTrue(any(c["case_id"] == "split:two" for c in template["review_cases"]))

    def test_overrides_honoured(self):
        rows = self.rows3("L_U1", "Kopi") + self.rows3("L_U2", "Teh") + self.rows3("L_T1", "Bagel") + self.rows3("L_T2", "Bagel")
        ov = self.tmp / "brand_overrides.json"
        ov.write_text(json.dumps({"merge": [["L_U1", "uncorr kopi (two)"]], "split": [["L_T1", "TWO MEN BAGEL HOUSE (BEDOK*"]]}))
        self.go(rows, "--brand-overrides", str(ov))
        km = self.keymap()
        self.assertEqual(km["L_U1"]["brand_key"], km["L_U2"]["brand_key"])
        self.assertIn("OVERRIDE_MERGE", km["L_U1"]["evidence_codes"])
        self.assertNotEqual(km["L_T1"]["brand_key"], km["L_T2"]["brand_key"])    # dish overlap would have merged them
        self.assertIn("OVERRIDE_SPLIT", km["L_T1"]["evidence_codes"])
        man = json.loads((self.out / "manifest.json").read_text())
        self.assertEqual(man["inputs"]["brand_overrides"]["sha256"], hashlib.sha256(ov.read_bytes()).hexdigest())

    def test_first_word_mode_keeps_legacy_keys(self):
        self.go(self.rows3("L_T1", "Bagel") + self.rows3("L_T3", "Bao"), "--brand-identity", "first-word")
        km = self.keymap()
        self.assertEqual({km["L_T1"]["brand_key"], km["L_T3"]["brand_key"]}, {"two"})


class SharedMenuExceptions(Env):
    def setup_brand(self, extra=()):
        brand_dishes = [(f"Dish {i}", 2.0 + i) for i in range(10)]
        rows = [R(lic, n, p) for lic in ("L_A1", "L_A2") for n, p in brand_dishes]                 # same price at 2 outlets = brand baseline
        a4 = [R("L_A4", n, 9.9 if n == "Dish 1" else p) for n, p in brand_dishes[:8]]              # own page: one price differs, 2 dishes absent
        a4 += [R("L_A4", f"Special {i}", 4.0) for i in range(3)]                                   # items the brand menu lacks
        a5 = [R("L_A5", f"Dish {i}", 2.0 + i) for i in range(5)]                                   # short page: not a full menu
        self.go(rows + a4 + a5 + list(extra))
        with open(self.out / "outlet_exceptions.jsonl", encoding="utf-8") as f:
            return [json.loads(l) for l in f]

    def test_exception_types_and_evidence(self):
        exc = self.setup_brand()
        by = lambda t: [e for e in exc if e["type"] == t]  # noqa: E731
        diff = by("PRICE_DIFF")
        self.assertEqual([(e["licence"], e["dish"], e["outlet_price"], e["baseline_price"]) for e in diff], [("L_A4", "Dish 1", 9.9, 3.0)])
        self.assertEqual(sorted(e["dish"] for e in by("OUTLET_ONLY_ITEM")), [f"Special {i}" for i in range(3)])
        nope = by("NOT_OFFERED_CANDIDATE")
        self.assertEqual(sorted(e["dish"] for e in nope), [f"Dish {i}" for i in range(8, 10)])
        self.assertTrue(all(e["confidence"] == "low" and e["auto_apply"] is False and e["outlet_price"] is None for e in nope))
        self.assertEqual({e["licence"] for e in exc}, {"L_A4"})            # L_A5's short page never triggers NOT_OFFERED_CANDIDATE
        for e in exc:
            self.assertIs(e["verified"], False)
            self.assertEqual(e["price_basis"], "unknown")
            self.assertTrue(e["source_url"] and e["crawl_timestamp"])
        stats = json.loads((self.out / "report.json").read_text())["outlet_exceptions"]
        self.assertEqual(stats["by_type"], {"PRICE_DIFF": 1, "OUTLET_ONLY_ITEM": 3, "NOT_OFFERED_CANDIDATE": 2})

    def test_no_exceptions_without_outlet_level_evidence(self):
        t18 = dict(source="brand_official_site", ts="2026-11-08T18:01:00Z", url=A1URL)
        self.go([R("L_A1", "Kopi", 1.5, **t18), R("L_A2", "Kopi", 2.5, **t18)], "--same-brand-url-policy", "sidecar")   # brand-level rows only
        self.assertEqual((self.out / "outlet_exceptions.jsonl").read_text(), "")

    def test_price_conflicts_file_lists_all_prices_and_picks_none(self):
        t18 = dict(source="brand_official_site", ts="2026-11-08T18:01:00Z", url=A1URL)
        self.go([R("L_A1", "Kopi", 1.5, **t18), R("L_A2", "Kopi", 1.5, **t18), R("L_A5", "Kopi", 2.5, **t18), R("L_A1", "Teh", 1.0, **t18)],
                "--same-brand-url-policy", "sidecar")
        with open(self.out / "brand_price_conflicts.csv", newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]["brand"], rows[0]["dish"], rows[0]["prices_to_outlet_count"], rows[0]["spread"]), ("alpha cafe", "Kopi", "1.50->2 | 2.50->1", "1.00"))
        self.assertEqual(rows[0]["status"], "needs outlet-level confirmation")
        stats = json.loads((self.out / "report.json").read_text())["brand_price_conflicts"]
        self.assertEqual((stats["rows"], stats["brands"]), (1, 1))

    def test_resolution_labels_sources_and_warns(self):
        self.setup_brand()
        res = q.resolve_outlet(self.out, "L_A4")
        self.assertIn("NOT verified", res["header"][0])
        lines = {l["item_name"]: l for l in res["lines"]}
        self.assertEqual((lines["Dish 1"]["source"], lines["Dish 1"]["price_sgd"], lines["Dish 1"]["price_status"]), ("outlet_exception", 9.9, "outlet_exception"))
        self.assertEqual((lines["Dish 0"]["source"], lines["Dish 0"]["price_sgd"], lines["Dish 0"]["price_status"]), ("brand_shared", 2.0, "baseline"))
        self.assertEqual(lines["Special 0"]["source"], "outlet_exception")
        self.assertEqual(lines["Special 0"]["price_status"], "outlet_only")
        self.assertIn("Dish 9", lines)                                            # NOT_OFFERED_CANDIDATE is never applied: dish still listed
        self.assertTrue(lines["Dish 9"]["flags"] and lines["Dish 9"]["source"] == "brand_shared")
        self.assertTrue(all(l["verified"] is False and l["price_basis"] == "unknown" for l in res["lines"]))
        self.assertEqual(len(res["lines"]), 10 + 3)                               # 10 brand dishes + 3 outlet-only
        other = {l["item_name"]: l for l in q.resolve_outlet(self.out, "L_A1")["lines"]}
        self.assertEqual(other["Dish 1"]["source"], "brand_shared")               # another outlet does not inherit A4's exception
        self.assertNotIn("Special 0", other)

    def test_resolution_shows_conflicts_not_a_single_price(self):
        t18 = dict(source="brand_official_site", ts="2026-11-08T18:01:00Z", url=A1URL)
        self.go([R("L_A1", "Kopi", 1.5, **t18), R("L_A2", "Kopi", 2.5, **t18)], "--same-brand-url-policy", "sidecar")
        line = q.resolve_outlet(self.out, "L_A1")["lines"][0]
        self.assertEqual((line["source"], line["price_status"], line["price_sgd"], line["prices"]), ("brand_shared", "conflict", None, [1.5, 2.5]))
        text = q.format_resolution(q.resolve_outlet(self.out, "L_A1"))
        self.assertIn("WARNING", text)
        self.assertIn("conflict 1.50/2.50", text)

    def test_resolve_cli_is_read_only_and_rejects_unknown_licence(self):
        self.setup_brand()
        before = {p.name: p.read_bytes() for p in self.out.iterdir()}
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            self.assertEqual(q.main(["--resolve-outlet", "L_A4", "--out-dir", str(self.out)]), 0)
        self.assertIn("brand_shared", buf.getvalue())
        self.assertIn("outlet_exception", buf.getvalue())
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(q.main(["--resolve-outlet", "NOPE", "--out-dir", str(self.out)]), 2)
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.out.iterdir()})

    def test_rerun_is_byte_identical_for_all_new_files(self):
        self.setup_brand()
        names = ("brand_key_map.csv", "brand_review.csv", "brand_overrides.template.json", "outlet_exceptions.jsonl", "brand_price_conflicts.csv",
                 "brand_catalogue.jsonl", "brand_outlet_map.csv")
        first = {n: (self.out / n).read_bytes() for n in names}
        self.assertTrue(all(first[n] for n in ("brand_key_map.csv", "outlet_exceptions.jsonl", "brand_catalogue.jsonl")))
        self.assertEqual(self.run_main()[0], 0)
        self.assertEqual(first, {n: (self.out / n).read_bytes() for n in names})

    def test_v2_writes_only_inside_its_subfolder(self):
        self.out = self.tmp / "strict"
        self.write_inputs([R("L_A1", "Kopi", 1.5), R("L_A2", "Kopi", 1.5)])
        self.assertEqual(self.run_main()[0], 0)
        before = {p.name: p.read_bytes() for p in self.out.iterdir() if p.is_file()}
        self.out = self.tmp / "strict" / "sidecar_v2"
        self.assertEqual(self.run_main("--same-brand-url-policy", "sidecar")[0], 0)
        self.assertTrue((self.out / "outlet_exceptions.jsonl").exists())
        self.assertEqual(before, {p.name: p.read_bytes() for p in (self.tmp / "strict").iterdir() if p.is_file()})
        self.assertEqual(sorted(p.name for p in (self.tmp / "strict").iterdir() if p.is_dir()), ["sidecar_v2"])


class OldKeyNameReview(Env):
    def make_sidecar(self, rows, catalogue):
        sd = self.tmp / "sidecar"
        sd.mkdir()
        with open(sd / "brand_outlet_map.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["licence", "outlet_name", "brand_key", "catalogue_row_count", "observed_rows"])
            for lic, key in rows:
                w.writerow([lic, "", key, 1, 1])
        with open(sd / "brand_catalogue.jsonl", "w", encoding="utf-8") as f:
            for rec in catalogue:
                f.write(json.dumps(rec) + "\n")
        return sd

    def test_yes_needs_corroboration_never_names_alone(self):
        MASTER_EXTRA = {"F1": ("Fun Toast (Raffles)", ""), "F2": ("FUN TOAST - Funan", ""), "F3": ("Fun Palace", ""), "F4": ("Fun Toast (Orchard)", ""),
                        "F5": ("Fun Toast", "")}
        with open(self.master_path, "a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            for lic, (n, u) in MASTER_EXTRA.items():
                w.writerow([n, "", lic, u, ""])
        cat = lambda dish, lics, url: {"item_name": dish, "outlet_licences": lics, "source_url": url}  # noqa: E731
        catalogue = ([cat(f"Toast {i}", ["F1", "F2"], "https://funtoast.example/menu") for i in range(4)]       # F1,F2 share host + dishes
                     + [cat(f"Palace {i}", ["F3"], "https://funpalace.example/m") for i in range(3)]             # different name, no overlap
                     + [cat("Lonely", ["F4"], "https://elsewhere.example/a"), cat("Other", ["F5"], "https://else.example/b")])  # equal names, no signal
        sd = self.make_sidecar([(l, "fun") for l in ("F1", "F2", "F3", "F4", "F5")], catalogue)
        out = self.tmp / "sidecar" / "brand_name_review_test.csv"
        summary = q.run_old_key_review(sd, self.master_path, out)
        with open(out, newline="", encoding="utf-8") as fh:
            rows = {r["licence"]: r for r in csv.DictReader(fh)}
        self.assertEqual(rows["F1"]["same_brand_as_key_anchor"], "yes")
        self.assertIn("same source host", rows["F1"]["reason"])
        self.assertIn("dish overlap 1.00", rows["F1"]["reason"])
        self.assertEqual(rows["F2"]["same_brand_as_key_anchor"], "yes")
        self.assertEqual(rows["F3"]["same_brand_as_key_anchor"], "no")
        self.assertIn("shares only first word 'fun'", rows["F3"]["reason"])
        for lic in ("F4", "F5"):                                              # equal core names, nothing corroborates: never "yes" on names alone
            self.assertEqual(rows[lic]["same_brand_as_key_anchor"], "uncertain", lic)
            self.assertIn("no corroborating signal", rows[lic]["reason"])
            self.assertEqual(rows[lic]["needs_owner_review"], "TRUE")
        self.assertEqual(rows["F1"]["first_word_key_flag"], "TRUE")            # 'fun' is generic and 2 core names sit under it
        self.assertEqual(rows["F1"]["distinct_core_names_under_key"], "2")
        self.assertEqual(rows["F3"]["suggested_new_brand_key"], "fun palace")
        self.assertEqual(rows["F1"]["suggested_new_brand_key"], "fun toast")
        self.assertEqual(summary["rows"], 5)

    def test_new_file_only_never_overwrites(self):
        sd = self.make_sidecar([("L_B1", "bravo")], [{"item_name": "x", "outlet_licences": ["L_B1"], "source_url": ""}])
        existing = sd / "brand_name_review_2026-11-08.csv"
        existing.write_text("keep me")
        with self.assertRaises(q.QuarantineError):
            q.run_old_key_review(sd, self.master_path, existing)
        self.assertEqual(existing.read_text(), "keep me")
        self.assertEqual(sorted(p.name for p in sd.iterdir() if p.name.startswith(".")), [])   # no temp files left behind


class Helpers(unittest.TestCase):
    def test_brand_key(self):
        self.assertEqual(q.brand_key("% Arabica"), "arabica")
        self.assertEqual(q.brand_key("The Coffee Bean (Orchard)"), "coffee")
        self.assertEqual(q.brand_key("McDonald's Jurong"), "mcdonalds")
        self.assertEqual(q.brand_key("#87 Just Thai"), "87just")
        self.assertEqual(q.brand_key(""), "")

    def test_norm_url_and_split(self):
        self.assertEqual(q.norm_url("HTTPS://www.Example.com/a/?x=1#f"), "example.com/a?x=1")
        self.assertEqual(q.norm_url("http://example.com/a"), q.norm_url("https://www.example.com/a/"))
        self.assertEqual(q.split_licences(" A1;B2 ;; C3 "), ["A1", "B2", "C3"])
        self.assertEqual(q.split_licences(None), [])

    def test_price_of(self):
        self.assertIsNone(q.price_of({"price_sgd": None}))
        self.assertIsNone(q.price_of({"price_sgd": ""}))
        self.assertIsNone(q.price_of({"price_sgd": True}))
        self.assertEqual(str(q.price_of({"price_sgd": 7.8})), "7.8")
        self.assertEqual(str(q.price_of({"price_sgd": "$2.30"})), "2.30")


if __name__ == "__main__":
    unittest.main(verbosity=1)
