#!/usr/bin/env python3
"""Compare discovery feed SQL on an isolated loopback database without installing either variant."""

import argparse
import json
import math
import os
import re
import subprocess
import uuid
from pathlib import Path

SIGNATURE = "public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)"
PARAMETERS = ("p_area_name", "p_lat", "p_lng", "p_radius_meters", "p_limit", "p_building_id")
SCENARIOS = {"area", "gps", "mall", "national", "empty"}
TOP_DISH = re.compile(
    r"left join lateral \(\s+select d\.\*\s+from dishes d\s+"
    r"where d\.venue_id = cv\.id\s+and (?P<eligibility>.*?)\s+"
    r"order by\s+(?P<ranking>.*?)\s+limit 1\s+\) top_dish on true",
    re.DOTALL | re.IGNORECASE,
)


def set_based_variant(body):
    matches = list(TOP_DISH.finditer(body))
    if len(matches) != 1:
        raise ValueError("deployed top-dish plan changed. Review eligibility and ranking before rebasing the candidate.")
    match = matches[0]
    fragment = (
        "left join (\n"
        "      select distinct on (d.venue_id) d.*\n"
        "      from dishes d\n"
        "      join (select distinct id from candidate_venues) v on v.id = d.venue_id\n"
        f"      where {match['eligibility']}\n"
        f"      order by d.venue_id, {match['ranking']}\n"
        "    ) top_dish on top_dish.venue_id = cv.id"
    )
    return body[:match.start()] + fragment + body[match.end():]


def literal(value):
    if value is None:
        return "null"
    if isinstance(value, str) and "\x00" not in value:
        return "'" + value.replace("'", "''") + "'"
    if type(value) in (int, float) and math.isfinite(value):
        return str(value)
    raise ValueError("fixture values must be finite numbers, strings or null")


def read_cases(file):
    cases = json.loads(file.read_text(encoding="utf-8"))
    if not isinstance(cases, dict) or set(cases) != SCENARIOS:
        raise ValueError("fixture file requires area, gps, mall, national and empty objects")
    for name, fields in cases.items():
        if not isinstance(fields, dict) or set(fields) - (set(PARAMETERS) - {"p_limit"}):
            raise ValueError(f"unexpected request parameters for {name}")
        for key in ("p_area_name", "p_building_id"):
            if fields.get(key) is not None and not isinstance(fields[key], str):
                raise ValueError(f"{key} requires text")
        for key in ("p_lat", "p_lng", "p_radius_meters"):
            if fields.get(key) is not None and type(fields[key]) not in (int, float):
                raise ValueError(f"{key} requires a number")
        if name in ("gps", "empty") and (fields.get("p_lat") is None or fields.get("p_lng") is None):
            raise ValueError(f"{name} requires latitude and longitude")
        if name == "area" and not fields.get("p_area_name"):
            raise ValueError("area requires a known planning area")
        if name == "mall" and not fields.get("p_building_id"):
            raise ValueError("mall requires a known building id")
        if name == "national" and fields:
            raise ValueError("national requires an empty request object")
    return cases


def local_psql(args, sql):
    # Avoid libpq configuration that could replace an explicit loopback destination.
    env = {"PATH": os.environ.get("PATH", ""), "PGCLIENTENCODING": "UTF8"}
    if "PGPASSWORD" in os.environ:
        env["PGPASSWORD"] = os.environ["PGPASSWORD"]
    command = [
        "psql", "-X", "-qAt0", "--no-password", "-v", "ON_ERROR_STOP=1", "--host", "127.0.0.1",
        "--port", str(args.port), "--dbname", args.database, "--username", args.user, "-f", "-",
    ]
    result = subprocess.run(command, input=sql, text=True, stdout=subprocess.PIPE, env=env, check=True)
    return [json.loads(record) for record in result.stdout.split("\0") if record]


def compile_case(body, case, limit):
    values = {key: literal(case.get(key)) for key in PARAMETERS}
    values["p_limit"] = str(limit)
    return re.sub(r"\b(?:" + "|".join(PARAMETERS) + r")\b", lambda match: values[match[0]], body)


