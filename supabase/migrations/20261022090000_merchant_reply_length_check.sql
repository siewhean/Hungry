-- merchant-L14: a business reply is capped at 1000 characters in the app; hold the same cap in
-- the database so a direct write cannot store an oversized reply.
-- NOT VALID: new and changed rows are checked, existing rows are not scanned.

alter table public.reviews
  drop constraint if exists reviews_merchant_reply_text_length_check;

alter table public.reviews
  add constraint reviews_merchant_reply_text_length_check
  check (merchant_reply_text is null or char_length(merchant_reply_text) <= 1000)
  not valid;
