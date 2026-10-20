-- Merchant inbox reads reviews by venue, newest first, and the dashboard counts
-- unreplied reviews by venue. reviews had no index on venue_id, so both scanned
-- the whole table.

create index if not exists idx_reviews_venue_created
  on public.reviews (venue_id, created_at desc, id)
  where venue_id is not null;

create index if not exists idx_reviews_venue_unreplied
  on public.reviews (venue_id, created_at desc)
  where venue_id is not null and merchant_reply_text is null;
