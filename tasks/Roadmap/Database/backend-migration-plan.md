# Backend Migration Plan — Mock to Supabase

> **Sprint 5 Claude deliverables** — schema deployment, auth integration, API security, media pipeline, migration testing

---

## 1. Schema Deployment Plan

### 1.1 Supabase Project Setup

```
Region:     ap-southeast-1  (Singapore — co-located with user base)
Postgres:   15+
Extensions: pgvector, postgis, pg_trgm, btree_gist, citext, uuid-ossp
```

Enable extensions in SQL editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 1.2 Migration Script Order

Supabase migrations run in filename-sorted order under `supabase/migrations/`. The sequence must respect foreign key dependencies:

```
0001_core_schema.sql        -- users, buildings, venues, dishes
0002_taste_vectors.sql      -- user_taste_vectors, dish_taste_vectors (needs pgvector)
0003_reviews.sql            -- reviews, review_media (needs dishes, users)
0004_profiles.sql           -- user_profiles, dietary_flags, favourites
0005_social.sql             -- posts, comments, follows, bites
0006_discovery.sql          -- taste_interaction_events, recommendation_cache
0007_content.sql            -- blog_posts
0008_rls.sql                -- Row Level Security policies for all tables
0009_indexes.sql            -- HNSW indexes, PostGIS spatial indexes, trgm indexes
```

### 1.3 Core Schema (DDL Summary)

```sql
-- Buildings (maps to mockBuildings in data.ts)
CREATE TABLE buildings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,     -- e.g. 'maxwell-food-centre'
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('hawker_centre','food_court','mixed_development')),
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  location     GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_Point(lng, lat)::geography) STORED,
  floors       TEXT[] NOT NULL DEFAULT '{}',
  address      TEXT,
  is_closed_today BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_buildings_location ON buildings USING gist (location);

-- Venues / Stalls (maps to mockVenues)
CREATE TABLE venues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id      UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  floor            TEXT NOT NULL,
  unit_number      TEXT NOT NULL,
  cuisine_type     TEXT NOT NULL,
  price_range      TEXT NOT NULL CHECK (price_range IN ('$','$$','$$$')),
  is_open_now      BOOLEAN NOT NULL DEFAULT true,
  closure_notice   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_venues_building ON venues (building_id);

-- Dishes (maps to mockDishes / DishDetail)
CREATE TABLE dishes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id       UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  building_id    UUID NOT NULL REFERENCES buildings(id),
  name           TEXT NOT NULL,
  description    TEXT,
  price          NUMERIC(6,2) NOT NULL,
  price_range    TEXT NOT NULL CHECK (price_range IN ('$','$$','$$$')),
  image_url      TEXT,
  gallery        TEXT[] NOT NULL DEFAULT '{}',
  taste_tags     TEXT[] NOT NULL DEFAULT '{}',
  rating         NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count   INT NOT NULL DEFAULT 0,
  distance_meters INT,
  is_must_order  BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dishes_venue ON dishes (venue_id);
CREATE INDEX idx_dishes_name_trgm ON dishes USING gin (name gin_trgm_ops);

-- Dietary flags (many-to-many on dishes)
CREATE TABLE dish_dietary_flags (
  dish_id  UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  flag     TEXT NOT NULL CHECK (flag IN ('halal','vegetarian','vegan','gluten_free','dairy_free','nut_free','shellfish_free')),
  PRIMARY KEY (dish_id, flag)
);

-- Delivery links
CREATE TABLE dish_delivery_links (
  dish_id    UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  platform   TEXT NOT NULL CHECK (platform IN ('grabfood','foodpanda','deliveroo')),
  native_url TEXT NOT NULL,
  web_url    TEXT NOT NULL,
  PRIMARY KEY (dish_id, platform)
);
```

### 1.4 Seed Data Mapping

`mock/data.ts` fixtures → SQL insert scripts:

| Mock export | Target table(s) | Notes |
|-------------|----------------|-------|
| `mockBuildings` | `buildings` | Assign deterministic UUIDs matching slug |
| `mockVenues` | `venues` | Foreign key to `buildings.id` by slug lookup |
| `mockDishes` (in each venue) | `dishes`, `dish_dietary_flags`, `dish_delivery_links`, `dish_taste_vectors` | Split into 4 tables |
| `mockBlogPosts` | `blog_posts` | Flat table |
| `guestProfile`, `userProfile` | `users` (Supabase Auth) + `user_profiles` | Auth creates `users`; profile is in `user_profiles` |

Generate seed inserts with a Node script:
```
scripts/seed/generateSeedSQL.ts  → supabase/seed.sql
```

Run: `supabase db seed --db-url $SUPABASE_DB_URL`

---

## 2. Auth Integration Plan

### 2.1 Supabase Auth Configuration

