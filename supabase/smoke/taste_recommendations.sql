-- Taste recommendation smoke checks.
-- Run after applying migration 0027 to a linked or local Supabase DB.

with expected_tables(table_name) as (
  values
    ('taste_interaction_events'),
    ('quiz_responses'),
    ('dish_flavor_tags')
)
select table_name
from expected_tables
except
select tablename
from pg_tables
where schemaname = 'public';

select relname, relrowsecurity
from pg_class
where relname in (
  'taste_interaction_events',
  'quiz_responses',
  'dish_flavor_tags'
)
  and relrowsecurity is distinct from true;

with expected_columns(column_name) as (
  values
    ('confidence'),
    ('signal_count'),
    ('last_signal_at'),
    ('source')
)
select column_name
from expected_columns
except
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_taste_vectors';

with expected_indexes(index_name) as (
  values
    ('dish_taste_vectors_vector_hnsw_idx'),
    ('user_taste_vectors_vector_hnsw_idx'),
    ('taste_interaction_events_user_created_idx'),
    ('taste_interaction_events_dish_idx'),
    ('taste_interaction_events_low_value_cap_idx'),
    ('quiz_responses_user_created_idx'),
    ('dish_flavor_tags_dish_status_idx')
)
select index_name
from expected_indexes
except
select indexname
from pg_indexes
where schemaname = 'public';

with expected_policies(policyname) as (
  values
    ('taste_interaction_events_select_own'),
    ('taste_interaction_events_insert_own'),
    ('quiz_responses_select_own'),
    ('quiz_responses_insert_own'),
    ('dish_flavor_tags_select_applied')
)
select policyname
from expected_policies
except
select policyname
from pg_policies
where schemaname = 'public';

with expected_functions(proname) as (
  values
    ('get_taste_recommendations'),
    ('record_taste_interaction_event')
)
select proname
from expected_functions
except
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

select *
from public.get_taste_recommendations(
  'discover',
  array[5, 5, 5, 5, 5, 5]::double precision[],
  '{}'::text[],
  null,
  null,
  null,
  null,
  '{}'::text[],
  1
)
limit 1;
