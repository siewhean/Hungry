"""Disposable, network-isolated PostgreSQL regression for OCR atomic persistence."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
NAME = 'hungry-ocr-integrity-' + uuid.uuid4().hex[:10]

def run(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, capture_output=True, **kwargs).stdout

def sql(text):
    return run('docker', 'exec', '-i', NAME, 'psql', '-h', '127.0.0.1', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-At', input=text).strip()

def submit(number):
    return f"00000000-0000-0000-0000-{number:012d}"

def prepare(number):
    sql(f"insert into public.menu_photo_submissions(id,venue_id,building_id,ocr_status,ocr_job_id) values('{submit(number)}','venue','building','processing','job-{number}')")

def call(number, items):
    return f"select public.app_complete_menu_photo_ingestion('{submit(number)}','job-{number}',$items${items}$items$::jsonb,'original OCR evidence');"

try:
    run('docker', 'run', '-d', '--rm', '--network', 'none', '--name', NAME, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17')
    # The entrypoint first starts a temporary socket-only bootstrap server, then
    # restarts PostgreSQL. Require the final PID 1 server and a TCP connection;
    # socket pg_isready alone can succeed during bootstrap and race its shutdown.
    deadline = time.monotonic() + 60
    while True:
        ready = subprocess.run(
            ['docker', 'exec', NAME, 'sh', '-c',
             'test "$(cat /proc/1/comm)" = postgres && pg_isready -h 127.0.0.1 -U postgres'],
            text=True, capture_output=True, timeout=10,
        )
        if ready.returncode == 0:
            break
        if time.monotonic() >= deadline:
            logs = subprocess.run(['docker', 'logs', NAME], text=True, capture_output=True)
            raise RuntimeError('PostgreSQL final server did not become ready: '
                               + ready.stderr + logs.stderr + logs.stdout)
        time.sleep(0.1)
    sql("""
create role anon; create role authenticated; create role service_role;
create table public.menu_photo_submissions (
 id uuid primary key, venue_id text not null, building_id text not null,
 ocr_status text not null, ocr_job_id text, vision_response jsonb,
 processed_at timestamptz, ocr_error text
);
create table public.dishes_draft (
 id uuid primary key default gen_random_uuid(), venue_id text not null, building_id text not null,
 source_photo_id uuid, name text not null, name_normalized text not null,
 price_cents integer check(price_cents >= 0), modifiers jsonb not null default '[]',
 ocr_raw_text text, extraction_confidence numeric(4,3) not null check(extraction_confidence between 0 and 1),
 confidence_bumps integer not null default 0, review_status text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
""")
    sql((ROOT/'supabase/migrations/20261116200000_ocr_ingestion_integrity.sql').read_text())
    assert sql("select has_function_privilege('anon','public.app_complete_menu_photo_ingestion(uuid,text,jsonb,text)','execute')") == 'f'
    assert sql("select has_function_privilege('authenticated','public.app_complete_menu_photo_ingestion(uuid,text,jsonb,text)','execute')") == 'f'
    assert sql("select has_function_privilege('service_role','public.app_complete_menu_photo_ingestion(uuid,text,jsonb,text)','execute')") == 't'
    prepare(1)
    items='[{"name":"Tea","price_cents":500,"modifiers":[],"extraction_confidence":0.6},{"name":"Pie","price_cents":500,"modifiers":[],"extraction_confidence":0.7}]'
    assert sql(call(1,items)) == '2'
    assert sql("select count(*) from dishes_draft") == '2'
    assert sql(call(1,items)) == '2' # Same completed job: no new evidence/bump.
    assert sql("select sum(confidence_bumps) from dishes_draft") == '0'
    prepare(2)
    assert sql(call(2,'[{"name":"Tea","price_cents":500,"modifiers":[],"extraction_confidence":0.95},{"name":"Tea","price_cents":500,"modifiers":[],"extraction_confidence":0.7}]')) == '2'
    assert sql("select extraction_confidence || '/' || confidence_bumps from dishes_draft where name='Tea'") == '0.950/2'
    assert sql("select ocr_raw_text from dishes_draft where name='Tea'") == 'original OCR evidence'
    prepare(3)
    try:
        sql(call(3,'[{"name":"Temporary","price_cents":100,"modifiers":[],"extraction_confidence":0.5},{"name":" ","price_cents":100,"modifiers":[],"extraction_confidence":0.5}]'))
        raise AssertionError('invalid second item must abort transaction')
    except subprocess.CalledProcessError as error:
        assert 'ocr_empty_name' in error.stderr
    assert sql("select count(*) from dishes_draft where name='Temporary'") == '0'
    assert sql(f"select ocr_status from menu_photo_submissions where id='{submit(3)}'") == 'processing'
    prepare(4); prepare(5)
    one='[{"name":"Tea","price_cents":500,"modifiers":[],"extraction_confidence":0.8}]'
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda n: sql('begin;'+call(n,one)+'select pg_sleep(0.15);commit;'),[4,5]))
    assert sql("select extraction_confidence || '/' || confidence_bumps from dishes_draft where name='Tea'") == '0.950/4'
    assert sql("select count(*) from dishes_draft where name='Tea'") == '1'
    prepare(6)
    variants='[{"name":"Tea","price_cents":600,"modifiers":[],"extraction_confidence":0.8},{"name":"Tea","price_cents":500,"modifiers":["Large"],"extraction_confidence":0.8}]'
    sql(call(6,variants))
    assert sql("select count(*) from dishes_draft where name='Tea'") == '3'
    prepare(7)
    sql("""create function reject_completion() returns trigger language plpgsql as $$begin if new.ocr_status='succeeded' and new.ocr_job_id='job-7' then raise exception 'injected_completion_failure'; end if; return new; end$$;
create trigger fail_completion before update on menu_photo_submissions for each row execute function reject_completion();""")
    try:
        sql(call(7,'[{"name":"Must Roll Back","price_cents":100,"modifiers":[],"extraction_confidence":0.5}]'))
        raise AssertionError('completion failure must abort every draft write')
    except subprocess.CalledProcessError as error:
        assert 'injected_completion_failure' in error.stderr
    assert sql("select count(*) from dishes_draft where name='Must Roll Back'") == '0'
    assert sql(f"select ocr_status from menu_photo_submissions where id='{submit(7)}'") == 'processing'
    print('PASS: grants, exact identity/variants, atomic rollback, idempotent replay, sequential/concurrent max confidence and counters, immutable OCR evidence')
except subprocess.CalledProcessError as error:
    print(error.stderr or error.stdout or str(error), file=sys.stderr)
    raise
finally:
    subprocess.run(['docker','rm','-f',NAME], check=False, capture_output=True)
