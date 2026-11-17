"""Isolated PostgreSQL receipt lifecycle/grant regression. No network or host ports."""
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[3]
NAME = 'hungry-receipts-' + uuid.uuid4().hex[:10]
def sql(source):
    result = subprocess.run(['docker', 'exec', '-i', NAME, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], input=source, text=True, capture_output=True)
    if result.returncode: raise RuntimeError(result.stderr)
    return result.stdout
try:
    subprocess.run(['docker', 'run', '--rm', '-d', '--name', NAME, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17'], check=True, capture_output=True)
    for _ in range(60):
        if subprocess.run(['docker', 'exec', NAME, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], capture_output=True).returncode == 0: break
        time.sleep(0.25)
    sql("""
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.notification_jobs(id uuid primary key,user_id uuid references auth.users(id),status text default 'pending',skip_reason text,locked_at timestamptz,attempts int default 0,created_at timestamptz default now(),sent_at timestamptz);
      create table public.user_push_tokens(user_id uuid, token text);
      grant usage on schema public to service_role;
      grant all on public.notification_jobs,public.user_push_tokens to service_role;
      insert into auth.users values ('00000000-0000-0000-0000-000000000001');
      insert into notification_jobs(id,user_id,status) select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000001','accepted' from generate_series(1,3)n;
      insert into user_push_tokens values('00000000-0000-0000-0000-000000000001','dead-token');
    """)
    migration = (ROOT/'supabase/migrations/20261116202000_notification_receipts.sql').read_text()
    sql(migration)
    sql(migration)  # Replay-safe additive deployment.
    sql("""
      do $$ begin
        if has_table_privilege('authenticated','notification_receipts','select') or has_table_privilege('anon','notification_receipts','select') then raise exception 'receipt privacy grant'; end if;
        if has_function_privilege('authenticated','record_notification_tickets(uuid,jsonb)','execute') then raise exception 'receipt write exposed'; end if;
      end $$;
      set role service_role;
      select record_notification_tickets('00000000-0000-0000-0000-000000000001','[{"ticket_id":"ok-ticket","token":"alive-token"}]');
      select record_notification_tickets('00000000-0000-0000-0000-000000000002','[{"ticket_id":"bad-ticket","token":"dead-token"}]');
      select record_notification_tickets('00000000-0000-0000-0000-000000000003','[{"ticket_id":"missing-ticket","token":"other-token"}]');
      do $$ begin if (select count(*) from claim_notification_receipts(1000))<>0 then raise exception 'premature polling'; end if; end $$;
      update notification_receipts set next_check_at=now()-interval '1 minute';
      do $$ begin if (select count(*) from claim_notification_receipts(1000))<>3 then raise exception 'claim failed'; end if;
        if (select count(*) from claim_notification_receipts(1000))<>0 then raise exception 'claim lease failed'; end if; end $$;
      update notification_receipts set created_at=now()-interval '24 hours' where ticket_id='missing-ticket';
      select settle_notification_receipts('[{"ticket_id":"ok-ticket","status":"ok"},{"ticket_id":"bad-ticket","status":"error","error_code":"DeviceNotRegistered"},{"ticket_id":"missing-ticket","status":"pending"}]');
      do $$ begin
        if (select status from notification_jobs where id='00000000-0000-0000-0000-000000000001')<>'sent' then raise exception 'provider confirmation missing'; end if;
        if (select status from notification_jobs where id='00000000-0000-0000-0000-000000000002')<>'failed' then raise exception 'failure not recorded'; end if;
        if exists(select 1 from user_push_tokens where token='dead-token') then raise exception 'dead token retained'; end if;
        if (select status from notification_jobs where id='00000000-0000-0000-0000-000000000003')<>'delivery_unknown' then raise exception 'expiry not retained'; end if;
      end $$;
      insert into notification_jobs(id,user_id,status) values('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','accepted');
      select record_notification_tickets('00000000-0000-0000-0000-000000000004','[{"ticket_id":"outage-ticket","token":"outage-token"}]');
      update notification_receipts set created_at=now()-interval '24 hours',next_check_at=now()+interval '1 day' where ticket_id='outage-ticket';
      -- Expiry must happen without any Expo call, including rows whose poll lease
      -- extends beyond TTL after an outage. No resend is queued.
      do $$ begin
        if (select count(*) from claim_notification_receipts(1000))<>0 then raise exception 'expired receipt was sent to provider'; end if;
        if (select status from notification_receipts where ticket_id='outage-ticket')<>'expired' then raise exception 'outage receipt not expired locally'; end if;
        if (select status from notification_jobs where id='00000000-0000-0000-0000-000000000004')<>'delivery_unknown' then raise exception 'outage job should be held not resent'; end if;
      end $$;
      reset role;
    """)
    sql((ROOT/'supabase/manual/20261116202000_notification_receipts_down.sql').read_text())
    sql(migration)
    print('PASS: receipt lifecycle, claim lease, private grants, token cleanup, receipt expiry including persistent provider outage, replay and rollback/reapply')
finally:
    subprocess.run(['docker', 'rm', '-f', NAME], capture_output=True)
