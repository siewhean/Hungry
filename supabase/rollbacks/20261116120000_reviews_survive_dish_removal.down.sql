-- Undo 20261116120000_reviews_survive_dish_removal: puts reviews.dish_id back to ON DELETE CASCADE,
-- so deleting a dish deletes its reviews again. No rows are touched, so nothing needs archiving.
-- Dish ids and archived_at values are unchanged; archived dishes stay archived.

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

  if v_action = 'c' then
    return;
  end if;

  if v_name is not null then
    execute format('alter table public.reviews drop constraint %I', v_name);
  else
    v_name := 'reviews_dish_id_fkey';
  end if;

  execute format(
    'alter table public.reviews add constraint %I foreign key (dish_id) references public.dishes (id) on delete cascade',
    v_name
  );
end;
$$;

comment on column public.reviews.dish_id is null;
