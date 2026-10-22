#!/usr/bin/env python3
"""Write the latest definition of every function created in supabase/migrations/*.sql
to one file per function, optionally ignoring migrations at or after a version.

usage: extract_functions.py <out_dir> [--before <migration file name>]
"""
import glob
import os
import re
import sys

out = sys.argv[1]
before = sys.argv[sys.argv.index("--before") + 1] if "--before" in sys.argv else None
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "migrations")

defs = {}
for path in sorted(glob.glob(os.path.join(root, "*.sql"))):
    name = os.path.basename(path)
    if before and name >= before:
        break
    sql = open(path).read()
    for m in re.finditer(r"create\s+(?:or\s+replace\s+)?function\s+([\w.\"]+)\s*\(", sql, re.I):
        tag = re.search(r"\$(\w*)\$", sql[m.end():])
        if not tag:
            continue
        body_start = m.end() + tag.end()
        body_end = sql.find(tag.group(0), body_start)
        stmt_end = sql.find(";", body_end)
        defs[m.group(1).lower().replace('"', "")] = (name, sql[m.start():stmt_end + 1])

os.makedirs(out, exist_ok=True)
for fn, (name, text) in defs.items():
    with open(os.path.join(out, fn.replace(".", "__") + ".sql"), "w") as f:
        f.write(text)
print(f"{len(defs)} functions written to {out}")
