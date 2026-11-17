"""CR-E02/E08: execute the real migration in disposable, network-isolated PostgreSQL."""
import pathlib
import subprocess
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
container = 'hungry-ops-review-test-' + uuid.uuid4().hex[:10]


def sql(text):
    result = subprocess.run(['docker', 'exec', '-i', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], input=text, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout


try:
    subprocess.run(['docker', 'run', '--rm', '-d', '--network', 'none', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17'], check=True, capture_output=True, text=True)
    for attempt in range(100):
        ready = subprocess.run(['docker', 'exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], capture_output=True)
        if ready.returncode == 0:
            break
        time.sleep(0.1)
    else:
        raise RuntimeError('PostgreSQL did not become ready')
    sql('''
      create role anon; create role authenticated; create role service_role;
      create table public.app_ops_admins (user_id uuid primary key, enabled boolean, role text);
      create table public.dishes_draft (
        id uuid primary key, review_status text, ocr_raw_text text, reviewed_by uuid,
        reviewed_at timestamptz, updated_at timestamptz, created_at timestamptz default now()
      );
      create table public.app_ops_audit_events (
        actor_user_id uuid, action text, target_type text, target_id text,
        origin text, ip_hash text, metadata jsonb
      );
    ''')
    migration = (ROOT / 'supabase/migrations/20261116201000_ops_review_integrity.sql').read_text()
    sql(migration)
    sql(migration)  # replay-safe DDL
    sql('''
      insert into public.app_ops_admins values ('00000000-0000-0000-0000-000000000001', true, 'operator');
      insert into public.dishes_draft(id, review_status, ocr_raw_text) values
        ('00000000-0000-0000-0000-000000000002', 'pending', 'original OCR evidence');
      set role service_role;
      select public.app_review_dish_draft('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'accepted', 'operator note');
      reset role;
      do $$ begin
        if not exists(select 1 from public.dishes_draft where review_status='accepted' and ocr_raw_text='original OCR evidence' and review_notes='operator note' and reviewed_by='00000000-0000-0000-0000-000000000001') then raise exception 'review/evidence mismatch'; end if;
        if (select count(*) from public.app_ops_audit_events) <> 1 then raise exception 'missing audit'; end if;
        if has_function_privilege('anon', 'public.app_review_dish_draft(uuid,uuid,text,text,text,text)', 'EXECUTE') or has_function_privilege('authenticated', 'public.app_review_dish_draft(uuid,uuid,text,text,text,text)', 'EXECUTE') then raise exception 'public execute grant leaked'; end if;
      end $$;
      create function public.reject_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable' using errcode='23514'; end $$;
      create trigger audit_failure before insert on public.app_ops_audit_events for each row execute function public.reject_audit();
      do $$ begin
        begin
          perform public.app_review_dish_draft('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'rejected', 'replacement note');
          raise exception 'expected audit failure';
        exception when check_violation then null; end;
        if not exists(select 1 from public.dishes_draft where review_status='accepted' and review_notes='operator note' and ocr_raw_text='original OCR evidence') then raise exception 'audit failure did not roll back review'; end if;
        begin
          perform public.app_review_dish_draft('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000099', 'accepted');
          raise exception 'expected forbidden actor';
        exception when insufficient_privilege then null; end;
        begin
          perform public.app_review_dish_draft('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'promoted');
          raise exception 'expected invalid decision';
        exception when invalid_parameter_value then null; end;
        begin
          perform public.app_review_dish_draft('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000001', 'accepted');
          raise exception 'expected missing draft';
        exception when no_data_found then null; end;
      end $$;
    ''')
    sql((ROOT / 'supabase/manual/20261116201000_ops_review_integrity_down.sql').read_text())
    sql('''do $$ begin
      if to_regprocedure('public.app_review_dish_draft(uuid,uuid,text,text,text,text)') is not null then raise exception 'rollback left RPC'; end if;
      if not exists(select 1 from public.dishes_draft where review_notes='operator note' and ocr_raw_text='original OCR evidence') then raise exception 'rollback destroyed evidence'; end if;
    end $$;''')
    print('PASS: migration replay, service role RPC, original OCR/notes, atomic audit rollback, denied grants/actor/decision/missing draft, evidence-preserving rollback')
finally:
    subprocess.run(['docker', 'rm', '-f', container], capture_output=True)
