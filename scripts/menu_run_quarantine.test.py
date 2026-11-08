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
            w.writerow(["F&B Name", "Registered Business Name", "SFA Licence", "Menu URL"])
            for lic, (name, url) in MASTER.items():
                w.writerow([name, "", lic, url])
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
        self.assertEqual((kopi["brand"], kopi["outlet_licences"], kopi["outlet_count"]), ("alpha", ["L_A1", "L_A2"], 2))
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
        self.assertEqual(stats["top_brands_by_outlet_count"][0], {"brand": "alpha", "outlet_count": 2, "rows": 4})
        self.assertIn("by brand key only", (self.out / "report.md").read_text())

    def test_outlet_map_lookup_by_brand_key(self):
        self.go([R("L_A1", "Kopi", 1.5), R("L_A2", "Kopi", 1.5), R("L_A1", "Teh", 1.5), R("L_A2", "Teh", 1.5)])  # rule-2 copies (same price)
        with open(self.out / "brand_outlet_map.csv", newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual([(r["licence"], r["outlet_name"], r["brand_key"], r["catalogue_row_count"]) for r in rows],
                         [("L_A1", "Alpha Cafe (Bedok)", "alpha", "2"), ("L_A2", "Alpha Cafe (Tampines)", "alpha", "2")])

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