| Method | Enable in Supabase | App screen |
|--------|--------------------|-----------|
| Email + password | Default | `LoginScreen`, `SignUpScreen` |
| Google OAuth | Enable, configure OAuth app in Google Cloud | `LoginScreen` → Google button |
| Apple Sign-In | Enable, configure Apple Developer account | `LoginScreen` → Apple button |

**Email confirmation:** Enable required email verification. The `EmailVerificationScreen` already handles the post-signup wait.

### 2.2 HungryService.auth Interface Mapping

```typescript
// Existing interface methods → Supabase equivalents

signUp(email, password)          → supabase.auth.signUp({ email, password })
login(email, password)           → supabase.auth.signInWithPassword({ email, password })
loginWithGoogle()                → supabase.auth.signInWithOAuth({ provider: 'google' })
loginWithApple()                 → supabase.auth.signInWithOAuth({ provider: 'apple' })
logout()                         → supabase.auth.signOut()
sendPasswordResetEmail(email)    → supabase.auth.resetPasswordForEmail(email)
resetPassword(token, password)   → supabase.auth.updateUser({ password })
getCurrentUser()                 → supabase.auth.getUser()
getSession()                     → supabase.auth.getSession()
```

### 2.3 Session Persistence

Supabase Auth manages its own session via `AsyncStorage` (or `SecureStore` if configured). The existing `useSessionStore` should delegate to `supabase.auth.onAuthStateChange` rather than managing its own JWT:

```typescript
// In app bootstrap (useAppBootstrap.ts)
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    useSessionStore.getState().setAuthenticated(true, session.user.id);
    posthog.identify(session.user.id, { ... });
  } else if (event === 'SIGNED_OUT') {
    useSessionStore.getState().setAuthenticated(false, null);
    posthog.reset();
  }
});
```

### 2.4 JWT → userId Extraction

All Supabase RLS policies use `auth.uid()`. Edge Functions extract userId from the JWT automatically via `supabase-js` when called with `Bearer` token:

```typescript
// In an Edge Function
const { data: { user }, error } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
const userId = user?.id;
```

---

## 3. API Security Plan

### 3.1 Row Level Security Policies

```sql
-- Enable RLS on every table
ALTER TABLE buildings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues            ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_taste_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE taste_interaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;

-- Public read on catalogue tables (anyone authenticated can read)
CREATE POLICY "public read buildings"    ON buildings    FOR SELECT USING (true);
CREATE POLICY "public read venues"       ON venues       FOR SELECT USING (true);
CREATE POLICY "public read dishes"       ON dishes       FOR SELECT USING (true);

-- Users can only read/write their own taste vectors
CREATE POLICY "own taste vector" ON user_taste_vectors
  FOR ALL USING (auth.uid() = user_id);

-- Users can only read/write their own interaction events
CREATE POLICY "own interaction events" ON taste_interaction_events
  FOR ALL USING (auth.uid() = user_id);

-- Users can only read/write their own recommendation cache
CREATE POLICY "own cache" ON recommendation_cache
  FOR ALL USING (auth.uid() = user_id);

-- Reviews: authenticated users can create; public can read
CREATE POLICY "public read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "own write reviews"   ON reviews FOR INSERT USING (auth.uid() = user_id);
CREATE POLICY "own update reviews"  ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own delete reviews"  ON reviews FOR DELETE USING (auth.uid() = user_id);
```

### 3.2 Rate Limiting

Supabase does not natively rate-limit Edge Functions. Add a middleware layer:

