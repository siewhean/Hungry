-- Undo 20261111090000_portfolio_picks: drops the picks table, its writers, readers and triggers,
-- puts the board triggers and publish_post back as they were (no private entries).
-- expect-row-loss: app_private.request_rate_rules, public.portfolio_picks
-- down-loses-data: portfolio_picks only; the overall picks came from pinned_post_ids, which is untouched.

delete from app_private.request_rate_rules where route in (
  'rpc/set_portfolio_pick',
  'rpc/remove_portfolio_pick',
  'rpc/set_post_visibility',
  'rpc/get_portfolio_picks',
  'rpc/get_portfolio_diary',
  'rpc/get_review_portfolio_labels'
);

create or replace function pg_temp.patch_function(p_oid regprocedure, p_find text, p_replace text)
returns void
language plpgsql
as $patch$
declare
  v_src text := (select prosrc from pg_proc where oid = p_oid);
  v_count integer := (length(v_src) - length(replace(v_src, p_find, ''))) / length(p_find);
begin
  if v_count = 0 and position(p_replace in v_src) > 0 then
    return;
  end if;
  if v_count <> 1 then
    raise exception 'patch_function: % has % copies of the expected text', p_oid, v_count;
  end if;
  execute replace(pg_get_functiondef(p_oid), p_find, p_replace);
end;
$patch$;

drop trigger if exists trg_posts_credit_board_points on public.posts;
create trigger trg_posts_credit_board_points
after insert or update of status on public.posts
for each row execute function app_private.credit_post_board_points();

drop trigger if exists trg_posts_void_board_points on public.posts;
create trigger trg_posts_void_board_points
after update of status, deleted_at on public.posts
for each row execute function app_private.void_post_board_points();

select pg_temp.patch_function(
  'app_private.void_post_board_points()',
  $f$    if new.visibility = 'private' and old.visibility <> 'private'
       and new.status <> 'deleted' and new.deleted_at is null then
      v_post_id := new.id;
      v_reason := 'post_private';
    else
      if not (new.status = 'deleted' or new.deleted_at is not null) then
        return null;
      end if;
      if old.status = 'deleted' or old.deleted_at is not null then
        return null;
      end if;
      v_post_id := new.id;
      v_reason := 'post_deleted';
    end if;$f$,
  $f$    if not (new.status = 'deleted' or new.deleted_at is not null) then
      return null;
    end if;
    if old.status = 'deleted' or old.deleted_at is not null then
      return null;
    end if;
    v_post_id := new.id;
    v_reason := 'post_deleted';$f$
);

select pg_temp.patch_function(
  'app_private.credit_post_board_points()',
  $f$  if new.status <> 'published' or new.deleted_at is not null or new.visibility = 'private' then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' and old.visibility <> 'private' then
    return null;
  end if;$f$,
  $f$  if new.status <> 'published' or new.deleted_at is not null then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' then
    return null;
  end if;$f$
);

select pg_temp.patch_function(
  'app_private.publish_post_core(jsonb, jsonb, uuid)',
  $f$      v_id, v_user, 'text', 'draft',
      case when p_post ->> 'visibility' = 'private' then 'private' else 'public' end,
      v_caption, v_content,$f$,
  $f$      v_id, v_user, 'text', 'draft', 'public', v_caption, v_content,$f$
);

drop function if exists public.set_portfolio_pick(uuid, text, integer);
drop function if exists public.remove_portfolio_pick(uuid, text);
drop function if exists public.set_post_visibility(uuid, text);
drop function if exists public.get_portfolio_picks(uuid);
drop function if exists public.get_portfolio_diary(uuid, integer, timestamptz, uuid);
drop function if exists public.get_review_portfolio_labels(uuid[]);
drop function if exists app_private.set_portfolio_pick(uuid, text, integer);
drop function if exists app_private.remove_portfolio_pick(uuid, text);
drop function if exists app_private.set_post_visibility(uuid, text);
drop function if exists app_private.get_portfolio_picks(uuid);
drop function if exists app_private.get_portfolio_diary(uuid, integer, timestamptz, uuid);
drop function if exists app_private.get_review_portfolio_labels(uuid[]);
drop function if exists app_private.portfolio_post_cards(uuid[]);

drop trigger if exists trg_post_moderation_drop_portfolio_picks on public.post_moderation_states;
drop trigger if exists trg_posts_drop_portfolio_picks on public.posts;
drop function if exists app_private.drop_portfolio_picks_for_moderation();
drop function if exists app_private.drop_portfolio_picks_for_post();

drop table if exists public.portfolio_picks;

notify pgrst, 'reload schema';
