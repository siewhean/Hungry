#!/usr/bin/env python3
"""Tests for scripts/staging_menu_import (filters, guard, SQL, idempotency, rollback).

Run: python3 -I scripts/__tests__/staging_menu_import.test.py
The DB tests use a throwaway local PostgreSQL cluster (initdb) and are skipped
when initdb/psql are unavailable. They never open a connection to Supabase.
"""
from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "scripts" / "staging_menu_import"
sys.path.insert(0, str(PKG))

import guard  # noqa: E402
import sqlgen  # noqa: E402
import transform as T  # noqa: E402
import rollback_import  # noqa: E402

DIR_HEADERS = ["F&B Name", "Registered Business Name", "SFA Licence", "Business Type", "SFA Status / Hygiene Grade",
               "Public Access Status", "Cuisine", "Menu / Price", "Opening Hours / Closed Days", "Contact Details", "Website",
               "Menu URL", "Full Address", "Postal Code", "Latitude", "Longitude", "Coordinate Precision",
               "Rating / Review Count", "Approved Image URL", "SFA Verified Date", "Coverage Status", "Halal Certified",
               "Vegan", "Google Place ID", "Google Maps URL", "Secondary Categories", "Price Range", "Service Options",
               "Accessibility & Amenities", "Payment Methods", "Customer Reviews Summary", "Venue ID"]
MENU_HEADERS = ["F&B Venue Name", "SFA Licence", "Address", "Postal Code", "Menu Item / Dish Name", "Category / Section",
                "Price (SGD)", "Description / Notes", "Dish Image URL", "Menu Source URL", "Last Verified Date", "Halal",
                "Vegetarian", "Vegan", "Pork-free", "Gluten-free", "Dairy-free", "Nut-free", "Beef", "Milk", "Eggs", "Fish",
                "Crustaceans", "Soy", "Peanuts", "Tree nuts", "Wheat", "Intolerances", "Taste Palette", "Sweet", "Spicy",
                "Sour", "Salty", "Rich", "Aromatic"]


def drow(**kw):
    base = {"F&B Name": "Test Stall", "SFA Licence": "E1", "Cuisine": "Chinese", "Full Address": "1 TEST ROAD #01-02,TEST MALL,Singapore 123456",
            "Postal Code": "123456", "Latitude": "1.30", "Longitude": "103.80", "Venue ID": "VEN-123456",
            "SFA Status / Hygiene Grade": "SFA grade: B", "Coverage Status": "ok"}
    base.update(kw)
    return [base.get(h) for h in DIR_HEADERS]


def mrow(**kw):
    base = {"F&B Venue Name": "Test Stall", "SFA Licence": "E1", "Menu Item / Dish Name": "Dish A", "Category / Section": "Laksa",
            "Price (SGD)": "5.50", "Description / Notes": "Tasty", "Menu Source URL": "https://example.com/menu",
            "Halal": "Unknown", "Vegetarian": None, "Sweet": "1", "Spicy": "2", "Sour": "3", "Salty": "4", "Rich": "5", "Aromatic": "6"}
    base.update(kw)
    return [base.get(h) for h in MENU_HEADERS]


def plan_for(dirs, menus, confirmed=None, templates=None, **kw):
    return T.build_plan(T.Sheet(DIR_HEADERS, dirs), T.Sheet(MENU_HEADERS, menus), source_sha256="a" * 64,
                        confirmed_errors=confirmed or set(), template_rows=templates or set(), **kw)


def reasons(plan, kind="menu_row"):
    return [e.reason for e in plan.exclusions if e.kind == kind]


class FilterTests(unittest.TestCase):
    def test_clean_row_loads(self):
        p = plan_for([drow()], [mrow()])
        self.assertEqual(len(p.dishes), 1)
        self.assertEqual(reasons(p), [])

    def test_quarantined_rows_excluded(self):
        p = plan_for([drow()], [mrow(**{"Description / Notes": "[QUARANTINED: x] y", "Price (SGD)": None})])
        self.assertEqual(reasons(p), [T.R_QUARANTINED])
        self.assertEqual(p.counts["menu_rows_excluded_first_match"][T.R_QUARANTINED], 1)

    def test_price_not_published_with_price(self):
        p = plan_for([drow()], [mrow(**{"Description / Notes": "Price not published on listing"})])
        self.assertEqual(reasons(p), [T.R_PRICE_NOT_PUBLISHED])

    def test_non_food_stall_rows_excluded(self):
        flagged = drow(**{"Coverage Status": "[QUARANTINED_NOT_FNB: office]"})
        p = plan_for([flagged], [mrow()])
        self.assertEqual(reasons(p), [T.R_NON_FOOD_STALL])
        self.assertEqual(reasons(p, "stall"), [T.R_STALL_QUARANTINED])
        self.assertEqual(p.venues, [])

    def test_confirmed_error_matched_by_licence_and_dish(self):
        p = plan_for([drow()], [mrow(), mrow(**{"Menu Item / Dish Name": "Dish B"})], confirmed={("E1", "dish a")})
        self.assertEqual(reasons(p), [T.R_CONFIRMED_ERROR])
        self.assertEqual(len(p.dishes), 1)

    def test_confirmed_error_other_licence_not_matched(self):
        p = plan_for([drow()], [mrow()], confirmed={("E2", "dish a")})
        self.assertEqual(len(p.dishes), 1)

    def test_template_pattern_dish_and_price(self):
        p = plan_for([drow()], [mrow(), mrow(**{"Price (SGD)": "6.00"})], templates={("dish a", "5.50")})
        self.assertEqual(reasons(p), [T.R_TEMPLATE])

    def test_duplicates_keep_one(self):
        p = plan_for([drow()], [mrow(), mrow(), mrow(**{"Price (SGD)": "7.00"})])
        self.assertEqual(reasons(p), [T.R_DUPLICATE])
        self.assertEqual(len(p.dishes), 2)

    def test_price_outliers_boundaries(self):
        rows = [mrow(**{"Menu Item / Dish Name": n, "Price (SGD)": pr}) for n, pr in
                (("lo", "0.50"), ("lo2", "0.51"), ("hi", "200"), ("hi2", "200.01"), ("zero", "0"))]
        p = plan_for([drow()], rows)
        self.assertEqual(sorted(e.dish for e in p.exclusions if e.reason == T.R_PRICE_OUTLIER), ["hi2", "lo", "zero"])
        self.assertEqual(sorted(d["name"] for d in p.dishes), ["hi", "lo2"])

    def test_encoding_damage(self):
        for bad in ("Caf&#233;", "Fried �", "CafÃ©", "x&amp;y"):
            p = plan_for([drow()], [mrow(**{"Menu Item / Dish Name": bad})])
            self.assertEqual(reasons(p), [T.R_ENCODING], bad)
        p = plan_for([drow()], [mrow(**{"Menu Item / Dish Name": "Château Pâté 炸圆"})])
        self.assertEqual(reasons(p), [])

    def test_no_price_no_source(self):
        p = plan_for([drow()], [mrow(**{"Price (SGD)": None, "Menu Source URL": None})])
        self.assertEqual(reasons(p), [T.R_NO_PRICE_NO_SOURCE])

    def test_no_price_with_source_still_not_loaded(self):
        p = plan_for([drow()], [mrow(**{"Price (SGD)": None})])
        self.assertEqual(reasons(p), [T.R_NO_PRICE])

    def test_unlinked_menu_row_counted(self):
        p = plan_for([drow()], [mrow(**{"SFA Licence": None, "F&B Venue Name": "KFC"})])
        self.assertEqual(reasons(p), [T.R_NO_STALL_LINK])

    def test_unique_exact_name_links_blank_licence(self):
        p = plan_for([drow(**{"F&B Name": "KFC"})], [mrow(**{"SFA Licence": None, "F&B Venue Name": "KFC"})])
        self.assertEqual(len(p.dishes), 1)
        self.assertEqual(p.counts["menu_rows_linked_to_stall_by"], {"unique_exact_name": 1})

    def test_ambiguous_name_not_linked(self):
        p = plan_for([drow(**{"F&B Name": "KFC", "SFA Licence": "E1"}), drow(**{"F&B Name": "KFC", "SFA Licence": "E2"})],
                     [mrow(**{"SFA Licence": None, "F&B Venue Name": "KFC"})])
        self.assertEqual(reasons(p), [T.R_NO_STALL_LINK])

    def test_every_exclusion_has_reason_and_counts_add_up(self):
        menus = [mrow(), mrow(**{"Description / Notes": "QUARANTINED"}), mrow(**{"Price (SGD)": "300"})]
        p = plan_for([drow()], menus)
        self.assertTrue(all(e.reason for e in p.exclusions))
        self.assertEqual(p.counts["menu_rows"], p.counts["menu_rows_surviving"] + p.counts["menu_row_total_exclusions"])