```typescript
// In Edge Function handler
const RATE_LIMIT_WINDOW = 60_000;  // 1 minute
const RATE_LIMIT_MAX    = 60;      // 60 requests/minute per user

async function checkRateLimit(userId: string): Promise<boolean> {
  // Use Redis (Upstash) for atomic rate limit counter
  const key = `rl:${userId}:${Math.floor(Date.now() / RATE_LIMIT_WINDOW)}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 120);
  return count <= RATE_LIMIT_MAX;
}
```

Rate limits by endpoint type:

| Endpoint group | Limit | Rationale |
|---------------|-------|-----------|
| `/recommendations/*` | 60 req/min | Prevents scraping dish catalog |
| `/profile/taste/update` | 30 req/min | Prevents vector spam |
| `/quiz/complete` | 5 req/day | Quiz should be completed once |
| Auth endpoints | Managed by Supabase (10 req/hour for email) | |

### 3.3 Input Validation

Edge Functions validate all inputs with Zod before processing:

```typescript
import { z } from 'zod';

const decideSchema = z.object({
  lat: z.number().min(1.1).max(1.5),   // Singapore lat bounds
  lng: z.number().min(103.6).max(104.1), // Singapore lng bounds
  radiusMeters: z.number().min(100).max(5000).optional().default(500),
  excludeIds: z.array(z.string().uuid()).max(50).optional().default([]),
});
```

### 3.4 Secrets That Never Leave the Server

| Secret | Location | Usage |
|--------|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | EAS Secrets / CI | Bypass RLS in admin migrations and seed scripts only |
| `SENTRY_AUTH_TOKEN` | EAS Secrets / CI | Source map upload only |
| `Mapbox secret token` | EAS Secrets | Native map SDK build only |

---

## 4. Media Pipeline Plan

### 4.1 Bucket Structure

```
supabase-storage/
  review-media/
    {userId}/
      {reviewId}/
        {filename}.jpg        -- review photos (public read, owner write)
  avatars/
    {userId}.jpg              -- profile avatars (public read, owner write)
  dish-images/
    {dishId}/
      hero.jpg                -- canonical dish hero (admin write only)
      {index}.jpg             -- gallery images
```

### 4.2 Upload Flow (Review Photos)

```
1. User selects photo → expo-image-picker → local URI
2. App calls: hungryService.media.getUploadUrl({ type: 'review', reviewId })
3. Edge Function generates:
     const { data } = await supabase.storage
       .from('review-media')
       .createSignedUploadUrl(`${userId}/${reviewId}/${filename}`);
     return { signedUrl, path }
4. App uploads directly to Supabase Storage via signed URL (no server intermediary):
     await fetch(signedUrl, { method: 'PUT', body: imageBlob })
5. App saves path in review record:
     await supabase.from('review_media').insert({ review_id, storage_path, media_type: 'photo' })
6. Display URL:
     supabase.storage.from('review-media').getPublicUrl(path)
```

### 4.3 Image Size Constraints

| Type | Max size | Notes |
|------|----------|-------|
| Review photo | 10 MB | Compress to 80% JPEG at max 1920×1920 before upload (`expo-image-manipulator`) |
| Avatar | 5 MB | Compress to 80% JPEG at max 512×512 |

### 4.4 CDN Caching

Supabase Storage serves files via a CDN with a default 1-hour cache. For dish images (rarely change), add a `Cache-Control` override on upload:
```
Cache-Control: public, max-age=86400, s-maxage=86400
```

---

## 5. Migration Testing Plan

### 5.1 Data Parity Tests

Before cutting over from mock to Supabase, run parity checks:

```typescript
// scripts/verify/dataParity.ts
// For each entity type, compare mock fixture count vs. Supabase row count

async function verifyParity() {
  const mockBuildings = mockData.buildings.length;
  const { count: liveBuildings } = await supabase.from('buildings').select('*', { count: 'exact', head: true });
  assert(liveBuildings === mockBuildings, `Buildings mismatch: mock=${mockBuildings}, live=${liveBuildings}`);

  // Repeat for venues, dishes, blog_posts ...
  // For dishes: also verify taste vector rows match dish rows
  const { count: dishes } = await supabase.from('dishes').select('*', { count: 'exact', head: true });
  const { count: vectors } = await supabase.from('dish_taste_vectors').select('*', { count: 'exact', head: true });
  assert(dishes === vectors, `Every dish must have a taste vector`);
}
```

### 5.2 Performance Baselines

Run against staging Supabase project before production cutover:

| Endpoint | Acceptable P95 | Test method |
|----------|---------------|-------------|
| `decideForMe` | <2s | `k6` load test, 50 concurrent users, 5 min |
| `recommendations/feed` | <1.5s | Same |
| `recommendations/search` | <1s | Same |
| `profile/taste/update` | <500ms | Same |

Fail the cutover if any P95 exceeds 150% of target.

### 5.3 Acceptance Test Suite

```
□ Auth round-trip: signUp → verifyEmail → login → getSession → logout
□ Cold start: new user with zero interactions gets 20 recommendations after quiz
□ Profile update: save dish → taste vector shifts toward dish vector
□ Search: query "laksa" returns at least 1 result with matching name
□ decideForMe: returns dish within 500m of test coordinates (1.280, 103.848)
□ Review submit: creates review record + increments dish.review_count
□ Mock fallback: HUNGRY_DATA_SOURCE=mock still returns data (no regression)
□ RLS: User A cannot read User B's taste_interaction_events
□ RLS: Unauthenticated request to recommendations returns 401
```

### 5.4 Rollout Strategy

```
Day 0 — Deploy supabaseService to staging
Day 1 — Internal team + 10 beta testers on staging EAS preview channel
Day 3 — If P95 latencies pass and zero critical bugs: promote to production channel
Day 7 — Monitor Sentry error rate (target: <0.1% error rate on dish_viewed events)
Day 14 — If stable, remove HUNGRY_DATA_SOURCE=mock from production env
```

### 5.5 Rollback Plan

The `serviceProvider.ts` injection point makes rollback a single env change:

```
HUNGRY_DATA_SOURCE=mock
```

Deploy a new EAS update (OTA) with this variable set. No app store re-submission needed. Rollback restores the mock service in <5 minutes via Expo Updates.
