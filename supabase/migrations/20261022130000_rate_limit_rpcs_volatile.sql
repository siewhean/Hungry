-- smoke: supabase/smoke/api_request_rate_limit_volatility.sql
-- Rate-limited RPCs must be VOLATILE.
-- PostgREST runs POST on a STABLE or IMMUTABLE function in a READ ONLY transaction, where the
-- limiter in 20261022120000_api_request_rate_limits.sql cannot write its counter and so fails open.
-- Found on prod: 170 anonymous catalog_suggest calls in a minute all returned 200. These 27 read
-- RPCs were STABLE; the other limited RPCs already are VOLATILE. Only the volatility label changes:
-- the bodies, arguments, grants and results are the same, and a direct RPC call gains nothing or
-- loses nothing (a volatile function just cannot be inlined into an outer query, which no caller does).
-- Down: supabase/rollbacks/20261022130000_rate_limit_rpcs_volatile.down.sql.

alter function public.catalog_raw_places(text,double precision,double precision,integer,integer,uuid) volatile;
alter function public.catalog_suggest(text,integer) volatile;
alter function public.count_venues_in_area(double precision,double precision,integer) volatile;
alter function public.count_venues_in_planning_area(text) volatile;
alter function public.export_my_data() volatile;
alter function public.get_building_detail(text) volatile;
alter function public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text) volatile;
alter function public.get_dish_detail(text) volatile;
alter function public.get_follow_counts(uuid) volatile;
alter function public.get_home_social_feed(integer,timestamp with time zone,uuid) volatile;
alter function public.get_home_social_feed_v2(integer,timestamp with time zone,uuid) volatile;
alter function public.get_home_social_feed_v3(integer,timestamp with time zone,uuid) volatile;
alter function public.get_nearby_open_venues(double precision,double precision,integer,integer,integer,text) volatile;
alter function public.get_post_by_id(uuid) volatile;
alter function public.get_profile_card(uuid) volatile;
alter function public.get_public_home_feed(integer,timestamp with time zone,uuid) volatile;
alter function public.get_public_merchant_profile(text) volatile;
alter function public.get_public_portfolio(uuid) volatile;
alter function public.get_taste_recommendations(text,double precision[],text[],text,double precision,double precision,integer,text[],integer) volatile;
alter function public.get_user_profile_reviews(uuid) volatile;
alter function public.get_venue_detail(text) volatile;
alter function public.list_buildings(double precision,double precision,integer,integer,integer,text) volatile;
alter function public.list_customer_active_promotions(text,text) volatile;
alter function public.list_venues_by_building(text,boolean,integer,integer,text) volatile;
alter function public.search_dishes(text,double precision,double precision,integer,text[],integer,double precision,text,text,text,text[],numeric,boolean) volatile;
alter function public.search_profiles(text,integer,integer) volatile;
alter function public.search_venues_by_location(text,text,double precision,double precision,integer,integer) volatile;

-- PostgREST caches function volatility with the rest of its schema.
notify pgrst, 'reload schema';