class KeyTests(unittest.TestCase):
    def test_venue_id_is_building_key_not_stall_key(self):
        p = plan_for([drow(**{"SFA Licence": "E1"}), drow(**{"SFA Licence": "E2", "F&B Name": "Other"})], [])
        self.assertEqual(len(p.venues), 2)
        self.assertEqual(len(p.buildings), 1)
        self.assertEqual({v["building_id"] for v in p.venues}, {p.buildings[0]["id"]})

    def test_google_place_id_reuse_does_not_merge_stalls(self):
        p = plan_for([drow(**{"SFA Licence": "E1", "Google Place ID": "P"}), drow(**{"SFA Licence": "E2", "Google Place ID": "P", "F&B Name": "B"})], [])
        self.assertEqual(len({v["id"] for v in p.venues}), 2)

    def test_blank_licence_gets_stable_synthetic_key(self):
        d = drow(**{"SFA Licence": None, "Venue ID": None})
        a = plan_for([d], []).venues[0]["id"]
        b = plan_for([d], []).venues[0]["id"]
        self.assertEqual(a, b)
        self.assertTrue(a.startswith("ven-x"))

    def test_building_key_falls_back_to_postal(self):
        self.assertEqual(T.building_key_for(None, "123456", None), "VEN-123456")
        self.assertIsNone(T.building_key_for(None, None, "no postal"))

    def test_batch_id_deterministic_per_source(self):
        self.assertEqual(T.batch_id_for("a" * 64), T.batch_id_for("a" * 64))
        self.assertNotEqual(T.batch_id_for("a" * 64), T.batch_id_for("b" * 64))


class FlagMappingTests(unittest.TestCase):
    def test_counter_price_for_delivery_source_with_counter_note(self):
        for url in ("https://food.grab.com/sg/x", "https://www.foodpanda.sg/y"):
            self.assertEqual(T.classify_price_confidence(url, "Official Counter Menu"), "counter_price")
        self.assertEqual(T.classify_price_confidence(None, "[Verified Counter/Open-Source Price 2026-11-11: x]"), "counter_price")

    def test_delivery_source_without_counter_note_is_delivery_price(self):
        self.assertEqual(T.classify_price_confidence("https://www.foodpanda.sg/y", "Delivery prices only"), "delivery_price")
        self.assertNotIn("counter_unverified", {T.classify_price_confidence("https://food.grab.com/x", "official")})

    def test_delivery_only_price_rows_are_loaded_with_price_and_tagged(self):
        p = plan_for([drow()], [mrow(**{"Menu Source URL": "https://www.foodpanda.sg/y", "Description / Notes": "Delivery prices only", "Price (SGD)": "9.90"}),
                                mrow(**{"Menu Item / Dish Name": "B", "Menu Source URL": "https://food.grab.com/x", "Description / Notes": "Official counter menu", "Price (SGD)": "6.00"})])
        self.assertEqual(reasons(p), [])
        a, b = p.dishes
        self.assertEqual((a["price"], a["price_confidence"], a["menu_source_url"], a["secondary_menu_url"]), (9.9, "delivery_price", None, "https://www.foodpanda.sg/y"))
        self.assertEqual((b["price"], b["price_confidence"]), (6.0, "counter_price"))
        self.assertEqual(p.counts["price_confidence"]["delivery_price"], 1)
        self.assertNotIn("delivery_price_unverified", p.counts["price_confidence"])

    def test_listed_price_default(self):
        self.assertEqual(T.classify_price_confidence("https://shop.example.com", "Tasty"), "listed_price")

    def test_delivery_link_kept_only_as_secondary(self):
        p = plan_for([drow()], [mrow(**{"Menu Source URL": "https://food.grab.com/sg/x", "Description / Notes": "official counter"}),
                                mrow(**{"Menu Item / Dish Name": "B", "Menu Source URL": "https://shop.example.com"})])
        a, b = p.dishes
        self.assertEqual((a["menu_source_url"], a["secondary_menu_url"]), (None, "https://food.grab.com/sg/x"))
        self.assertEqual((b["menu_source_url"], b["secondary_menu_url"]), ("https://shop.example.com", None))

    def test_blank_and_unknown_dietary_stay_unknown(self):
        p = plan_for([drow()], [mrow(**{"Halal": "Unknown", "Vegetarian": None, "Vegan": "", "Eggs": None})])
        st = p.dishes[0]["dietary_status"]
        self.assertEqual(st["flags"]["halal"], "unknown")
        self.assertEqual(st["flags"]["vegetarian"], "unknown")
        self.assertEqual(st["flags"]["vegan"], "unknown")
        self.assertEqual(st["contains"]["eggs"], "unknown")
        self.assertEqual(p.dish_dietary_flags, [])

    def test_yes_creates_flag_and_explicit_no_free_flag(self):
        p = plan_for([drow()], [mrow(**{"Halal": "Yes", "Vegan": "No", "Eggs": "No", "Beef": "Yes"})])
        slugs = {f["slug"] for f in p.dish_dietary_flags}
        self.assertEqual(slugs, {"halal", "egg_free"})
        self.assertEqual(p.dishes[0]["dietary_status"]["flags"]["vegan"], "no")
        self.assertEqual(p.dishes[0]["dietary_status"]["contains"]["beef"], "yes")

    def test_taste_vector_tagged_category_baseline(self):
        p = plan_for([drow()], [mrow(**{"Taste Palette": "Sweet, Rich"})])
        t = p.taste_vectors[0]
        self.assertEqual(t["source"], "category_baseline")
        self.assertEqual((t["sweet"], t["spicy"], t["sour"], t["salty"], t["rich"], t["aromatic"]), (1.0, 2.0, 3.0, 4.0, 5.0, 6.0))
        self.assertEqual(p.dishes[0]["taste_tags"], ["Sweet", "Rich"])

    def test_out_of_range_taste_vector_skipped(self):
        p = plan_for([drow()], [mrow(**{"Sweet": "11"})])
        self.assertEqual(p.taste_vectors, [])

    def test_canonical_category_used_and_generic_flagged(self):
        p = plan_for([drow(**{"Cuisine": "Local / Hawker Delights", "SFA Licence": "E9", "F&B Name": "Nomenu"}), drow()], [mrow()])
        by = {v["licence_no"]: v for v in p.venues}
        self.assertEqual(by["E1"]["cuisine_tags"], ["Laksa"])
        self.assertFalse(by["E1"]["is_generic_cuisine"])
        self.assertEqual(by["E9"]["cuisine_tags"], ["Local / Hawker Delights"])
        self.assertTrue(by["E9"]["is_generic_cuisine"])
        self.assertEqual(p.dishes[0]["cuisine_tags"], ["Laksa"])

    def test_internal_audit_notes_not_used_as_description(self):
        self.assertIsNone(T.strip_notes("[Verified Counter/Open-Source Price 2026-11-11: x] | Verification note: source URL is a chain page"))
        self.assertEqual(T.strip_notes("Rich broth | Official KFC menu item"), "Rich broth")


