-- Publish only after the full canonical import is complete. A mismatch records
-- a failed release and never moves the active pointer; success retains the
-- prior release for 24 hours so in-flight cursor sessions remain stable.
with published as (
  select public.catalog_raw_publish_release(
    p_expected_venues => 119232,
    p_expected_dishes => 156010
  ) as release_id
)
select r.id as release_id, r.status, r.venue_total, r.dish_total, r.activated_at
from public.catalog_releases r
join published p on p.release_id = r.id;
