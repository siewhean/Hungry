# Supabase Service Layer

This directory contains the Sprint 5 Supabase scaffolding used by `serviceProvider.ts`.

## Files

- `client.ts`: guarded Supabase client + data source mode resolver.
- `supabaseRepository.ts`: `DataRepository` implementation (11 sync methods) with cache-backed live Supabase refresh and mock fallback.
- `supabaseService.ts`: `HungryService` implementation that composes `supabaseRepository` plus Supabase auth/reviews/profile/social/content operations.

## Runtime Behavior

- `HUNGRY_DATA_SOURCE=mock` -> provider uses mock service/repository.
- `HUNGRY_DATA_SOURCE=supabase` -> provider uses Supabase adapters.
- If Supabase env vars are missing or a query fails, adapters fall back to mock-safe behavior and do not throw into UI call sites.

## Required Env

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `HUNGRY_DATA_SOURCE=mock|supabase`

## Deferred TODO Anchors

- `TODO(supabase-media-signed-url)`: replace raw media URL persistence with signed upload URL flow for review photos and bites media.
- `TODO(supabase-rls-hardening)`: tighten write paths once final RLS and role claims are fully deployed.
