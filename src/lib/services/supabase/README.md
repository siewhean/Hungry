# Supabase Service Layer

This directory contains the Sprint 5 Supabase scaffolding used by `serviceProvider.ts`.

## Files

- `client.ts`: guarded Supabase client + data source mode resolver.
- `supabaseRepository.ts`: `DataRepository` implementation (11 sync methods) with cache-backed live Supabase refresh.
- `supabaseService.ts`: `HungryService` implementation that composes `supabaseRepository` plus Supabase auth/reviews/profile/social/content operations.

## Runtime Behavior

- Consumer builds always use Supabase adapters.
- `mock` and `excel` modes are explicit developer/test overrides only; released builds ignore them.
- If Supabase env vars are missing, bootstrap completes signed out rather than substituting fixture data.

## Required Env

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_HUNGRY_DATA_SOURCE=supabase`

## Deferred TODO Anchors

- `TODO(supabase-media-signed-url)`: replace raw media URL persistence with signed upload URL flow for review photos and bites media.
- `TODO(supabase-rls-hardening)`: tighten write paths once final RLS and role claims are fully deployed.
