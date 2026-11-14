"""SQL generation: set-based, batched, idempotent upserts (no per-row queries).

Each chunk is one transaction: COPY rows into a typed temp table, then a single
INSERT ... SELECT ... ON CONFLICT upsert guarded by IS DISTINCT FROM so an
unchanged re-run rewrites nothing and fires no row triggers.
"""
from __future__ import annotations

import json
from typing import Any, Iterable

SPECS: dict[str, dict[str, Any]] = {
    "buildings": {
        "cols": [("id", "text"), ("name", "text"), ("building_type", "text"), ("latitude", "double precision"),
                 ("longitude", "double precision"), ("address", "text"), ("postal_code", "text"),
                 ("source_type", "text"), ("source_confidence", "numeric"), ("import_batch_id", "uuid")],
        "key": ["id"],
    },
    "venues": {
        "cols": [("id", "text"), ("building_id", "text"), ("name", "text"), ("unit_number", "text"), ("floor", "text"),
                 ("hygiene_grade", "text"), ("is_open", "boolean"), ("operating_hours", "text"), ("stall_id", "text"),
                 ("licence_no", "text"), ("cuisine_tags", "text[]"), ("dietary_tags", "text[]"), ("image_url", "text"),
                 ("latitude", "double precision"), ("longitude", "double precision"), ("address", "text"),
                 ("postal_code", "text"), ("google_place_id", "text"), ("google_rating", "numeric"),
                 ("google_review_count", "integer"), ("source_type", "text"), ("source_confidence", "numeric"),
                 ("last_verified_at", "date"), ("website_url", "text"), ("contact_phone", "text"), ("menu_url", "text"),
                 ("secondary_menu_url", "text"), ("is_generic_cuisine", "boolean"), ("import_batch_id", "uuid"),
                 ("menu_approved_for_display", "boolean"), ("menu_rights_status", "text")],
        "key": ["id"],
    },
    "dishes": {
        "cols": [("id", "text"), ("venue_id", "text"), ("building_id", "text"), ("name", "text"), ("description", "text"),
                 ("image_url", "text"), ("price", "numeric"), ("price_range", "text"), ("taste_tags", "text[]"),
                 ("cuisine_tags", "text[]"), ("food_type", "text"), ("source_type", "text"),
                 ("source_confidence", "numeric"), ("menu_source_url", "text"), ("secondary_menu_url", "text"),
                 ("price_confidence", "text"), ("is_generic_cuisine", "boolean"), ("dietary_status", "jsonb"),
                 ("menu_approved_for_display", "boolean"), ("menu_rights_status", "text"), ("import_batch_id", "uuid")],
        "key": ["id"],
    },
    "dish_taste_vectors": {
        "cols": [("dish_id", "text"), ("sweet", "numeric"), ("spicy", "numeric"), ("sour", "numeric"),
                 ("salty", "numeric"), ("rich", "numeric"), ("aromatic", "numeric"), ("confidence", "numeric"),
                 ("source", "text"), ("import_batch_id", "uuid")],
        "key": ["dish_id"],
    },
}

BACKUP_TABLES = ["buildings", "venues", "dishes", "dish_taste_vectors", "dish_dietary_flags", "dietary_flags"]
NEW_COLUMNS = [("buildings", "import_batch_id"), ("venues", "import_batch_id"), ("venues", "is_generic_cuisine"),
               ("venues", "secondary_menu_url"), ("dishes", "import_batch_id"), ("dishes", "price_confidence"),
               ("dishes", "is_generic_cuisine"), ("dishes", "secondary_menu_url"), ("dishes", "dietary_status"),
               ("dish_taste_vectors", "import_batch_id"), ("dish_dietary_flags", "import_batch_id")]


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")


def _array_literal(items: Iterable[str]) -> str:
    return "{" + ",".join('"' + str(i).replace("\\", "\\\\").replace('"', '\\"') + '"' for i in items) + "}"


def copy_field(value: Any, pgtype: str) -> str:
    if value is None:
        return "\\N"
    if pgtype.endswith("[]"):
        return _esc(_array_literal(value))
    if pgtype == "jsonb":
        return _esc(json.dumps(value, ensure_ascii=False, separators=(",", ":")))
    if isinstance(value, bool):
        return "t" if value else "f"
    return _esc(str(value))


def copy_block(table_alias: str, cols: list[tuple[str, str]], rows: list[dict]) -> str:
    names = ", ".join(c for c, _ in cols)
    body = "\n".join("\t".join(copy_field(r.get(c), t) for c, t in cols) for r in rows)
    data = f"{body}\n" if rows else ""   # an empty body line would be parsed as a data row
    return f"copy {table_alias} ({names}) from stdin;\n{data}\\.\n"


def temp_table_ddl(alias: str, cols: list[tuple[str, str]]) -> str:
    return f"create temp table {alias} ({', '.join(f'{c} {t}' for c, t in cols)}) on commit drop;\n"


def upsert_sql(table: str, alias: str, spec: dict[str, Any]) -> str:
    cols = [c for c, _ in spec["cols"]]
    key = spec["key"]
    upd = [c for c in cols if c not in key]
    sel = ", ".join(f"s.{c}" for c in cols)
    sets = ", ".join(f"{c} = excluded.{c}" for c in upd)
    target = ", ".join(f"public.{table}.{c}" for c in upd)
    src = ", ".join(f"excluded.{c}" for c in upd)
    return (f"insert into public.{table} ({', '.join(cols)})\nselect {sel} from {alias} s\n"
            f"on conflict ({', '.join(key)}) do update set {sets}\n"
            f"where ({target}) is distinct from ({src});\n")


