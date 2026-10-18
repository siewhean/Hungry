-- Public contact links from the SFA-based F&B directory workbook.
alter table public.venues
  add column if not exists website_url text,
  add column if not exists contact_phone text,
  add column if not exists menu_url text;
