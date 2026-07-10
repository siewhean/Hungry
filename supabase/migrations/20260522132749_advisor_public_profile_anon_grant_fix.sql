-- Correct the prior Advisor warning hardening so the anon-safe
-- public_profiles RLS policy can still call its visibility helper.
--
-- public.can_read_author_content is used by public.public_profiles for anon
-- and authenticated reads. It only returns safe visibility decisions and does
-- not expose raw user_profiles columns directly.

grant execute on function public.can_read_author_content(uuid) to anon;
