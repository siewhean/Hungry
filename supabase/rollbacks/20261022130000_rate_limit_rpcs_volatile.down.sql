-- Down for 20261022130000_rate_limit_rpcs_volatile.sql.
-- Puts the 27 read RPCs back to STABLE, which they were. Their rate limits then stop counting
-- again until they are VOLATILE (PostgREST runs POST on a STABLE function read-only).

alter function public.catalog_raw_places(text,double precision,double precision,integer,integer,uuid) stable;
alter function public.catalog_suggest(text,integer) stable;
alter function public.count_venues_in_area(double precision,double precision,integer) stable;
alter function public.count_venues_in_planning_area(text) stable;
alter function public.export_my_data() stable;
alter function public.get_building_detail(text) stable;
alter function public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text) stable;
alter function public.get_dish_detail(text) stable;
alter function public.get_follow_counts(uuid) stable;
alter function public.get_home_social_feed(integer,timestamp with time zone,uuid) stable;
alter function public.get_home_social_feed_v2(integer,timestamp with time zone,uuid) stable;
alter function public.get_home_social_feed_v3(integer,timestamp with time zone,uuid) stable;
alter function public.get_nearby_open_venues(double precision,double precision,integer,integer,integer,text) stable;
alter function public.get_post_by_id(uuid) stable;
alter function public.get_profile_card(uuid) stable;
alter function public.get_public_home_feed(integer,timestamp with time zone,uuid) stable;
alter function public.get_public_merchant_profile(text) stable;
alter function public.get_public_portfolio(uuid) stable;
alter function public.get_taste_recommendations(text,double precision[],text[],text,double precision,double precision,integer,text[],integer) stable;
alter function public.get_user_profile_reviews(uuid) stable;
alter function public.get_venue_detail(text) stable;
alter function public.list_buildings(double precision,double precision,integer,integer,integer,text) stable;
alter function public.list_customer_active_promotions(text,text) stable;
alter function public.list_venues_by_building(text,boolean,integer,integer,text) stable;
alter function public.search_dishes(text,double precision,double precision,integer,text[],integer,double precision,text,text,text,text[],numeric,boolean) stable;
alter function public.search_profiles(text,integer,integer) stable;
alter function public.search_venues_by_location(text,text,double precision,double precision,integer,integer) stable;

notify pgrst, 'reload schema';