def explain(statement):
    return f"explain (analyze, buffers, timing off, summary on, format json) {statement};"


def run(args):
    info, = local_psql(args, f"""
begin read only;
select json_build_object('body', p.prosrc, 'body_md5', md5(p.prosrc),
   'security_definer', p.prosecdef, 'language', l.lanname,
   'search_path', p.proconfig, 'version', current_setting('server_version'),
   'catalog', (select json_object_agg(c.relname, c.reltuples::bigint)
      from pg_class c join pg_namespace n on c.relnamespace = n.oid
      where n.nspname = 'public' and c.relname in ('dishes', 'venues', 'dish_images', 'buildings')))
from pg_proc p join pg_language l on p.prolang = l.oid
where p.oid = '{SIGNATURE}'::regprocedure;
rollback;
""")
    baseline = info.pop("body").strip().removesuffix(";")
    if (info["security_definer"] or info["language"] != "sql" or
            info["search_path"] != ["search_path=public, extensions"] or
            not baseline.lower().startswith("with ")):
        raise ValueError("feed function execution context changed. Review the benchmark before reusing it.")
    variant = set_based_variant(baseline)
    cases = read_cases(args.fixtures)
    print(json.dumps({"benchmark": info, "role": "authenticated", "rounds": args.rounds}), flush=True)
    success = True
    for name, case in cases.items():
        for limit in (10, 100):
            baseline_sql = compile_case(baseline, case, limit)
            candidate_sql = compile_case(variant, case, limit)
            wrapper_args = ", ".join(literal(limit if key == "p_limit" else case.get(key)) for key in PARAMETERS)
            sql = [
                "begin read only;",
                "set local role authenticated;",
                "set local search_path = public, extensions;",
                "set local statement_timeout = '25s';",
                f"set local request.jwt.claims = '{{\"sub\": \"{args.fixture_user}\", \"role\": \"authenticated\"}}';",
                f"""with results as (
  select to_jsonb(array(select to_jsonb(t) from ({baseline_sql}) t)) as baseline,
         to_jsonb(array(select to_jsonb(t) from ({candidate_sql}) t)) as candidate,
         to_jsonb(array(select to_jsonb(t) from public.get_discovery_feed_by_location({wrapper_args}) t)) as rpc
)
select json_build_object('parity', baseline = candidate, 'matches_rpc', baseline = rpc,
  'rows', jsonb_array_length(baseline), 'bytes', octet_length(baseline::text),
  'candidate_bytes', octet_length(candidate::text),
  'has_actionable_dish', exists (select 1 from jsonb_array_elements(baseline) item
      where nullif(item->>'top_dish_id', '') is not null and (item->>'top_dish_price')::numeric > 0))
from results;""",
            ]
            order = []
            for index in range(args.rounds):
                sequence = ((("baseline", baseline_sql), ("set_based", candidate_sql))
                            if index % 2 == 0 else (("set_based", candidate_sql), ("baseline", baseline_sql)))
                for label, statement in sequence:
                    order.append(label)
                    sql.append(explain(statement))
            records = local_psql(args, "\n".join([*sql, "rollback;"]))
            result, *plans = records
            expected = result["rows"] == 0 if name == "empty" else result["has_actionable_dish"]
            success &= result["parity"] and result["matches_rpc"] and expected
            print(json.dumps({"scenario": name, "limit": limit, "expected_scope": expected, **result}), flush=True)
            for label, plan in zip(order, plans, strict=True):
                print(json.dumps({"scenario": name, "limit": limit, "variant": label, "explain": plan}), flush=True)
    return 0 if success else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--isolated-local-db", action="store_true", required=True)
    parser.add_argument("--port", type=int, default=54322)
    parser.add_argument("--database", default="postgres")
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--fixture-user", type=uuid.UUID, required=True)
    parser.add_argument("--fixtures", type=Path, required=True)
    parser.add_argument("--rounds", type=int, default=5, choices=range(1, 21), metavar="1–20")
    args = parser.parse_args()
    if not all(re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value) for value in (args.database, args.user)):
        parser.error("database and user must be plain local PostgreSQL identifiers")
    try:
        return run(args)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    raise SystemExit(main())
