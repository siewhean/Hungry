-- Rendered and executed only by scripts/publish-catalog-raw-release.mjs.
-- The script verifies the checked-in source manifest and workbook checksum,
-- then substitutes the four quoted values below before calling this file.
-- It is intentionally bounded: an already-running publisher fails instead of
-- waiting indefinitely, and a slow candidate cannot hold the release lock.
begin;
set local lock_timeout = '5 seconds';
set local statement_timeout = '15 minutes';

insert into public.catalog_raw_release_manifests (
  manifest_version,
  source_kind,
  source_checksum,
  expected_venue_total,
  expected_dish_total
) values (
  :'manifest_version',
  :'source_kind',
  :'source_checksum',
  :expected_venue_total,
  :expected_dish_total
)
on conflict (manifest_version) do nothing;

do $$
declare
  v_manifest public.catalog_raw_release_manifests%rowtype;
begin
  select * into v_manifest
  from public.catalog_raw_release_manifests
  where manifest_version = :'manifest_version';

  if v_manifest.source_kind is distinct from :'source_kind'
    or v_manifest.source_checksum is distinct from :'source_checksum'
    or v_manifest.expected_venue_total is distinct from :expected_venue_total
    or v_manifest.expected_dish_total is distinct from :expected_dish_total then
    raise exception 'catalog source manifest version conflicts with immutable stored values';
  end if;
end;
$$;

with published as (
  select public.catalog_raw_publish_release(:'manifest_version') as release_id
)
select r.id as release_id,
  r.status,
  r.source_manifest_version,
  r.source_manifest_checksum,
  r.venue_total,
  r.dish_total,
  r.quality_findings,
  r.quality_summary,
  r.activated_at
from public.catalog_releases r
join published p on p.release_id = r.id;

commit;
