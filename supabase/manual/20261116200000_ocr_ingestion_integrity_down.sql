-- Roll back the function only after rolling back the ingest-menu-photo handler.
-- Drafts, original OCR evidence, and submission completion records are retained.
drop function if exists public.app_complete_menu_photo_ingestion(uuid, text, jsonb, text);
