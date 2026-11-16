-- smoke: supabase/smoke/reviews_survive_dish_removal.sql
-- Build plan package 0.2. reviews.dish_id was ON DELETE CASCADE (0002_core_schema.sql), so one
-- catalog clean-up that deleted a dish also deleted every diner's review of it, silently.
-- The foreign key is now ON DELETE RESTRICT: the database refuses to delete a dish that has
-- reviews. A dish that must leave the catalog is archived instead (dishes.archived_at, the date
-- merchant dishes already use): it drops out of Home, Search and Map, while its reviews stay on the
-- diner's profile with the dish name (get_item_details has no archived filter).
-- Nothing is moved or deleted here; adding the key re-checks the existing reviews, which all point
-- at existing dishes because the old key guaranteed it.
-- Rollback: supabase/rollbacks/20261116120000_reviews_survive_dish_removal.down.sql.

do $$
declare
  v_name text;
  v_action "char";
begin
  select c.conname, c.confdeltype
    into v_name, v_action
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f'
    and c.conrelid = 'public.reviews'::regclass
    and c.confrelid = 'public.dishes'::regclass
    and array_length(c.conkey, 1) = 1
    and a.attname = 'dish_id';

  -- Already restricting: a re-run changes nothing.
  if v_action = 'r' then
    return;
  end if;

  if v_name is not null then
    execute format('alter table public.reviews drop constraint %I', v_name);
  else
    v_name := 'reviews_dish_id_fkey';
  end if;

  execute format(
    'alter table public.reviews add constraint %I foreign key (dish_id) references public.dishes (id) on delete restrict',
    v_name
  );
end;
$$;

comment on column public.reviews.dish_id is
  'The reviewed dish. ON DELETE RESTRICT: a dish with reviews cannot be deleted; archive it (dishes.archived_at) instead.';
