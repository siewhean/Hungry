-- Tighten checklist/portfolio/passport direct table privileges after smoke verification.
-- Portfolio item writes must go through checked RPCs so version guards and passport
-- progress are applied. Passport progress events are service-role/RPC generated.

revoke insert on table public.portfolio_items from public, anon, authenticated;
revoke insert, update, delete on table public.passport_progress_events from public, anon, authenticated;

grant select, update, delete on table public.portfolio_items to authenticated;
grant select on table public.passport_progress_events to authenticated;

grant all on table public.portfolio_items to service_role;
grant all on table public.passport_progress_events to service_role;