class HygieneAndDisplayTests(unittest.TestCase):
    def test_hygiene_grade_never_set_even_when_source_has_one(self):
        for cell in ("SFA grade: B", "SFA grade: A", None, ""):
            p = plan_for([drow(**{"SFA Status / Hygiene Grade": cell})], [mrow()])
            self.assertEqual([v["hygiene_grade"] for v in p.venues], [None], cell)
        self.assertEqual(p.counts["venues_with_hygiene_grade_set"], 0)

    def test_hygiene_grade_copied_as_null_in_sql(self):
        p = plan_for([drow()], [mrow()])
        sql = sqlgen.chunk_sql("venues", p.venues)
        self.assertIn("\\N", sql)
        self.assertNotIn("\tB\t", sql.split("copy _stg_venues")[1])

    def test_display_approval_on_makes_dishes_discoverable(self):
        p = plan_for([drow()], [mrow(), mrow(**{"Menu Item / Dish Name": "B", "Menu Source URL": "https://food.grab.com/x", "Description / Notes": "delivery only"})],
                     approve_menu_display=True)
        self.assertTrue(all(d["menu_approved_for_display"] and d["menu_rights_status"] == "operator_owned" for d in p.dishes))
        self.assertTrue(all(v["menu_approved_for_display"] and v["menu_rights_status"] == "operator_owned" for v in p.venues))
        self.assertEqual(p.counts["display"], {"menu_display_approved": True, "dishes_loaded": 2, "dishes_discovery_visible": 2,
                                               "venues_with_discovery_visible_dish": 1})

    def test_display_approval_off_keeps_dishes_hidden(self):
        p = plan_for([drow()], [mrow()])
        self.assertEqual(p.counts["display"]["dishes_discovery_visible"], 0)
        self.assertFalse(p.dishes[0]["menu_approved_for_display"])
        self.assertEqual(p.dishes[0]["menu_rights_status"], "unverified")

    def test_displayable_mirror_rejects_delivery_menu_source(self):
        self.assertTrue(T.menu_is_displayable(True, "operator_owned", "https://shop.example.com"))
        self.assertFalse(T.menu_is_displayable(True, "operator_owned", "https://food.grab.com/x"))
        self.assertFalse(T.menu_is_displayable(True, "unverified", None))
        self.assertFalse(T.menu_is_displayable(False, "operator_owned", None))

    def test_planning_area_sql_only_fills_nulls_for_batch_and_validates_id(self):
        sql = sqlgen.planning_area_sql("5d1c7a63-7f3e-4c52-9a3b-0c4f1b6f2d11")
        self.assertEqual(sql.count("planning_area is null"), 2)
        self.assertEqual(sql.count("import_batch_id = '5d1c7a63-7f3e-4c52-9a3b-0c4f1b6f2d11'::uuid"), 2)
        with self.assertRaises(ValueError):
            sqlgen.planning_area_sql("x'; drop table venues; --")


