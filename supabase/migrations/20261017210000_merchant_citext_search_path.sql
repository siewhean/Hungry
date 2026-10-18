-- citext lives in the extensions schema, so these helpers' `::citext` casts fail
-- with "type citext does not exist" under search_path = public.
alter function public.merchant_is_org_member(uuid) set search_path = public, extensions;
alter function public.merchant_can_manage_organization(uuid) set search_path = public, extensions;
