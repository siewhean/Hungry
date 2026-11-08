#!/usr/bin/env python3
"""Tests for menu_workbook_merge.py. Tiny temp fixtures only; no network, no real workbook.

Run:  python3 scripts/menu_workbook_merge.test.py
"""
from __future__ import annotations

import contextlib
import csv
import io
import json
import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import menu_workbook_merge as m  # noqa: E402

HEADER = ["F&B Venue Name", "SFA Licence", "Address", "Postal Code", "Menu Item / Dish Name", "Category / Section",
          "Price (SGD)", "Description / Notes", "Dish Image URL", "Menu Source URL", "Last Verified Date", "Halal",
          "Vegetarian", "Vegan", "Pork-free", "Gluten-free", "Dairy-free", "Nut-free", "Beef", "Milk", "Eggs", "Fish",
          "Crustaceans", "Soy", "Peanuts", "Tree nuts", "Wheat", "Intolerances"]
NOW = "2026-10-26T12:00:00+08:00"
TOAST = ("Toast Box", "CE06J06A000", "11 JALAN TAN TOCK SENG #01-06,TAN TOCK SENG HOSPITAL,Singapore 308433", "308433")
NEWTON = ("Newton 32 BBQ Seafood", "NTF0132003", "500 CLEMENCEAU AVENUE NORTH #01-32,NEWTON FOOD CENTRE,Singapore 229495", "229495")
OTHER = ("Other Stall", "CE99999X000", "1 EXAMPLE ROAD #01-01,Singapore 000123", "000123")


def existing_row(venue, dish, price, url="", image=""):
    r = {c: "" for c in HEADER}
    r.update(m.DIET_DEFAULTS)
    r.update({"F&B Venue Name": venue[0], "SFA Licence": venue[1], "Address": venue[2], "Postal Code": venue[3],
              "Menu Item / Dish Name": dish, "Price (SGD)": price, "Menu Source URL": url, "Dish Image URL": image,
              "Last Verified Date": "2026-07-14"})
    return r


def write_csv(path, header, rows, newline="\n", bom=False):
    with open(path, "w", newline="", encoding="utf-8-sig" if bom else "utf-8") as f:
        w = csv.writer(f, lineterminator=newline)
        w.writerow(header)
        for r in rows:
            w.writerow([r[c] for c in header])


def row(**kw):
    base = dict(licence="CE06J06A000", item_name="Curry Chicken with Rice", price_sgd=10.2, category="Rice Dishes",
                description="Tasty curry", image_url="https://img.example/a.jpg?width=128&height=128",
                source_url="https://foodpanda.sg/restaurant/y8tj/toast-box", source="foodpanda", source_type="saved_page",
                captured_at="2026-10-25T15:19:00+08:00", verified=False, page_postal_code="308433",
                page_unit="#01-06", page_name="Toast Box (Tan Tock Seng Hospital)")
    base.update(kw)
    return base


def write_jsonl(path, rows):
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write((r if isinstance(r, str) else json.dumps(r, ensure_ascii=False)) + "\n")


def run_main(*args, **kw):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = m.main(list(args), **kw)
    return code, out.getvalue(), err.getvalue()


