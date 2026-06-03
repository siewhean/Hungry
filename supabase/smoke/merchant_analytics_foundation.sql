do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'merchant_analytics_events',
    'merchant_promotion_events',
    'merchant_analytics_daily_rollups',
    'merchant_dish_analytics_daily',
    'merchant_weekly_summaries',
    'merchant_audit_logs'
  ]
  loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'missing merchant analytics table: %', table_name;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relrowsecurity
    ) then
      raise exception 'merchant analytics table does not have rowsecurity enabled: %', table_name;
    end if;
  end loop;

  if to_regprocedure('public.record_merchant_action_event(text,text,uuid,text,text,uuid,text,jsonb)') is null then
    raise exception 'missing record_merchant_action_event RPC';
  end if;

  if to_regprocedure('public.get_merchant_analytics(uuid,timestamp with time zone,timestamp with time zone)') is null then
    raise exception 'missing get_merchant_analytics RPC';
  end if;

  if to_regprocedure('public.persist_merchant_weekly_summary(uuid,date,date,integer,integer,jsonb,integer,numeric,numeric,integer,integer,jsonb)') is null then
    raise exception 'missing persist_merchant_weekly_summary RPC';
  end if;

  if has_table_privilege('anon', 'public.merchant_analytics_events', 'insert') then
    raise exception 'anon can insert merchant analytics events directly';
  end if;

  if has_table_privilege('authenticated', 'public.merchant_analytics_events', 'insert') then
    raise exception 'authenticated can insert merchant analytics events directly';
  end if;
end $$;
