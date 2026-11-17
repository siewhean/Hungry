-- 20260522142004 moved these helper bodies into app_private; give those copies
-- the same extensions search_path so their `::citext` casts resolve.
alter function app_private.merchant_is_org_member(uuid) set search_path = public, extensions;
alter function app_private.merchant_can_manage_organization(uuid) set search_path = public, extensions;