class GuardTests(unittest.TestCase):
    def test_accepts_staging_only(self):
        self.assertEqual(guard.assert_staging_target(ref=guard.STAGING_REF), guard.STAGING_REF)

    def test_refuses_prod_ref(self):
        with self.assertRaises(guard.GuardError):
            guard.assert_staging_target(ref=guard.PROD_REF)

    def test_refuses_any_other_ref(self):
        for ref in ("abcdefghijklmnopqrst", "", "STAGING", None):
            with self.assertRaises(guard.GuardError):
                guard.assert_staging_target(ref=ref)

    def test_refuses_prod_host_or_user_even_with_staging_ref(self):
        with self.assertRaises(guard.GuardError):
            guard.assert_staging_target(ref=guard.STAGING_REF, host=f"db.{guard.PROD_REF}.supabase.co")
        with self.assertRaises(guard.GuardError):
            guard.assert_staging_target(ref=guard.STAGING_REF, user=f"postgres.{guard.PROD_REF}")
        with self.assertRaises(guard.GuardError):
            guard.assert_staging_target(ref=guard.STAGING_REF, url="postgresql://u@h/db?x=" + guard.PROD_REF)

    def test_refuses_foreign_ref_in_host(self):
        with self.assertRaises(guard.GuardError):
            guard.assert_staging_target(ref=guard.STAGING_REF, host="db.zzzzzzzzzzzzzzzzzzzz.supabase.co")

    def _env(self, **extra):
        env = {"STAGING_PGPASSWORD": "x", guard.CONFIRM_ENV: guard.STAGING_REF}
        env.update(extra)
        return env

    def test_resolve_connection_ok_and_builds_staging_user(self):
        c = guard.resolve_connection(self._env())
        self.assertEqual(c["PGUSER"], f"postgres.{guard.STAGING_REF}")

    def test_resolve_refuses_missing_confirmation_password_and_prod(self):
        with self.assertRaises(guard.GuardError):
            guard.resolve_connection({"STAGING_PGPASSWORD": "x"})
        with self.assertRaises(guard.GuardError):
            guard.resolve_connection({guard.CONFIRM_ENV: guard.STAGING_REF})
        with self.assertRaises(guard.GuardError):
            guard.resolve_connection(self._env(STAGING_PROJECT_REF=guard.PROD_REF))
        with self.assertRaises(guard.GuardError):
            guard.resolve_connection(self._env(STAGING_PGHOST=f"db.{guard.PROD_REF}.supabase.co"))
        with self.assertRaises(guard.GuardError):
            guard.resolve_connection(self._env(STAGING_PGUSER=f"postgres.{guard.PROD_REF}"))
        with self.assertRaises(guard.GuardError):
            guard.resolve_connection(self._env(**{guard.CONFIRM_ENV: "other"}))

    def test_apply_refused_by_cli_without_env(self):
        import import_menu
        env_backup = {k: os.environ.pop(k, None) for k in ("STAGING_PGPASSWORD", guard.CONFIRM_ENV)}
        try:
            self.assertEqual(import_menu.main(["--apply", "--out-dir", tempfile.mkdtemp()]), 3)
        finally:
            for k, v in env_backup.items():
                if v is not None:
                    os.environ[k] = v

    def test_rollback_refused_without_env_and_validates_batch(self):
        env_backup = {k: os.environ.pop(k, None) for k in ("STAGING_PGPASSWORD", guard.CONFIRM_ENV)}
        try:
            self.assertEqual(rollback_import.main(["--batch-id", "5d1c7a63-7f3e-4c52-9a3b-0c4f1b6f2d11"]), 3)
            with self.assertRaises(ValueError):
                rollback_import.build_sql("x'; drop table dishes; --", True)
        finally:
            for k, v in env_backup.items():
                if v is not None:
                    os.environ[k] = v


class SqlGenTests(unittest.TestCase):
    def test_copy_escaping_and_types(self):
        self.assertEqual(sqlgen.copy_field("a\tb\nc\\", "text"), "a\\tb\\nc\\\\")
        self.assertEqual(sqlgen.copy_field(None, "text"), "\\N")
        self.assertEqual(sqlgen.copy_field(True, "boolean"), "t")
        self.assertEqual(sqlgen.copy_field(['a"b', "c,d"], "text[]"), '{"a\\\\"b","c,d"}')
        self.assertEqual(sqlgen.copy_field({"k": "v\n"}, "jsonb"), '{"k":"v\\\\n"}')

    def test_upsert_is_conflict_keyed_and_guarded(self):
        sql = sqlgen.upsert_sql("dishes", "_stg_dishes", sqlgen.SPECS["dishes"])
        self.assertIn("on conflict (id) do update set", sql)
        self.assertIn("is distinct from", sql)

    def test_chunk_is_single_transaction_without_per_row_statements(self):
        p = plan_for([drow()], [mrow()])
        sql = sqlgen.dish_chunk_sql(p.dishes, p.taste_vectors, p.dish_dietary_flags, p.batch_id)
        self.assertEqual(sql.count("begin;"), 1)
        self.assertEqual(sql.count("commit;"), 1)
        self.assertEqual(sql.count("insert into public.dishes"), 1)


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


LOCAL_SCHEMA = """
do $r$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $r$;
create extension if not exists citext;
create table buildings (id text primary key, name text not null, building_type text not null, latitude double precision not null,
  longitude double precision not null, address text, postal_code text, source_type text not null default 'manual',
  source_confidence numeric not null default 0.5, updated_at timestamptz not null default now(), planning_area text);
create table areas (id serial primary key, name text not null, center_lat double precision, center_lng double precision);
insert into areas (name, center_lat, center_lng) values ('Near Area', 1.30, 103.80), ('Far Area', 1.45, 103.95);
create function catalog_url_is_delivery_app(p_url text) returns boolean language sql immutable as $f$
  select lower(coalesce(p_url, '')) like any (array['%grab.com%', '%foodpanda.%', '%deliveroo.%']); $f$;
create function catalog_menu_is_displayable(p_approved boolean, p_rights_status text, p_source_url text default null) returns boolean
language sql immutable as $f$
  select coalesce(p_approved, false)
    and coalesce(p_rights_status, 'unverified') in ('merchant_owned', 'operator_owned', 'user_submitted', 'permitted_api', 'licensed')
    and (coalesce(p_rights_status, 'unverified') = 'licensed' or not catalog_url_is_delivery_app(p_source_url)); $f$;
create table venues (id text primary key, building_id text not null references buildings(id) on delete cascade, name text not null,
  unit_number text not null default '', floor text not null default '', hygiene_grade text not null default 'A' check (hygiene_grade in ('A','B','C','D')),
  is_open boolean not null default true, operating_hours text not null default '', stall_id text, licence_no text,
  cuisine_tags text[] not null default '{}', dietary_tags text[] not null default '{}', image_url text, latitude double precision,
  longitude double precision, address text, postal_code text, google_place_id text, google_rating numeric, google_review_count integer,
  source_type text not null default 'manual', source_confidence numeric not null default 0.5, last_verified_at date, website_url text,
  contact_phone text, menu_url text, planning_area text, menu_approved_for_display boolean not null default false, menu_rights_status text not null default 'unverified');
create table dishes (id text primary key, venue_id text not null references venues(id) on delete cascade,
  building_id text not null references buildings(id) on delete cascade, name text not null, description text, image_url text,
  price numeric not null default 0, price_range text not null default '', taste_tags text[] not null default '{}',
  cuisine_tags text[] not null default '{}', food_type text, source_type text not null default 'manual',
  source_confidence numeric not null default 0.5, menu_source_url text, menu_approved_for_display boolean not null default false,
  menu_rights_status text not null default 'unverified');
create table dish_taste_vectors (dish_id text primary key references dishes(id) on delete cascade, sweet numeric not null default 5,
  spicy numeric not null default 5, sour numeric not null default 5, salty numeric not null default 5, rich numeric not null default 5,
  aromatic numeric not null default 5, confidence numeric not null default 0, source text not null default 'default');
create table dietary_flags (id uuid primary key default gen_random_uuid(), slug citext not null unique, name text not null);
create table dish_dietary_flags (dish_id text not null references dishes(id) on delete cascade,
  dietary_flag_id uuid not null references dietary_flags(id) on delete cascade, primary key (dish_id, dietary_flag_id));
"""