# Preflight: returns one line per problem; empty output means staging is ready for the importer.
MIGRATION_CHECK_SQL = """
select 'missing column ' || r.t || '.' || r.c
from (values ('buildings','import_batch_id'),('venues','import_batch_id'),('venues','is_generic_cuisine'),
  ('venues','secondary_menu_url'),('dishes','import_batch_id'),('dishes','price_confidence'),
  ('dishes','is_generic_cuisine'),('dishes','secondary_menu_url'),('dishes','dietary_status'),
  ('dish_taste_vectors','import_batch_id'),('dish_dietary_flags','import_batch_id')) as r(t, c)
where not exists (select 1 from information_schema.columns c where c.table_schema = 'public'
  and c.table_name = r.t and c.column_name = r.c)
union all
select 'venues.hygiene_grade is NOT NULL: apply 20261114160000_hygiene_grade_nullable.sql first'
from information_schema.columns where table_schema = 'public' and table_name = 'venues'
  and column_name = 'hygiene_grade' and is_nullable = 'NO'
union all
select 'venues.hygiene_grade still has a default: apply 20261114160000_hygiene_grade_nullable.sql first'
from information_schema.columns where table_schema = 'public' and table_name = 'venues'
  and column_name = 'hygiene_grade' and column_default is not null
union all
select 'dishes_price_confidence_check does not allow delivery_price: apply 20261114150000_menu_import_columns.sql'
where not exists (select 1 from pg_constraint where conname = 'dishes_price_confidence_check'
  and conrelid = 'public.dishes'::regclass and pg_get_constraintdef(oid) like '%''delivery_price''%')
union all
select 'missing table public.areas (planning-area lookup)'
where to_regclass('public.areas') is null;
"""


def planning_area_sql(batch_id: str) -> str:
    """Fill planning_area for this batch from the nearest public.areas centre.

    The area-name discovery path (get_discovery_feed_by_location with p_area_name)
    matches on planning_area; the importer does not carry one, so derive it the way
    promote_staging_to_production does (nearest area centre). Idempotent: only NULLs.
    """
    import re
    if not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", batch_id):
        raise ValueError("batch id must be a lowercase uuid")
    nearest = ("(select a.name from public.areas a where a.center_lat is not null and a.center_lng is not null\n"
               "   order by (a.center_lat - {t}.latitude) ^ 2 + (a.center_lng - {t}.longitude) ^ 2 limit 1)")
    out = "\\set ON_ERROR_STOP on\nbegin;\nset local statement_timeout = 0;\n"
    for t in ("buildings", "venues"):
        out += (f"update public.{t} set planning_area = {nearest.format(t=t)}\n"
                f"where import_batch_id = '{batch_id}'::uuid and planning_area is null\n"
                f"  and latitude is not null and longitude is not null;\n")
    return out + "commit;\n"


PSQL_HEADER = "\\set ON_ERROR_STOP on\nbegin;\nset local statement_timeout = 0;\n"


def chunk_sql(table: str, rows: list[dict]) -> str:
    spec = SPECS[table]
    alias = f"_stg_{table}"
    return (PSQL_HEADER + temp_table_ddl(alias, spec["cols"]) + copy_block(alias, spec["cols"], rows)
            + upsert_sql(table, alias, spec) + "commit;\n")


def dish_chunk_sql(dishes: list[dict], tastes: list[dict], flags: list[dict], batch_id: str) -> str:
    """Dishes + their taste vectors + their dietary flags in ONE transaction."""
    dspec, tspec = SPECS["dishes"], SPECS["dish_taste_vectors"]
    fcols = [("dish_id", "text"), ("slug", "text"), ("import_batch_id", "uuid")]
    ids_cols = [("dish_id", "text")]
    sql = PSQL_HEADER
    sql += temp_table_ddl("_stg_dishes", dspec["cols"]) + copy_block("_stg_dishes", dspec["cols"], dishes)
    sql += temp_table_ddl("_stg_dish_taste_vectors", tspec["cols"]) + copy_block("_stg_dish_taste_vectors", tspec["cols"], tastes)
    sql += temp_table_ddl("_stg_flags", fcols) + copy_block("_stg_flags", fcols, flags)
    sql += upsert_sql("dishes", "_stg_dishes", dspec)
    sql += upsert_sql("dish_taste_vectors", "_stg_dish_taste_vectors", tspec)
    # Drop flags of THIS batch for these dishes that are no longer in the file, then add current ones.
    sql += (f"delete from public.dish_dietary_flags f using _stg_dishes d\n"
            f"where f.dish_id = d.id and f.import_batch_id = '{batch_id}'::uuid\n"
            f"and not exists (select 1 from _stg_flags s join public.dietary_flags df on df.slug = s.slug\n"
            f"  where s.dish_id = f.dish_id and df.id = f.dietary_flag_id);\n")
    sql += ("insert into public.dish_dietary_flags (dish_id, dietary_flag_id, import_batch_id)\n"
            "select s.dish_id, df.id, s.import_batch_id from _stg_flags s\n"
            "join public.dietary_flags df on df.slug = s.slug\n"
            "on conflict (dish_id, dietary_flag_id) do nothing;\n")
    return sql + "commit;\n"


def flag_seed_sql(seed: list[dict]) -> str:
    values = ",\n".join("('" + s["slug"].replace("'", "''") + "', '" + s["name"].replace("'", "''") + "')" for s in seed)
    return (PSQL_HEADER + f"insert into public.dietary_flags (slug, name) values\n{values}\n"
            "on conflict (slug) do nothing;\ncommit;\n")


def chunked(items: list, size: int) -> Iterable[list]:
    for i in range(0, len(items), size):
        yield items[i:i + size]
