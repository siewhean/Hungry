-- Optional top-up for supabase/seed.sql (applied by run.sh when SEED_EXTRA=1).
-- seed.sql predates the menu display-rights columns, so none of its dishes pass
-- public_select_dishes and clients see an empty dishes table. Production dishes
-- are display-approved; mark the seeded ones the same way.

update public.dishes
set menu_approved_for_display = true,
    menu_rights_status = 'operator_owned'
where not public.catalog_menu_is_displayable(menu_approved_for_display, menu_rights_status, menu_source_url);
