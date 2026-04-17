-- Phase 7 smoke: verify pgvector cosine-similarity path + HNSW index usage.

create extension if not exists vector;

create temp table if not exists _taste_vector_smoke (
  id text primary key,
  embedding vector(6) not null
);

insert into _taste_vector_smoke (id, embedding)
values
  ('dish-a', '[7,4,3,6,8,5]'),
  ('dish-b', '[3,8,4,5,2,7]'),
  ('dish-c', '[6,5,4,6,7,5]')
on conflict (id) do update
set embedding = excluded.embedding;

create index if not exists _taste_vector_smoke_hnsw
  on _taste_vector_smoke using hnsw (embedding vector_cosine_ops);

select
  id,
  1 - (embedding <=> '[6,5,4,6,7,5]'::vector) as cosine_similarity
from _taste_vector_smoke
order by embedding <=> '[6,5,4,6,7,5]'::vector
limit 3;
