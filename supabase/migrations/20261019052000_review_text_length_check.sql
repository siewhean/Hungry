-- Enforce the review text length on the server.
--
-- The app caps review text at 500 characters (REVIEW_TEXT_MAX_LENGTH) and now
-- sanitizes it once at submit instead of on every keystroke. The cap was
-- client-only, so any direct insert/update could store unbounded text.
--
-- NOT VALID keeps existing rows untouched while every new insert or update is
-- checked.

alter table public.reviews
  drop constraint if exists reviews_text_length_check;

alter table public.reviews
  add constraint reviews_text_length_check
  check (char_length(text) <= 500) not valid;
