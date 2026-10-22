"""Copy every storage object from the old Supabase project to the new one.

Called by move-project.sh storage with the path to a JSON list of
{bucket, name, type, cache}. Reads SRC_API_URL, SRC_SERVICE_KEY, DST_API_URL, DST_SERVICE_KEY
from the environment. Safe to re-run: uploads use x-upsert.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

SRC = os.environ["SRC_API_URL"].rstrip("/")
DST = os.environ["DST_API_URL"].rstrip("/")
SRC_KEY = os.environ["SRC_SERVICE_KEY"]
DST_KEY = os.environ["DST_SERVICE_KEY"]
TRIES = 3


def path_of(base, kind, bucket, name):
    quoted = "/".join(urllib.parse.quote(part, safe="") for part in name.split("/"))
    return f"{base}/storage/v1/object/{kind}{bucket}/{quoted}"


def request(req):
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def copy_one(obj):
    bucket, name = obj["bucket"], obj["name"]
    content_type = obj.get("type") or "application/octet-stream"
    last = None
    for _ in range(TRIES):
        try:
            data = request(urllib.request.Request(
                path_of(SRC, "authenticated/", bucket, name),
                headers={"Authorization": f"Bearer {SRC_KEY}", "apikey": SRC_KEY},
            ))
            request(urllib.request.Request(
                path_of(DST, "", bucket, name),
                data=data,
                method="POST",
                headers={
                    "Authorization": f"Bearer {DST_KEY}",
                    "apikey": DST_KEY,
                    "Content-Type": content_type,
                    "x-upsert": "true",
                    "cache-control": obj.get("cache") or "max-age=3600",
                },
            ))
            return None
        except (urllib.error.URLError, TimeoutError) as err:
            last = err
    return f"{bucket}/{name}: {last}"


def main():
    with open(sys.argv[1], encoding="utf-8") as f:
        objects = json.load(f)
    print(f"==> copying {len(objects)} storage objects", flush=True)
    failures = []
    # n-plus-one-ok: one file transfer per object; storage has no bulk copy between projects
    with ThreadPoolExecutor(max_workers=8) as pool:
        for i, err in enumerate(pool.map(copy_one, objects), 1):
            if err:
                failures.append(err)
            if i % 200 == 0:
                print(f"    {i}/{len(objects)}", flush=True)
    if failures:
        print(f"{len(failures)} failed:", file=sys.stderr)
        for line in failures[:30]:
            print("  " + line, file=sys.stderr)
        sys.exit(1)
    print(f"==> copied {len(objects)} objects", flush=True)


main()
