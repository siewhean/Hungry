-- Sprint 5: Supabase extension baseline
-- Safe to run repeatedly.

create extension if not exists postgis;
create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists btree_gist;
create extension if not exists citext;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
