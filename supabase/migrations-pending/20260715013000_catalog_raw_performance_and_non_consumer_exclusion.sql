-- Keep source rows auditable, but remove clearly non-consumer locations from
-- every authenticated raw-catalog read. Legal entity suffixes are deliberately
-- not used: many legitimate restaurants are registered as Pte Ltd companies.
create table if not exists public.catalog_raw_excluded_venues (
  venue_id text primary key,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.catalog_raw_excluded_venues enable row level security;
revoke all on public.catalog_raw_excluded_venues from public, anon, authenticated;

insert into public.catalog_raw_excluded_venues (venue_id, reason)
select distinct c.id,
  case
    when lower(c.name) ~ '(^|[^a-z0-9])(7[- ]?eleven|cheers|fairprice xpress|shell select|caltex star mart|spc.?go)([^a-z0-9]|$)' then 'convenience_store'
    when lower(c.name) ~ '(school|primary school|secondary school|junior college|polytechnic|university|kindergarten|child.?care|student care)' then 'education_site'
    when lower(c.name) ~ '(staff canteen|employee canteen|workers? canteen|army camp|military camp|air base|naval base|police station|prison)' then 'private_or_restricted_site'
    when lower(c.name) ~ '(food processing|manufactur|warehouse|cold store|distribution centre|distribution center|factory|industrial)' then 'non_consumer_business'
    else 'non_consumer_business'
  end
from public.catalog_raw_venue_cards c
where c.release_id = (select id from public.catalog_releases where status = 'active' limit 1)
  and lower(c.name) ~ '(7[- ]?eleven|cheers|fairprice xpress|shell select|caltex star mart|spc.?go|school|primary school|secondary school|junior college|polytechnic|university|kindergarten|child.?care|student care|staff canteen|employee canteen|workers? canteen|army camp|military camp|air base|naval base|police station|prison|food processing|manufactur|warehouse|cold store|distribution centre|distribution center|factory|industrial)'
on conflict (venue_id) do nothing;

do $$
declare
  v_definition text;
  v_original text;
begin
  -- Let PostgreSQL use release/rank indexes and push filters into the page query.
  select pg_get_functiondef('public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[])'::regprocedure)
    into v_definition;
  v_original := v_definition;
  v_definition := replace(v_definition, 'candidates as materialized', 'candidates as not materialized');
  v_definition := replace(
    v_definition,
    E'where c.release_id = v_release\n      and (p_venue_id is null or c.venue_id = p_venue_id)',
    E'where c.release_id = v_release\n      and not exists (select 1 from public.catalog_raw_excluded_venues e where e.venue_id = c.venue_id)\n      and (p_venue_id is null or c.venue_id = p_venue_id)'
  );
  if v_definition = v_original then
    raise exception 'catalog_raw_dishes_page patch did not apply';
  end if;
  execute v_definition;

  select pg_get_functiondef('public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[])'::regprocedure)
    into v_definition;
  v_original := v_definition;
  v_definition := replace(v_definition, 'candidates as materialized', 'candidates as not materialized');
  v_definition := replace(
    v_definition,
    'from public.catalog_raw_venue_cards c where c.release_id = v_release and (p_open_only = false or c.is_open)',
    E'from public.catalog_raw_venue_cards c where c.release_id = v_release\n      and not exists (select 1 from public.catalog_raw_excluded_venues e where e.venue_id = c.id)\n      and (p_open_only = false or c.is_open)'
  );
  if v_definition = v_original then
    raise exception 'catalog_raw_venues_page patch did not apply';
  end if;
  execute v_definition;

  select pg_get_functiondef('public.catalog_raw_dish_detail(text,uuid)'::regprocedure) into v_definition;
  v_definition := replace(
    v_definition,
    'from public.catalog_raw_dish_cards c where c.release_id = v_release and c.id = p_dish_id',
    E'from public.catalog_raw_dish_cards c where c.release_id = v_release\n    and not exists (select 1 from public.catalog_raw_excluded_venues e where e.venue_id = c.venue_id)\n    and c.id = p_dish_id'
  );
  execute v_definition;

  select pg_get_functiondef('public.catalog_raw_venue_detail(text,uuid)'::regprocedure) into v_definition;
  v_definition := replace(
    v_definition,
    'from public.catalog_raw_venue_cards c where c.release_id = v_release and c.id = p_venue_id',
    E'from public.catalog_raw_venue_cards c where c.release_id = v_release\n    and not exists (select 1 from public.catalog_raw_excluded_venues e where e.venue_id = c.id)\n    and c.id = p_venue_id'
  );
  execute v_definition;
end;
$$;
