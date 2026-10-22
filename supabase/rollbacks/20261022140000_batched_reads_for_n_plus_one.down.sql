-- Down for 20261022140000_batched_reads_for_n_plus_one.
-- down-loses-data: only the four rate-limit rule rows this migration added (configuration, not user data).
-- expect-row-loss: app_private.request_rate_rules
-- The functions are new helpers that own no data. The app falls back to per-stall reads where it can
-- (getVenuesByIds); older builds never call them.
delete from app_private.request_rate_rules
where route in (
  'rpc/get_venue_summaries', 'rpc/get_item_details',
  'rpc/merchant_set_dishes_availability_flag', 'rpc/reorder_popular_visitor_pins'
);

drop function if exists public.reorder_popular_visitor_pins(uuid, uuid[]);
drop function if exists public.merchant_set_dishes_availability_flag(text[], text, text, boolean);
drop function if exists public.apply_menu_draft_matches(jsonb);
drop function if exists public.get_venue_summaries(text[]);
drop function if exists public.get_item_details(text[], text[]);
