-- Points venues at the brand logos copied into Supabase Storage by scripts/upload_brand_logos.py.
-- The caller wraps this in begin/rollback (dry run) or begin/commit, after the script has written
-- /tmp/brand_logo_venues.csv (psql's \copy does not interpolate variables).
-- Venues whose verified merchant set their own photo keep it.
\set ON_ERROR_STOP on

create temp table brand_logo_load (venue_id text, logo_url text) on commit drop;
\copy brand_logo_load from '/tmp/brand_logo_venues.csv' with (format csv, header true)

\echo 'before:'
select count(*) as venues, count(logo_url) as with_logo from public.venues;

select count(*) as csv_rows,
       count(*) filter (where v.id is null) as unknown_venue_ids,
       count(*) filter (where v.logo_url is not null) as replacing_existing_logo
from brand_logo_load b left join public.venues v on v.id = b.venue_id;

update public.venues v
set logo_url = b.logo_url
from brand_logo_load b
where v.id = b.venue_id
  and v.logo_url is distinct from b.logo_url
  and not exists (
    select 1 from public.merchant_outlets mo
    where mo.venue_id = v.id
      and nullif(trim(coalesce(mo.profile_photo_url, '')), '') is not null
      and public.merchant_outlet_is_verified(mo.id)
  );

\echo 'after:'
select count(*) as venues, count(logo_url) as with_logo,
       count(*) filter (where logo_url like '%/storage/v1/object/public/brand-logos/%') as with_brand_logo
from public.venues;

select public.catalog_raw_publish_release() as release_id;