def _sql(path: str) -> str:
    return (ROOT / path).read_text()


MIG_COLUMNS = _sql("supabase/migrations/20261114150000_menu_import_columns.sql")
MIG_COLUMNS_DOWN = _sql("supabase/rollbacks/20261114150000_menu_import_columns.down.sql")
MIG_NULLABLE = _sql("supabase/migrations/20261114160000_hygiene_grade_nullable.sql")
MIG_NULLABLE_DOWN = _sql("supabase/rollbacks/20261114160000_hygiene_grade_nullable.down.sql")
MIG_CLEAR = _sql("supabase/migrations/20261114170000_clear_hygiene_grade.sql")
MIG_CLEAR_DOWN = _sql("supabase/rollbacks/20261114170000_clear_hygiene_grade.down.sql")
SMOKES = {n: _sql(f"supabase/smoke/{n}.sql") for n in ("menu_import_columns", "hygiene_grade_nullable", "hygiene_grade_cleared")}

# What production has that the bare LOCAL_SCHEMA lacks and the clear migration must cope with:
# a BEFORE UPDATE trigger that bumps updated_at, and a deferred constraint trigger (the catalog refresh)
# that leaves "pending trigger events" until the transaction ends.
PROD_LIKE_TRIGGERS = """
alter table venues add column updated_at timestamptz not null default now();
create table catalog_refresh_log (venue_id text, at timestamptz default now());
create function set_updated_at() returns trigger language plpgsql as $f$ begin new.updated_at := now(); return new; end $f$;
create trigger trg_venues_updated_at before update on venues for each row execute function set_updated_at();
create function log_refresh() returns trigger language plpgsql as $f$ begin insert into catalog_refresh_log(venue_id) values (new.id); return null; end $f$;
create constraint trigger trg_catalog_raw_refresh_venue after update on venues deferrable initially deferred for each row execute function log_refresh();
"""


def in_txn(sql: str) -> str:
    """Run a file the way scripts/db/apply_guarded does: one transaction."""
    return "begin;\n" + sql + "\ncommit;\n"


