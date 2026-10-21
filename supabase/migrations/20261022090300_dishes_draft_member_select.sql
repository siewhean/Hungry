-- merchant-M3: managers of a venue can read the photo (OCR) drafts for their own venue.
-- Until now dishes_draft was service_role-only, so the Photo drafts screen always came back
-- empty. Writes (accept / reject) stay with ops and the service role.

alter table public.dishes_draft enable row level security;

drop policy if exists dishes_draft_member_select on public.dishes_draft;
create policy dishes_draft_member_select
on public.dishes_draft for select
to authenticated
using (public.merchant_can_manage_venue(venue_id));

grant select on public.dishes_draft to authenticated;
