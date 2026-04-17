-- Phase 7: normalize article source metadata for blog posts.

create table if not exists blog_sources (
  id text primary key,
  name text not null,
  logo text not null default '',
  homepage_url text,
  created_at timestamptz not null default now()
);

alter table blog_posts
  add column if not exists source_id text references blog_sources(id) on delete set null;

alter table blog_sources enable row level security;

drop policy if exists "public_select_blog_sources" on blog_sources;
create policy "public_select_blog_sources" on blog_sources for select using (true);

insert into blog_sources (id, name, logo, homepage_url)
values
  ('eatbook', 'Eatbook', 'EB', 'https://eatbook.sg'),
  ('sethlui', 'SethLui.com', 'SL', 'https://sethlui.com'),
  ('hungry_guide', 'Hungry Guide', 'H', 'https://hungry.sg'),
  ('foodie_sg', 'Foodie SG', 'F', 'https://hungry.sg')
on conflict (id) do update
set
  name = excluded.name,
  logo = excluded.logo,
  homepage_url = excluded.homepage_url;

update blog_posts
set source_id = case
  when lower(source_name) like '%eatbook%' then 'eatbook'
  when lower(source_name) like '%seth%' then 'sethlui'
  when lower(source_name) like '%foodie%' then 'foodie_sg'
  else 'hungry_guide'
end
where source_id is null;