@unittest.skipUnless(shutil.which("initdb") and shutil.which("pg_ctl") and shutil.which("psql"), "local postgres not available")
class LocalDbTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault("LC_ALL", "en_US.UTF-8")
        cls.tmp = tempfile.mkdtemp(prefix="menuimport-pg-")
        cls.port = _free_port()
        data = os.path.join(cls.tmp, "data")
        subprocess.run(["initdb", "-D", data, "-A", "trust", "-U", "tester", "--no-sync"], check=True, capture_output=True)
        subprocess.run(["pg_ctl", "-D", data, "-o", f"-p {cls.port} -c listen_addresses=127.0.0.1 -c unix_socket_directories=''", "-l", os.path.join(cls.tmp, "log"), "-w", "start"],
                       check=True, capture_output=True)
        cls.data = data
        cls.psql("create database t;", db="postgres")
        cls.psql(LOCAL_SCHEMA)
        cls.psql(MIG_COLUMNS)
        cls.psql(MIG_NULLABLE)
        cls.psql(MIG_CLEAR)

    @classmethod
    def tearDownClass(cls):
        subprocess.run(["pg_ctl", "-D", cls.data, "-m", "immediate", "-w", "stop"], capture_output=True)
        shutil.rmtree(cls.tmp, ignore_errors=True)

    @classmethod
    def psql(cls, sql, db="t", args=None):
        cmd = ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", str(cls.port), "-U", "tester", "-d", db] + (args or [])
        r = subprocess.run(cmd, input=sql, text=True, capture_output=True)
        if r.returncode:
            raise AssertionError(r.stderr)
        return r.stdout.strip()

    def load(self, plan):
        import import_menu
        for _label, sql in import_menu.iter_chunks(plan):
            self.psql(sql)

    def counts(self, batch):
        return self.psql(f"select (select count(*) from buildings where import_batch_id='{batch}'), (select count(*) from venues where import_batch_id='{batch}'),"
                         f"(select count(*) from dishes where import_batch_id='{batch}'), (select count(*) from dish_taste_vectors where import_batch_id='{batch}'),"
                         f"(select count(*) from dish_dietary_flags where import_batch_id='{batch}')")

    def test_load_idempotent_and_rollback_exact(self):
        self.psql("delete from buildings;")
        self.psql("insert into buildings (id,name,building_type,latitude,longitude) values ('keep-b','Pre','other',1.3,103.8);"
                  "insert into venues (id,building_id,name) values ('keep-v','keep-b','Pre');"
                  "insert into dishes (id,venue_id,building_id,name) values ('keep-d','keep-v','keep-b','Pre');")
        dirs = [drow(), drow(**{"SFA Licence": "E2", "F&B Name": "Two", "Venue ID": "VEN-999999", "Postal Code": "999999",
                                "Full Address": "2 X ROAD #B1-03,Singapore 999999"})]
        menus = [mrow(**{"Halal": "Yes", "Eggs": "No", "Description / Notes": "a\tb\nc 'quoted' \\ \"dq\""}),
                 mrow(**{"Menu Item / Dish Name": "Dish B", "Menu Source URL": "https://food.grab.com/x", "Description / Notes": "Official counter price"}),
                 mrow(**{"SFA Licence": "E2", "F&B Venue Name": "Two", "Menu Item / Dish Name": "Dish C 炸圆", "Taste Palette": "Wok Hei, Savory"})]
        plan = plan_for(dirs, menus)
        self.load(plan)
        first = self.counts(plan.batch_id)
        self.assertEqual(first, "2|2|3|3|2")
        xmins = self.psql("select string_agg(id||xmin::text, ',' order by id) from dishes where import_batch_id is not null;")
        self.load(plan)                                       # second run: idempotent
        self.assertEqual(self.counts(plan.batch_id), first)
        self.assertEqual(self.psql("select string_agg(id||xmin::text, ',' order by id) from dishes where import_batch_id is not null;"), xmins,
                         "unchanged rows must not be rewritten")
        self.assertEqual(self.psql("select count(*) from dishes where price_confidence='counter_price' and secondary_menu_url is not null"), "1")
        self.assertEqual(self.psql("select dietary_status->'flags'->>'vegan' from dishes where name='Dish A'"), "unknown")
        self.assertEqual(self.psql("select source from dish_taste_vectors limit 1"), "category_baseline")
        # rollback deletes exactly this batch and leaves pre-existing rows
        self.psql(rollback_import.build_sql(plan.batch_id, True).replace("\\set ON_ERROR_STOP on\n", ""))
        self.assertEqual(self.counts(plan.batch_id), "0|0|0|0|0")
        self.assertEqual(self.psql("select (select count(*) from buildings), (select count(*) from venues), (select count(*) from dishes)"), "1|1|1")

    def test_changed_value_updates_and_removed_flag_is_dropped(self):
        plan1 = plan_for([drow()], [mrow(**{"Halal": "Yes"})])
        self.load(plan1)
        self.assertEqual(self.psql(f"select count(*) from dish_dietary_flags where import_batch_id='{plan1.batch_id}'"), "1")
        plan2 = plan_for([drow()], [mrow(**{"Halal": "Unknown", "Price (SGD)": "5.50", "Description / Notes": "new text"})])
        self.assertEqual(plan1.dishes[0]["id"], plan2.dishes[0]["id"])
        self.load(plan2)
        self.assertEqual(self.psql(f"select count(*) from dish_dietary_flags where import_batch_id='{plan1.batch_id}'"), "0")
        self.assertEqual(self.psql("select description from dishes where name='Dish A'"), "new text")
        self.psql(rollback_import.build_sql(plan1.batch_id, True).replace("\\set ON_ERROR_STOP on\n", ""))

    def test_hygiene_null_display_visible_delivery_price_and_planning_area_in_db(self):
        self.psql("delete from buildings;")
        dirs = [drow(), drow(**{"SFA Licence": "E2", "F&B Name": "Two", "Venue ID": "VEN-999999", "Postal Code": "999999", "Latitude": "1.44", "Longitude": "103.94",
                                "SFA Status / Hygiene Grade": "SFA grade: D", "Full Address": "2 X ROAD #01-03,Singapore 999999"})]
        menus = [mrow(),
                 mrow(**{"Menu Item / Dish Name": "Dish B", "Menu Source URL": "https://www.foodpanda.sg/y", "Description / Notes": "Delivery prices only", "Price (SGD)": "9.90"}),
                 mrow(**{"SFA Licence": "E2", "F&B Venue Name": "Two", "Menu Item / Dish Name": "Dish C", "Menu Source URL": "https://food.grab.com/z", "Description / Notes": "Official counter"})]
        plan = plan_for(dirs, menus, approve_menu_display=True)
        self.load(plan)
        self.psql(sqlgen.planning_area_sql(plan.batch_id).replace("\\set ON_ERROR_STOP on\n", ""))
        b = plan.batch_id
        self.assertEqual(self.psql(f"select count(*) from venues where import_batch_id='{b}' and hygiene_grade is not null"), "0")
        self.assertEqual(self.psql(f"select count(*) from dishes where import_batch_id='{b}' and price>0 and catalog_menu_is_displayable(menu_approved_for_display, menu_rights_status, menu_source_url)"), "3")
        self.assertEqual(self.psql(f"select string_agg(name||':'||price_confidence||':'||price, ',' order by name) from dishes where import_batch_id='{b}'"),
                         "Dish A:listed_price:5.5,Dish B:delivery_price:9.9,Dish C:counter_price:5.5")
        self.assertEqual(self.psql(f"select string_agg(licence_no||':'||planning_area, ',' order by licence_no) from venues where import_batch_id='{b}'"), "E1:Near Area,E2:Far Area")
        self.assertEqual(self.psql(f"select count(*) from buildings where import_batch_id='{b}' and planning_area is null"), "0")
        self.psql(rollback_import.build_sql(b, True).replace("\\set ON_ERROR_STOP on\n", ""))

    def test_without_display_approval_nothing_is_discoverable_in_db(self):
        self.psql("delete from buildings;")
        plan = plan_for([drow()], [mrow()])
        self.load(plan)
        self.assertEqual(self.psql(f"select count(*) from dishes where import_batch_id='{plan.batch_id}' and catalog_menu_is_displayable(menu_approved_for_display, menu_rights_status, menu_source_url)"), "0")
        self.psql(rollback_import.build_sql(plan.batch_id, True).replace("\\set ON_ERROR_STOP on\n", ""))

    def test_preflight_clean_on_migrated_schema(self):
        self.assertEqual(self.psql(sqlgen.MIGRATION_CHECK_SQL), "")


