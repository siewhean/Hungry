-- Roll back the function only after rolling back its Edge Function caller.
-- Retain review_notes as evidence: dropping it would destroy operator notes.
drop function if exists public.app_review_dish_draft(uuid, uuid, text, text, text, text);
drop index if exists public.dishes_draft_review_cursor_idx;
