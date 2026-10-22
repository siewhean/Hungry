-- Restore the private_notes column guard on portfolio_items.
--
-- 20261019111000 replaced the table-wide SELECT grant with a column list that
-- leaves out private_notes. 20261020040000 (meant only to revoke UPDATE/DELETE)
-- then ran "grant select on table public.portfolio_items to authenticated",
-- which covers every column again, so any viewer of a public or followed list
-- could read notes labelled "Only for you and collaborators".
--
-- Owners and collaborators still read notes through
-- public.get_portfolio_private_notes. Writes go through the checked RPCs.

revoke select on table public.portfolio_items from public, anon, authenticated;
grant select (
  id,
  portfolio_id,
  item_type,
  dish_id,
  stall_id,
  score,
  public_notes,
  position,
  created_at,
  updated_at
) on table public.portfolio_items to authenticated;