@unittest.skipUnless(shutil.which("initdb") and shutil.which("pg_ctl") and shutil.which("psql"), "local postgres not available")
class HygieneMigrationTests(unittest.TestCase):
    """The clear-hygiene migration and its down script, on a throwaway local cluster (separate from LocalDbTests)."""

    @classmethod
    def setUpClass(cls):
        os.environ.setdefault("LC_ALL", "en_US.UTF-8")
        cls.tmp = tempfile.mkdtemp(prefix="menuimport-pg2-")
        cls.port = _free_port()
        data = os.path.join(cls.tmp, "data")
        subprocess.run(["initdb", "-D", data, "-A", "trust", "-U", "tester", "--no-sync"], check=True, capture_output=True)
        subprocess.run(["pg_ctl", "-D", data, "-o", f"-p {cls.port} -c listen_addresses=127.0.0.1 -c unix_socket_directories=''", "-l", os.path.join(cls.tmp, "log"), "-w", "start"],
                       check=True, capture_output=True)
        cls.data = data

    @classmethod
    def tearDownClass(cls):
        subprocess.run(["pg_ctl", "-D", cls.data, "-m", "immediate", "-w", "stop"], capture_output=True)
        shutil.rmtree(cls.tmp, ignore_errors=True)

    @classmethod
    def psql(cls, sql, db="t"):
        return LocalDbTests.psql.__func__(cls, sql, db=db)

    def fresh(self, name):
        """A new database with the pre-migration schema (tests must not depend on each other's state)."""
        self.psql(f"create database {name};", db="postgres")
        self.psql(LOCAL_SCHEMA, db=name)
        return name

    def test_unmigrated_schema_fails_preflight_and_refuses_null_hygiene(self):
        db = self.fresh("t_unmigrated")
        self.psql(MIG_COLUMNS, db=db)
        problems = self.psql(sqlgen.MIGRATION_CHECK_SQL, db=db)
        self.assertIn("hygiene_grade is NOT NULL", problems)
        self.assertIn("still has a default", problems)
        self.assertIn("20261114160000_hygiene_grade_nullable", problems)
        # the importer writes hygiene NULL: it must be rejected until the clear migration is applied
        plan = plan_for([drow()], [mrow()])
        import import_menu
        with self.assertRaises(AssertionError):
            for _label, sql in import_menu.iter_chunks(plan):
                self.psql(sql, db=db)
        self.psql(MIG_NULLABLE, db=db)
        self.assertEqual(self.psql(sqlgen.MIGRATION_CHECK_SQL, db=db), "")
        for _label, sql in import_menu.iter_chunks(plan):
            self.psql(sql, db=db)
        self.assertEqual(self.psql("select count(*) from venues where hygiene_grade is null", db=db), "1")

    BACKUP = "venues_hygiene_grade_backup_20261112"

    def seed_graded(self, db):
        self.psql(MIG_COLUMNS, db=db)
        self.psql(MIG_NULLABLE, db=db)
        self.psql("insert into buildings (id,name,building_type,latitude,longitude) values ('b','B','other',1.3,103.8);"
                  "insert into venues (id,building_id,name,hygiene_grade) values ('v1','b','One','A'),('v2','b','Two','B'),('v3','b','Three','C'),('v4','b','Four','D');", db=db)

    def test_nullable_migration_schema_only_and_backup_table_is_internal(self):
        db = self.fresh("t_nullable")
        self.psql(MIG_COLUMNS, db=db)
        self.psql("insert into buildings (id,name,building_type,latitude,longitude) values ('b','B','other',1.3,103.8);"
                  "insert into venues (id,building_id,name,hygiene_grade) values ('v1','b','One','B');", db=db)
        self.psql(MIG_NULLABLE, db=db)
        self.psql(MIG_NULLABLE, db=db)   # idempotent
        self.assertEqual(self.psql("select is_nullable||'/'||coalesce(column_default,'none') from information_schema.columns where table_name='venues' and column_name='hygiene_grade'", db=db), "YES/none")
        self.assertEqual(self.psql("select hygiene_grade from venues where id='v1'", db=db), "B")            # no grade touched
        self.assertEqual(self.psql(f"select count(*) from {self.BACKUP}", db=db), "0")                      # backup exists, empty
        self.assertEqual(self.psql(f"select relrowsecurity from pg_class where relname='{self.BACKUP}'", db=db), "t")
        self.assertEqual(self.psql(f"select has_table_privilege('anon','{self.BACKUP}','select')::text||has_table_privilege('authenticated','{self.BACKUP}','insert')::text", db=db), "falsefalse")
        # the CHECK stays: NULL passes, an invalid grade does not
        self.psql("insert into venues (id,building_id,name) values ('v2','b','Two');", db=db)
        with self.assertRaises(AssertionError):
            self.psql("insert into venues (id,building_id,name,hygiene_grade) values ('v3','b','Three','Z');", db=db)
        self.psql(SMOKES["hygiene_grade_nullable"], db=db)

    def test_clear_migration_needs_nullable_first(self):
        db = self.fresh("t_clear_order")
        self.psql(MIG_COLUMNS, db=db)
        with self.assertRaises(AssertionError) as cm:
            self.psql(in_txn(MIG_CLEAR), db=db)
        self.assertIn("apply 20261114160000_hygiene_grade_nullable first", str(cm.exception))

    def test_clear_migration_backup_clear_idempotent_and_down_restores_only_backed_up_rows(self):
        db = self.fresh("t_clear")
        self.seed_graded(db)
        self.psql(in_txn(MIG_CLEAR), db=db)
        self.assertEqual(self.psql(f"select string_agg(venue_id||hygiene_grade, ',' order by venue_id) from {self.BACKUP}", db=db), "v1A,v2B,v3C,v4D")
        self.assertEqual(self.psql("select count(*) from venues where hygiene_grade is not null", db=db), "0")
        self.psql(SMOKES["hygiene_grade_cleared"], db=db)
        # a venue imported after the clear has no grade and never will get one back
        self.psql("insert into venues (id,building_id,name) values ('v5','b','Five');", db=db)
        # re-run is a no-op for the backup (original values preserved)
        self.psql("update venues set hygiene_grade='C' where id='v1';", db=db)
        self.psql(in_txn(MIG_CLEAR), db=db)
        self.assertEqual(self.psql(f"select hygiene_grade from {self.BACKUP} where venue_id='v1'", db=db), "A")
        self.assertEqual(self.psql(f"select count(*) from {self.BACKUP}", db=db), "4")
        self.assertEqual(self.psql("select count(*) from venues where hygiene_grade is not null", db=db), "0")
        # down: ONLY the 4 backed-up grades return; v5 stays NULL (the old down gave every NULL row 'A')
        self.psql(in_txn(MIG_CLEAR_DOWN), db=db)
        self.assertEqual(self.psql("select string_agg(id||coalesce(hygiene_grade,'-'), ',' order by id) from venues", db=db), "v1A,v2B,v3C,v4D,v5-")
        self.assertEqual(self.psql(f"select count(*) from {self.BACKUP}", db=db), "0")
        self.assertEqual(self.psql("select count(*) from rollback_archive.venues_hygiene_grade_backup_20261114170000", db=db), "4")
        self.assertEqual(self.psql("select obj_description('public.venues'::regclass, 'pg_class') is null and col_description('public.venues'::regclass, (select attnum from pg_attribute where attrelid='public.venues'::regclass and attname='hygiene_grade')) is null", db=db), "t")
        # a down never overwrites a grade given since: re-clear, grade one venue, undo
        self.psql(in_txn(MIG_CLEAR), db=db)
        self.psql("update venues set hygiene_grade='D' where id='v1';", db=db)
        self.psql(in_txn(MIG_CLEAR_DOWN), db=db)
        self.assertEqual(self.psql("select hygiene_grade from venues where id='v1'", db=db), "D")
        self.assertEqual(self.psql("select hygiene_grade from venues where id='v2'", db=db), "B")

    def test_hygiene_up_down_up_roundtrip_with_prod_like_triggers_in_one_transaction(self):
        db = self.fresh("t_roundtrip")
        self.psql(PROD_LIKE_TRIGGERS, db=db)
        self.seed_graded(db)
        self.psql("truncate catalog_refresh_log;", db=db)
        stamps = self.psql("select string_agg(updated_at::text, ',' order by id) from venues", db=db)
        before = self.row_fingerprint(db)
        self.psql(in_txn(MIG_CLEAR), db=db)
        self.assertEqual(self.psql("select string_agg(updated_at::text, ',' order by id) from venues", db=db), stamps)   # updated_at not bumped
        self.assertEqual(self.psql("select count(*) from pg_trigger where tgname='trg_venues_updated_at' and tgenabled='O'", db=db), "1")   # trigger back on
        self.assertEqual(self.psql("select count(distinct venue_id) from catalog_refresh_log", db=db), "4")        # refresh ran
        self.psql(in_txn(MIG_CLEAR_DOWN), db=db)
        self.assertEqual(self.row_fingerprint(db, skip=("catalog_refresh_log", self.BACKUP)), {k: v for k, v in before.items() if k not in ("catalog_refresh_log", self.BACKUP)})
        self.psql(in_txn(MIG_CLEAR), db=db)          # up again
        self.assertEqual(self.psql("select count(*) from venues where hygiene_grade is not null", db=db), "0")
        self.assertEqual(self.psql(f"select count(*) from {self.BACKUP}", db=db), "4")
        # both down files in ONE transaction, newest first (clear, then nullable)
        self.psql(in_txn(MIG_CLEAR_DOWN + "\n" + MIG_NULLABLE_DOWN), db=db)
        self.assertEqual(self.psql("select string_agg(id||hygiene_grade, ',' order by id) from venues", db=db), "v1A,v2B,v3C,v4D")
        self.assertEqual(self.psql("select is_nullable||'/'||column_default from information_schema.columns where table_name='venues' and column_name='hygiene_grade'", db=db), "NO/'A'::text")
        self.assertEqual(self.psql(f"select to_regclass('public.{self.BACKUP}') is null", db=db), "t")

    def test_clear_without_set_constraints_would_fail_proving_the_guard_is_needed(self):
        db = self.fresh("t_pending")
        self.psql(PROD_LIKE_TRIGGERS, db=db)
        self.seed_graded(db)
        broken = MIG_CLEAR.replace("set constraints all immediate;", "")
        self.assertNotEqual(broken, MIG_CLEAR)
        with self.assertRaises(AssertionError) as cm:
            self.psql(in_txn(broken), db=db)
        self.assertIn("pending trigger events", str(cm.exception))
        self.assertEqual(self.psql("select count(*) from venues where hygiene_grade is not null", db=db), "4")   # rolled back as one unit

    def test_nullable_down_refuses_to_invent_grades(self):
        db = self.fresh("t_nodown")
        self.seed_graded(db)
        self.psql(in_txn(MIG_CLEAR), db=db)
        with self.assertRaises(AssertionError) as cm:
            self.psql(in_txn(MIG_NULLABLE_DOWN), db=db)
        self.assertIn("Undo 20261114170000_clear_hygiene_grade first", str(cm.exception))
        self.assertEqual(self.psql("select is_nullable from information_schema.columns where table_name='venues' and column_name='hygiene_grade'", db=db), "YES")
        self.assertEqual(self.psql(f"select count(*) from {self.BACKUP}", db=db), "4")   # nothing dropped

    def row_fingerprint(self, db, skip=()):
        tables = self.psql("select tablename from pg_tables where schemaname='public' order by 1", db=db).split()
        out = {}
        for t in tables:
            if t in skip:
                continue
            out[t] = self.psql(f"select count(*)||'/'||coalesce(sum(hashtextextended(x::text,0)),0) from public.{t} x", db=db)
        return out

    def schema_dump(self, db):
        r = subprocess.run(["pg_dump", "-s", "--no-owner", "-n", "public", "-h", "127.0.0.1", "-p", str(self.port), "-U", "tester", db], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return "\n".join(l for l in r.stdout.splitlines() if not l.startswith(("\\restrict", "\\unrestrict")))

    def test_columns_up_down_up_roundtrip_schema_exact_and_archives_data(self):
        db = self.fresh("t_cols_rt")
        self.psql("insert into buildings (id,name,building_type,latitude,longitude) values ('b','B','other',1.3,103.8);"
                  "insert into venues (id,building_id,name) values ('v1','b','One');"
                  "insert into dishes (id,venue_id,building_id,name) values ('d1','v1','b','D');", db=db)
        schema_before = self.schema_dump(db)
        rows_before = self.row_fingerprint(db)
        self.psql(in_txn(MIG_COLUMNS), db=db)
        self.psql(in_txn(MIG_COLUMNS), db=db)   # idempotent
        self.psql(SMOKES["menu_import_columns"], db=db)
        # populate every new column, as an import would
        bid = "11111111-1111-1111-1111-111111111111"
        self.psql(f"update buildings set import_batch_id='{bid}';"
                  f"update venues set import_batch_id='{bid}', is_generic_cuisine=true, secondary_menu_url='https://x/v';"
                  f"update dishes set import_batch_id='{bid}', price_confidence='counter_price', is_generic_cuisine=true, secondary_menu_url='https://x/d', dietary_status='{{\"halal\":\"yes\"}}';"
                  f"insert into dish_taste_vectors (dish_id, import_batch_id) values ('d1','{bid}');", db=db)
        self.psql(in_txn(MIG_COLUMNS_DOWN), db=db)
        self.assertEqual(self.schema_dump(db), schema_before)
        self.assertEqual({k: v for k, v in self.row_fingerprint(db).items() if k != "dish_taste_vectors"},
                         {k: v for k, v in rows_before.items() if k != "dish_taste_vectors"})
        arch = lambda t: self.psql(f"select count(*) from rollback_archive.menu_import_{t}_20261114150000", db=db)
        self.assertEqual((arch("buildings"), arch("venues"), arch("dishes"), arch("dish_taste_vectors")), ("1", "1", "1", "1"))
        self.assertEqual(self.psql("select price_confidence||'/'||dietary_status::text from rollback_archive.menu_import_dishes_20261114150000", db=db), 'counter_price/{"halal": "yes"}')
        self.psql(in_txn(MIG_COLUMNS), db=db)   # up again after a down
        self.psql(SMOKES["menu_import_columns"], db=db)
        self.psql(in_txn(MIG_COLUMNS_DOWN), db=db)
        self.assertEqual(self.schema_dump(db), schema_before)

    def test_columns_migration_replaces_old_price_confidence_constraint(self):
        db = self.fresh("t_pc")
        self.psql(MIG_COLUMNS, db=db)
        self.psql("alter table dishes drop constraint if exists dishes_price_confidence_check;"
                  "alter table dishes add constraint dishes_price_confidence_check check (price_confidence is null or price_confidence in ('counter_price','delivery_price_unverified','listed_price'));", db=db)
        self.psql(MIG_COLUMNS, db=db)
        self.psql("insert into buildings (id,name,building_type,latitude,longitude) values ('pc','P','other',1.3,103.8) on conflict do nothing;"
                  "insert into venues (id,building_id,name) values ('pcv','pc','P') on conflict do nothing;"
                  "insert into dishes (id,venue_id,building_id,name,price_confidence) values ('pcd','pcv','pc','D','delivery_price');", db=db)
        with self.assertRaises(AssertionError):
            self.psql("insert into dishes (id,venue_id,building_id,name,price_confidence) values ('pcd2','pcv','pc','D','delivery_price_unverified');", db=db)


if __name__ == "__main__":
    unittest.main(verbosity=1)
