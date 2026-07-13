-- Publish only after the full canonical import is complete. The function
-- refuses to activate a partial snapshot and retains the previous release for
-- 24 hours so in-flight cursor sessions remain stable.
select public.catalog_raw_publish_release(
  p_expected_venues => 119232,
  p_expected_dishes => 156010
) as release_id;
