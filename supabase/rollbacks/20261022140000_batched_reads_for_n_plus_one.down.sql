-- Down for 20261022140000_batched_reads_for_n_plus_one: these are all new, read-only or
-- set-based helper functions that own no data, so dropping them loses nothing. The app falls
-- back to its per-row calls where it can (getVenuesByIds); older builds never call them.
drop function if exists public.reorder_popular_visitor_pins(uuid, uuid[]);
drop function if exists public.merchant_set_dishes_availability_flag(text[], text, text, boolean);
drop function if exists public.apply_menu_draft_matches(jsonb);
drop function if exists public.get_venue_summaries(text[]);
drop function if exists public.get_item_details(text[], text[]);