def read_rows(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


class Base(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.target = self.dir / "doc2.csv"
        self.input = self.dir / "rows.jsonl"
        self.queue = self.dir / "queue.jsonl"
        self.addCleanup(self._tmp.cleanup)
        write_csv(self.target, HEADER, [
            existing_row(TOAST, "Kopi C", "4.60", "https://foodpanda.sg/restaurant/y8tj/toast-box"),
            existing_row(NEWTON, "Chilli Crab", "38.00", "https://foodpanda.sg/restaurant/y2ny/newton-51"),
            existing_row(OTHER, "Mee Pok", "5.00", "https://shared.example/menu"),
        ])

    def args(self, *extra, apply=False):
        a = ["--input", str(self.input), "--target", str(self.target), "--review-queue", str(self.queue),
             "--now", NOW, "--sidecar", str(self.dir / "side.jsonl")]
        if apply:
            a.append("--apply")
        return a + list(extra)

    def queue_reasons(self):
        with open(self.queue, encoding="utf-8") as f:
            return [json.loads(l)["reasons"] for l in f if l.strip()]

    def files(self):
        return sorted(p.name for p in self.dir.iterdir())


class ParsePriceTest(unittest.TestCase):
    def test_service_charge_suffix(self):
        p = m.parse_price("$2.30++")
        self.assertEqual((p.amount, p.service_charge_excluded, p.error), (Decimal("2.30"), True, None))

    def test_from_prefix_with_currency_and_space(self):
        p = m.parse_price("from S$ 10.80")
        self.assertEqual((p.amount, p.is_from), (Decimal("10.80"), True))

    def test_slash_list_keeps_options_and_lowest(self):
        p = m.parse_price("28 / 35")
        self.assertEqual((p.amount, p.options), (Decimal("28.00"), [Decimal("28.00"), Decimal("35.00")]))

    def test_plus_dollar_is_add_on(self):
        p = m.parse_price("+$1.00")
        self.assertTrue(p.is_add_on)
        self.assertEqual(p.amount, Decimal("1.00"))

    def test_sized_text_takes_dollar_amounts_only(self):
        p = m.parse_price("M $7.5 S $7.1 XM $9.2")
        self.assertEqual((p.amount, len(p.options)), (Decimal("7.10"), 3))

    def test_numbers_thousands_and_floats(self):
        self.assertEqual(m.parse_price("S$1,234.50").amount, Decimal("1234.50"))
        self.assertEqual(m.parse_price(7.5).amount, Decimal("7.50"))
        self.assertEqual(m.money_str(m.parse_price("7").amount), "7.00")

    def test_rejects_without_guessing(self):
        self.assertEqual(m.parse_price("").error, "missing")
        self.assertEqual(m.parse_price(None).error, "missing")
        self.assertEqual(m.parse_price("0").error, "non_positive")
        self.assertEqual(m.parse_price("$0.00").error, "non_positive")
        self.assertEqual(m.parse_price("6 pcs 5.50").error, "ambiguous_text")
        self.assertEqual(m.parse_price("$7.555").error, "too_many_decimals")
        self.assertEqual(m.parse_price("free").error, "ambiguous_text")


class TextTest(unittest.TestCase):
    def test_entities_decoded_including_double_encoding(self):
        self.assertEqual(m.clean_text("Fish &amp; Chips"), "Fish & Chips")
        self.assertEqual(m.clean_text("Mac &#38; Cheese"), "Mac & Cheese")
        self.assertEqual(m.clean_text("Chef&#039;s Special"), "Chef's Special")
        self.assertEqual(m.clean_text("Tom &amp;amp; Jerry"), "Tom & Jerry")

    def test_whitespace_and_unicode(self):
        self.assertEqual(m.clean_text("  Kaya Toast \n\t Set​ "), "Kaya Toast Set")
        self.assertEqual(m.clean_text("Café"), "Café")  # NFC
        self.assertEqual(m.clean_text("什锦时蔬饭"), "什锦时蔬饭")

    def test_brand_casing_is_kept(self):
        self.assertEqual(m.clean_text("iTEA  Signature"), "iTEA Signature")

    def test_no_substring_allergen_inference(self):
        # a dish name never sets an allergen column on its own
        a, _ = m.resolve_dietary(None, [])
        self.assertEqual(a["Eggs"], "Unknown")
        self.assertEqual(a["Halal"], "Unknown")

    def test_image_urls(self):
        self.assertEqual(m.normalise_image_url("https://x.io/a.jpg?width=128&height=128&quality=45"), ("https://x.io/a.jpg", "full"))
        self.assertEqual(m.normalise_image_url("https://x.io/a.jpg?token=abc&w=100")[0], "https://x.io/a.jpg?token=abc")
        self.assertEqual(m.normalise_image_url("https://s.io/sites/default/files/styles/medium/public/x.png")[0],
                         "https://s.io/sites/default/files/x.png")
        self.assertEqual(m.normalise_image_url("https://s.io/thumbs/x.png")[1], "thumbnail_only")
        self.assertEqual(m.normalise_image_url("data:image/png;base64,AAA"), (None, "none"))


class MergeTest(Base):
    def test_dry_run_changes_nothing(self):
        write_jsonl(self.input, [row()])
        before = self.target.read_bytes()
        code, out, _ = run_main("--input", str(self.input), "--target", str(self.target), "--now", NOW)
        self.assertEqual(code, 0)
        self.assertIn("DRY RUN", out)
        self.assertIn("New rows to append: 1", out)
        self.assertEqual(self.target.read_bytes(), before)
        self.assertEqual(self.files(), ["doc2.csv", "rows.jsonl"])  # no backup, queue, or sidecar created

    def test_apply_appends_in_header_order_with_matrix_values(self):
        write_jsonl(self.input, [row(menu_title="Brunch (Weekends)", menu_hours={"start": "08:00:00", "end": "16:00:00"},
                                     discounted_price_sgd=9.0, variation_prices_sgd=[10.2, 12.4])])
        code, out, err = run_main(*self.args(apply=True))
        self.assertEqual(code, 0, err)
        rows = read_rows(self.target)
        self.assertEqual(len(rows), 4)
        new = rows[-1]
        self.assertEqual(list(new.keys()), HEADER)
        self.assertEqual(new["F&B Venue Name"], "Toast Box")  # name comes from the workbook, never from the page
        self.assertEqual(new["Address"], TOAST[2])
        self.assertEqual(new["Price (SGD)"], "10.20")
        self.assertEqual(new["Last Verified Date"], "2026-10-25")
        self.assertEqual(new["Dish Image URL"], "https://img.example/a.jpg")
        self.assertEqual(new["Halal"], "Unknown")
        self.assertEqual(new["Vegan"], "")
        self.assertEqual(new["Intolerances"], m.INTOLERANCES_DEFAULT)
        self.assertIn("Price options (SGD): 10.20, 12.40", new["Description / Notes"])
        self.assertIn("Promo price S$9.00", new["Description / Notes"])
        self.assertIn("Available: Brunch (Weekends) 08:00-16:00", new["Description / Notes"])
        self.assertIn(m.DELIVERY_NOTE, new["Description / Notes"])
        self.assertTrue(new["Description / Notes"].endswith(m.UNVERIFIED_NOTE))
        side = [json.loads(l) for l in (self.dir / "side.jsonl").read_text().splitlines()]
        self.assertEqual(len(side), 1)
        self.assertEqual((side[0]["price_basis"], side[0]["verified"], side[0]["menu_scope"]), ("delivery", False, "Brunch (Weekends)"))
        self.assertFalse(side[0]["other_menus_captured"])
        self.assertIn("Stalls with only the menu active", out)
        self.assertIn("To restore: cp -p", out)

    def test_existing_rows_untouched_byte_for_byte(self):
        before = self.target.read_bytes()
        write_jsonl(self.input, [row()])
        run_main(*self.args(apply=True))
        after = self.target.read_bytes()
        self.assertTrue(after.startswith(before))

    def test_apply_twice_is_idempotent(self):
        write_jsonl(self.input, [row(), row(item_name="Laksa", price_sgd=7.5)])
        self.assertEqual(run_main(*self.args(apply=True))[0], 0)
        first = self.target.read_bytes()
        side1 = (self.dir / "side.jsonl").read_bytes()
        backups1 = [f for f in self.files() if "_before_menu_merge_" in f]
        code, out, _ = run_main(*self.args(apply=True))
        self.assertEqual(code, 0)
        self.assertEqual(self.target.read_bytes(), first)
        self.assertEqual((self.dir / "side.jsonl").read_bytes(), side1)
        self.assertEqual([f for f in self.files() if "_before_menu_merge_" in f], backups1)
        self.assertIn("already present: 2", out)
        self.assertIn("no-op", out)

    def test_crlf_and_bom_preserved(self):
        write_csv(self.target, HEADER, [existing_row(TOAST, "Kopi C", "4.60")], newline="\r\n", bom=True)
        write_jsonl(self.input, [row()])
        run_main(*self.args(apply=True))
        raw = self.target.read_bytes()
        self.assertTrue(raw.startswith(b"\xef\xbb\xbf"))
        self.assertEqual(raw.count(b"\n"), raw.count(b"\r\n"))
        self.assertEqual(len(read_rows(self.target)), 2)

    def test_header_is_source_of_truth_for_column_order(self):
        reordered = ["SFA Licence", "F&B Venue Name", "Price (SGD)", "Menu Item / Dish Name", "Address", "Postal Code",
                     "Menu Source URL", "Last Verified Date", "Halal"]
        write_csv(self.target, reordered, [{**existing_row(TOAST, "Kopi C", "4.60")}])
        write_jsonl(self.input, [row()])
        self.assertEqual(run_main(*self.args(apply=True))[0], 0)
        with open(self.target, newline="", encoding="utf-8") as f:
            r = csv.reader(f)
            self.assertEqual(next(r), reordered)
            next(r)
            last = next(r)
        self.assertEqual(last[0], "CE06J06A000")
        self.assertEqual(last[2], "10.20")

    def test_unknown_column_fails_loudly(self):
        write_csv(self.target, HEADER + ["Surprise"], [{**existing_row(TOAST, "Kopi C", "4.60"), "Surprise": "x"}])
        write_jsonl(self.input, [row()])
        before = self.target.read_bytes()
        code, _, err = run_main(*self.args(apply=True))
        self.assertEqual(code, 2)
        self.assertIn("Surprise", err)
        self.assertEqual(self.target.read_bytes(), before)

    def test_missing_required_column_fails(self):
        write_csv(self.target, [c for c in HEADER if c != "Price (SGD)"], [])
        write_jsonl(self.input, [row()])
        self.assertEqual(run_main(*self.args())[0], 2)


class SafetyTest(Base):
    def test_write_error_at_swap_leaves_original_and_no_temp_files(self):
        write_jsonl(self.input, [row()])
        before = self.target.read_bytes()
        with mock.patch.object(m.os, "replace", side_effect=OSError("disk full")):
            code, _, err = run_main(*self.args("--no-sidecar", apply=True))
        self.assertEqual(code, 4)
        self.assertIn("write failed", err)
        self.assertEqual(self.target.read_bytes(), before)
        self.assertFalse([f for f in self.files() if ".tmp" in f])

    def test_write_error_midway_cleans_temp(self):
        write_jsonl(self.input, [row()])
        before = self.target.read_bytes()

        def boom(tmp_path, header, rows, newline):
            Path(tmp_path).write_bytes(b"partial garbage")
            raise OSError("no space left on device")

        with mock.patch.object(m, "_append_rows", side_effect=boom):
            code, _, _ = run_main(*self.args("--no-sidecar", apply=True))
        self.assertEqual(code, 4)
        self.assertEqual(self.target.read_bytes(), before)
        self.assertFalse([f for f in self.files() if ".tmp" in f])

    def test_validation_failure_blocks_swap(self):
        write_jsonl(self.input, [row()])
        before = self.target.read_bytes()
        with mock.patch.object(m, "validate_csv", side_effect=m.MergeError("bad", 4)):
            code, _, _ = run_main(*self.args("--no-sidecar", apply=True))
        self.assertEqual(code, 4)
        self.assertEqual(self.target.read_bytes(), before)
        self.assertFalse([f for f in self.files() if ".tmp" in f])

    def test_low_disk_refuses_before_any_write(self):
        write_jsonl(self.input, [row()])
        before = self.target.read_bytes()
        code, _, err = run_main(*self.args(apply=True), free_fn=lambda p: self.target.stat().st_size * 2)
        self.assertEqual(code, 3)
        self.assertIn("Refusing to write", err)
        self.assertEqual(self.target.read_bytes(), before)
        self.assertEqual(self.files(), ["doc2.csv", "queue.jsonl", "rows.jsonl"])  # no backup, no sidecar

    def test_disk_exactly_three_times_is_allowed(self):
        write_jsonl(self.input, [row()])
        need = self.target.stat().st_size * 3
        self.assertEqual(run_main(*self.args(apply=True), free_fn=lambda p: need * 10)[0], 0)

    def test_backup_is_verified_copy(self):
        write_jsonl(self.input, [row()])
        original = self.target.read_bytes()
        run_main(*self.args(apply=True))
        backups = [self.dir / f for f in self.files() if "_before_menu_merge_" in f]
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_bytes(), original)

    def test_xlsx_failure_rolls_csv_back(self):
        try:
            import openpyxl  # noqa: F401
        except ImportError:
            self.skipTest("openpyxl not installed")
        write_jsonl(self.input, [row()])
        xlsx = self.dir / "doc2.xlsx"
        real_replace = m.os.replace

        def flaky(src, dst):
            if str(dst).endswith(".xlsx"):
                raise OSError("xlsx swap failed")
            return real_replace(src, dst)

        before = self.target.read_bytes()
        with mock.patch.object(m.os, "replace", side_effect=flaky):
            code, _, _ = run_main(*self.args("--xlsx", str(xlsx), apply=True))
        self.assertEqual(code, 4)
        self.assertEqual(self.target.read_bytes(), before)  # CSV and XLSX never diverge


class XlsxTest(Base):
    def test_xlsx_built_from_csv_and_validated(self):
        try:
            import openpyxl
        except ImportError:
            self.skipTest("openpyxl not installed")
        write_jsonl(self.input, [row(item_name="Soup")])
        xlsx = self.dir / "doc2.xlsx"
        code, out, err = run_main(*self.args("--xlsx", str(xlsx), apply=True))
        self.assertEqual(code, 0, err)
        wb = openpyxl.load_workbook(xlsx, read_only=True)
        self.assertEqual(wb.sheetnames, ["Hungry Full Menu & Price"])
        rows = list(wb.active.iter_rows(values_only=True))
        self.assertEqual(len(rows), 5)  # header + 3 existing + 1 new
        self.assertEqual(list(rows[0]), HEADER)
        self.assertEqual(rows[2][3], "229495")
        self.assertEqual(rows[3][3], "000123")  # leading zeros survive
        self.assertEqual(rows[-1][4], "Soup")


class RoutingTest(Base):
    def reasons_for(self, *rows):
        write_jsonl(self.input, list(rows))
        code, _, err = run_main(*self.args())
        self.assertEqual(code, 0, err)
        return self.queue_reasons()

    def test_price_bounds_and_missing(self):
        r = self.reasons_for(row(item_name="Cheap", price_sgd=0.2), row(item_name="Pricey", price_sgd=100.5),
                             row(item_name="Edge low", price_sgd=0.5), row(item_name="Edge high", price_sgd=100),
                             row(item_name="No price", price_sgd=None))
        self.assertEqual(r, [["price_out_of_range"], ["price_out_of_range"], ["price_missing"]])

    def test_promo_never_fills_base_price(self):
        self.assertEqual(self.reasons_for(row(price_sgd=None, discounted_price_sgd=5.0)), [["missing_base_has_promo"]])

    def test_add_ons_and_non_dish_types(self):
        r = self.reasons_for(row(item_name="Extra cheese", price_raw="+$1.00"), row(item_name="Family bundle", item_type="bundle"),
                             row(item_name="Set A", item_type="set_meal"))
        self.assertEqual(r, [["add_on_price"], ["item_type_bundle"]])

    def test_unparseable_price_text(self):
        self.assertEqual(self.reasons_for(row(price_raw="ask staff")), [["price_unparseable_ambiguous_text"]])

    def test_licence_must_be_a_real_sfa_licence_in_the_workbook(self):
        r = self.reasons_for(row(licence="y8tj", source_url="https://foodpanda.sg/restaurant/aaaa/a"),
                             row(licence="ZZ99999Z000", source_url="https://foodpanda.sg/restaurant/bbbb/b"))
        self.assertEqual(r[0], ["licence_missing_or_invalid"])
        self.assertEqual(r[1], ["licence_unknown"])

    def test_one_url_one_licence_in_input(self):
        url = "https://foodpanda.sg/restaurant/y2ny/chain"
        r = self.reasons_for(row(source_url=url), row(licence=NEWTON[1], source_url=url, page_postal_code="229495", page_unit="#01-32",
                                                       page_name="Newton 32 BBQ Seafood"))
        self.assertEqual(r, [["url_shared_by_multiple_licences"], ["url_shared_by_multiple_licences"]])

    def test_url_already_owned_by_other_licence_in_workbook(self):
        r = self.reasons_for(row(source_url="https://shared.example/menu"))
        self.assertEqual(r, [["url_belongs_to_other_licence"]])

    def test_newton_32_page_for_newton_51_is_never_attached(self):
        r = self.reasons_for(row(licence=NEWTON[1], source_url="https://foodpanda.sg/restaurant/y2ny/newton-51", item_name="Fried Prawns",
                                 page_postal_code="229495", page_unit="#01-51", page_name="Newton 51 - Newton Food Centre"))
        self.assertEqual(len(r), 1)
        self.assertIn("unit_mismatch", r[0])
        self.assertIn("name_number_mismatch", r[0])

    def test_identity_evidence_rules(self):
        r = self.reasons_for(
            row(item_name="A", page_postal_code="999999"),                           # postal mismatch
            row(item_name="B", page_postal_code=None, page_unit=None, page_name=None),  # no page evidence at all
            row(item_name="C", page_unit=None, page_name=None),                      # only postal: weak
            row(item_name="D", page_unit=None, page_name=None, identity_confirmed_by="owner"),  # owner sign-off
        )
        self.assertEqual(r, [["postal_mismatch"], ["identity_no_page_evidence"], ["identity_weak"]])

    def test_coordinates_far_from_outlet(self):
        master = self.dir / "master.csv"
        with open(master, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["F&B Name", "SFA Licence", "Full Address", "Postal Code", "Latitude", "Longitude"])
            w.writerow(["Toast Box", TOAST[1], TOAST[2], "308433", "1.3216", "103.8467"])
        write_jsonl(self.input, [row(item_name="Far", page_lat=1.40, page_lng=103.90), row(item_name="Near", page_lat=1.3217, page_lng=103.8468)])
        run_main(*self.args("--master", str(master)))
        self.assertEqual(self.queue_reasons(), [["coords_mismatch"]])

    def test_master_supplies_unknown_licence_details(self):
        master = self.dir / "master.csv"
        with open(master, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["F&B Name", "SFA Licence", "Full Address", "Postal Code"])
            w.writerow(["Brand New Stall", "CE12345X000", "5 SOME STREET #02-03,Singapore 123456", "123456"])
        write_jsonl(self.input, [row(licence="CE12345X000", page_postal_code="123456", page_unit="#02-03", page_name="Brand New Stall",
                                     source_url="https://foodpanda.sg/restaurant/zzzz/brand-new")])
        self.assertEqual(run_main(*self.args("--master", str(master), apply=True))[0], 0)
        new = read_rows(self.target)[-1]
        self.assertEqual((new["F&B Venue Name"], new["Postal Code"]), ("Brand New Stall", "123456"))

    def test_capture_time_rules(self):
        r = self.reasons_for(
            row(item_name="A", captured_at="2026-10-25T15:19:00"),          # no timezone
            row(item_name="B", captured_at="2026-08-01T00:00:00+08:00"),    # older than 30 days
            row(item_name="C", captured_at="2026-12-01T00:00:00+08:00"),    # future
            row(item_name="D", captured_at=None),
            row(item_name="E", captured_at="2026-10-25T07:19:00Z"),         # Z suffix is fine
        )
        self.assertEqual(r, [["captured_at_invalid"], ["stale_capture"], ["captured_at_in_future"], ["captured_at_invalid"]])

    def test_default_captured_at_and_source_type_from_cli(self):
        write_jsonl(self.input, [row(captured_at=None, source_type=None)])
        run_main(*self.args("--default-captured-at", "2026-10-25T15:19:00+08:00", "--default-source-type", "saved_page"))
        self.assertEqual(self.queue_reasons(), [])

    def test_verified_requires_a_named_reviewer(self):
        r = self.reasons_for(row(item_name="A", verified=True), row(item_name="B", verified="yes"),
                             row(item_name="C", verified=True, verified_by="siewhean", verified_at="2026-10-26"))
        self.assertEqual(r, [["verified_without_reviewer"], ["verified_not_boolean"]])

    def test_markup_formula_and_invalid_json(self):
        write_jsonl(self.input, [row(item_name="<b>Soup</b>"), row(item_name="=SUM(A1)"), row(item_name="Desc", description="=1+1"),
                                 "{not json", row(item_name="OK")])
        run_main(*self.args())
        self.assertEqual(self.queue_reasons(), [["markup_in_text"], ["formula_injection"], ["formula_injection"], ["invalid_json"]])

    def test_review_queue_is_rewritten_not_appended(self):
        write_jsonl(self.input, [row(price_sgd=0.1)])
        run_main(*self.args())
        run_main(*self.args())
        self.assertEqual(len(self.queue_reasons()), 1)


class DedupeAndDietTest(Base):
    def test_popular_duplicate_dropped_keeps_real_category(self):
        write_jsonl(self.input, [row(category="Popular", item_name="Laksa", price_sgd=7.5, menu_title="All day"),
                                 row(category="Noodles", item_name="LAKSA ", price_sgd=7.5, menu_title="Lunch")])
        run_main(*self.args(apply=True))
        new = [r for r in read_rows(self.target) if r["Menu Item / Dish Name"].strip().lower() == "laksa"]
        self.assertEqual(len(new), 1)
        self.assertEqual(new[0]["Category / Section"], "Noodles")
        side = json.loads((self.dir / "side.jsonl").read_text().splitlines()[0])
        self.assertEqual(side["also_in_menus"], ["All day"])

    def test_featured_only_row_keeps_blank_category(self):
        write_jsonl(self.input, [row(category="Popular", item_name="Satay", price_sgd=9)])
        run_main(*self.args(apply=True))
        self.assertEqual(read_rows(self.target)[-1]["Category / Section"], "")

    def test_same_dish_new_price_goes_to_review_not_appended(self):
        write_jsonl(self.input, [row(item_name="Kopi C", price_sgd=5.2), row(item_name="Kopi C", price_sgd=4.6)])
        run_main(*self.args(apply=True))
        self.assertEqual(self.queue_reasons(), [["price_changed_existing"]])
        self.assertEqual(len(read_rows(self.target)), 3)  # price-matching row is "already present"

    def test_dietary_needs_explicit_evidence(self):
        write_jsonl(self.input, [
            row(item_name="Guess", dietary={"Halal": {"value": "Yes"}}),
            row(item_name="Cert", dietary={"Halal": {"value": "Yes", "evidence": "MUIS certificate shown on page"}}),
            row(item_name="Veg", dietary={"Vegan": {"value": "Yes", "evidence": "menu label: Vegan"}}),
        ])
        out = run_main(*self.args(apply=True))[1]
        rows = {r["Menu Item / Dish Name"]: r for r in read_rows(self.target)}
        self.assertEqual(rows["Guess"]["Halal"], "Unknown")
        self.assertEqual((rows["Cert"]["Halal"], rows["Cert"]["Pork-free"]), ("Yes", "Yes"))
        self.assertEqual((rows["Veg"]["Vegan"], rows["Veg"]["Vegetarian"]), ("Yes", "Yes"))
        self.assertIn("dietary_claim_dropped_no_evidence=1", out)

    def test_dietary_conflict_goes_to_review(self):
        write_jsonl(self.input, [row(dietary={"Vegan": {"value": "Yes", "evidence": "label"}, "Milk": {"value": "Yes", "evidence": "label"}})])
        run_main(*self.args())
        self.assertEqual(self.queue_reasons(), [["dietary_conflict"]])

    def test_generic_image_reused_over_five_times_is_blanked(self):
        rows = [row(item_name=f"Dish {i}", image_url="https://img.example/generic.jpg") for i in range(7)]
        write_jsonl(self.input, rows)
        out = run_main(*self.args(apply=True))[1]
        new = read_rows(self.target)[3:]
        self.assertEqual({r["Dish Image URL"] for r in new}, {""})
        self.assertIn("image_generic_reuse_blanked=7", out)
        side = [json.loads(l) for l in (self.dir / "side.jsonl").read_text().splitlines()]
        self.assertTrue(all(not s["image_in_workbook"] and s["image_reuse_count"] == 7 for s in side))

    def test_thumbnail_only_image_not_written(self):
        write_jsonl(self.input, [row(image_url="https://img.example/thumbs/a.jpg")])
        run_main(*self.args(apply=True))
        self.assertEqual(read_rows(self.target)[-1]["Dish Image URL"], "")

    def test_entities_decoded_in_written_row(self):
        write_jsonl(self.input, [row(item_name="Fish &amp; Chips", description="Chef&#039;s pick &amp; more")])
        run_main(*self.args(apply=True))
        new = read_rows(self.target)[-1]
        self.assertEqual(new["Menu Item / Dish Name"], "Fish & Chips")
        self.assertTrue(new["Description / Notes"].startswith("Chef's pick & more"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
