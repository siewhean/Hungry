# backend-architecture.md — V2 Backend Design Reference

> Living document. Read before any backend, API, or database work.
> Companion to `data-contracts.md` (V1 TypeScript domain types) and `environment.md`.

---

## Table of Contents

1. [Stack Decision](#1-stack-decision)
2. [Database Schema](#2-database-schema)
3. [Indexing Strategy](#3-indexing-strategy)
4. [Data Integrity Rules](#4-data-integrity-rules)
5. [API Design](#5-api-design)
6. [Authentication & Session Model](#6-authentication--session-model)
7. [Real-Time & Messaging](#7-real-time--messaging)
8. [Commerce Flow](#8-commerce-flow)
9. [Media & CDN](#9-media--cdn)
10. [Migrations & Seeding](#10-migrations--seeding)
11. [V1 → V2 Domain Mapping](#11-v1--v2-domain-mapping)

---

## 1. Stack Decision

| Layer | Choice | Reason |
|---|---|---|
| Primary database | **PostgreSQL 16 + PostGIS + pgvector** | ACID on orders/payments, geospatial discovery, FTS on menus, taste-vector similarity — one store |
| Cache / presence | **Redis** | Chat fan-out, hot menu cache, online presence, session tokens |
| Media storage | **Vercel Blob / Cloudflare R2** | Schema stores CDN URLs only — no raw file bytes in Postgres |
| Runtime | **Node.js 24 on Vercel Fluid Compute** | Zero-config deploy, concurrent request reuse, 300s timeout default |
| API layer | **tRPC** or **REST** over Next.js API routes | Type-safe client/server contract; swap if a mobile-native API is needed |
| Auth | **Clerk** or **Supabase Auth** | Handles OAuth, OTP, magic link; vendor profile upgrade flow needs custom hook |

**When to reconsider:** peel chat off to a dedicated store (e.g. Upstash Kafka + Redis) when messaging exceeds ~5k msgs/s. Peel geo-search into a dedicated search service when venue count exceeds ~50k.

---

## 2. Database Schema

### 2.1 Enums

```sql
CREATE TYPE building_type     AS ENUM ('hawker_centre','food_court','restaurant','kopitiam','mall_fnb');
CREATE TYPE hygiene_grade     AS ENUM ('A','B','C','D');
CREATE TYPE delivery_platform AS ENUM ('grabfood','foodpanda');
CREATE TYPE user_role         AS ENUM ('diner','vendor_owner','vendor_staff','moderator','admin');
CREATE TYPE order_status      AS ENUM ('draft','placed','accepted','preparing','ready','collected','cancelled','refunded');
CREATE TYPE payment_status    AS ENUM ('pending','authorized','captured','failed','refunded','voided');
CREATE TYPE media_kind        AS ENUM ('image','video');
CREATE TYPE message_kind      AS ENUM ('text','image','system','order_ref');
```

### 2.2 Domain Hierarchy

```
users  ──────────────────── user_roles
  │                          user_taste_vectors
  │                          user_dietary_preferences
  │                          user_favourite_dishes / _venues
  │
  ├── vendor_profiles
  │     └── venues (owner_user_id)
  │
  └── guest_sessions (ephemeral; upgraded_to_user_id on sign-up)

buildings
  └── building_floors
        └── venues
              ├── venue_operating_hours
              ├── venue_closures       (range-exclusion constraint)
              ├── venue_category_map
              ├── venue_delivery_links
              └── dishes
                    ├── dish_taste_vectors
                    ├── dish_images
                    ├── dish_dietary_flags
                    ├── dish_modifier_groups → modifier_groups → modifier_options
                    └── reviews → review_photos, review_tags

posts
  ├── post_media
  ├── post_likes
  ├── post_comments (threaded)
  ├── post_dish_refs
  └── post_saves

chat_threads
  ├── chat_participants
  └── chat_messages (partitioned by month)
        └── chat_message_receipts

qr_sessions → orders → order_items → order_item_modifiers
                    → order_status_history
                    → payments → refunds
```

### 2.3 Full DDL

```sql
-- =========================================================================
-- EXTENSIONS
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =========================================================================
-- 1. IDENTITY & ACCESS
-- =========================================================================
CREATE TABLE users (
  id                UUID PRIMARY KEY,                     -- UUIDv7, app-generated
  email             CITEXT UNIQUE,
  phone             TEXT UNIQUE,
  username          CITEXT UNIQUE,
  display_name      TEXT NOT NULL,
  avatar_url        TEXT,
  password_hash     TEXT,
  is_guest          BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT users_guest_or_identity CHECK (
    is_guest = TRUE OR (email IS NOT NULL OR phone IS NOT NULL)
  )
);
CREATE INDEX idx_users_active     ON users (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email_trgm ON users USING gin (email gin_trgm_ops);

CREATE TABLE user_roles (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

-- Short-lived tokens for frictionless QR-scan ordering (no login required)
CREATE TABLE guest_sessions (
  id                  UUID PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qr_session_id       UUID,
  device_fingerprint  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  upgraded_to_user_id UUID REFERENCES users(id)
);
CREATE INDEX idx_guest_sessions_expiry ON guest_sessions (expires_at);

CREATE TABLE vendor_profiles (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name   TEXT NOT NULL,
  business_reg_no TEXT,
  tax_id          TEXT,
  payout_method   JSONB,
  kyc_status      TEXT NOT NULL DEFAULT 'pending',
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6-dim taste vector — same space as V1 TasteVector
CREATE TABLE user_taste_vectors (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vector     vector(6) NOT NULL,                          -- [sweet,spicy,sour,salty,rich,aromatic]
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_taste_hnsw ON user_taste_vectors USING hnsw (vector vector_cosine_ops);

-- =========================================================================
-- 2. BUILDINGS → VENUES → DISHES
-- =========================================================================
CREATE TABLE buildings (
  id              UUID PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  building_type   building_type NOT NULL,
  address         TEXT,
  postal_code     TEXT,
  location        GEOGRAPHY(POINT, 4326) NOT NULL,
  hero_dish_id    UUID,                                   -- FK added after dishes
  is_closed_today BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_buildings_location  ON buildings USING gist (location);
CREATE INDEX idx_buildings_type      ON buildings (building_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_buildings_name_trgm ON buildings USING gin (name gin_trgm_ops);

CREATE TABLE building_floors (
  id            UUID PRIMARY KEY,
  building_id   UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (building_id, label)
);

CREATE TABLE venues (
  id             UUID PRIMARY KEY,
  building_id    UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  floor_id       UUID REFERENCES building_floors(id) ON DELETE SET NULL,
  owner_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  unit_number    TEXT,
  description    TEXT,
  phone          TEXT,
  logo_url       TEXT,
  cover_url      TEXT,
  hygiene_grade  hygiene_grade,
  is_open        BOOLEAN NOT NULL DEFAULT TRUE,
  closure_notice TEXT,
  location       GEOGRAPHY(POINT, 4326),
  top_dish_id    UUID,                                    -- FK added after dishes
  search_tsv     TSVECTOR,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  UNIQUE (building_id, slug)
);
CREATE INDEX idx_venues_building   ON venues (building_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_owner      ON venues (owner_user_id);
CREATE INDEX idx_venues_open       ON venues (building_id, is_open) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_location   ON venues USING gist (location);
CREATE INDEX idx_venues_search_fts ON venues USING gin (search_tsv);

CREATE TABLE venue_operating_hours (
  id          BIGSERIAL PRIMARY KEY,
  venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at    TIME NOT NULL,
  closes_at   TIME NOT NULL,
  UNIQUE (venue_id, day_of_week, opens_at)
);
CREATE INDEX idx_venue_hours_venue ON venue_operating_hours (venue_id);

-- Range exclusion constraint prevents overlapping closures for the same venue
CREATE TABLE venue_closures (
  id          BIGSERIAL PRIMARY KEY,
  venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  closed_from TIMESTAMPTZ NOT NULL,
  closed_to   TIMESTAMPTZ NOT NULL,
  reason      TEXT,
  CHECK (closed_to > closed_from),
  EXCLUDE USING gist (venue_id WITH =, tstzrange(closed_from, closed_to) WITH &&)
);

CREATE TABLE venue_categories (
  id    SMALLSERIAL PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon  TEXT
);

CREATE TABLE venue_category_map (
  venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  category_id SMALLINT NOT NULL REFERENCES venue_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (venue_id, category_id)
);
CREATE INDEX idx_vcm_category ON venue_category_map (category_id, venue_id);

CREATE TABLE venue_delivery_links (
  id                 BIGSERIAL PRIMARY KEY,
  venue_id           UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  platform           delivery_platform NOT NULL,
  native_url         TEXT NOT NULL,
  web_url            TEXT NOT NULL,
  affiliate_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (venue_id, platform)
);

CREATE TABLE dishes (
  id                 UUID PRIMARY KEY,
  venue_id           UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  category_id        SMALLINT REFERENCES venue_categories(id),
  name               TEXT NOT NULL,
  description        TEXT,
  base_price_cents   BIGINT NOT NULL CHECK (base_price_cents >= 0),
  price_range_label  TEXT,
  primary_image_url  TEXT,
  blurhash           TEXT,
  must_order         BOOLEAN NOT NULL DEFAULT FALSE,
  is_available       BOOLEAN NOT NULL DEFAULT TRUE,
  rating_avg         NUMERIC(3,2) NOT NULL DEFAULT 0,     -- denormalized; updated by trigger
  rating_count       INT NOT NULL DEFAULT 0,
  availability_flags TEXT[] NOT NULL DEFAULT '{}',
  search_tsv         TSVECTOR,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX idx_dishes_venue_available ON dishes (venue_id, is_available) WHERE deleted_at IS NULL;
CREATE INDEX idx_dishes_rating          ON dishes (rating_avg DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_dishes_must_order      ON dishes (venue_id) WHERE must_order = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_dishes_search_fts      ON dishes USING gin (search_tsv);

ALTER TABLE buildings ADD CONSTRAINT fk_buildings_hero_dish
  FOREIGN KEY (hero_dish_id) REFERENCES dishes(id) ON DELETE SET NULL;
ALTER TABLE venues ADD CONSTRAINT fk_venues_top_dish
  FOREIGN KEY (top_dish_id) REFERENCES dishes(id) ON DELETE SET NULL;

CREATE TABLE dish_taste_vectors (
  dish_id    UUID PRIMARY KEY REFERENCES dishes(id) ON DELETE CASCADE,
  vector     vector(6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dish_taste_hnsw ON dish_taste_vectors USING hnsw (vector vector_cosine_ops);

CREATE TABLE dish_images (
  id            BIGSERIAL PRIMARY KEY,
  dish_id       UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  cdn_url       TEXT NOT NULL,
  blurhash      TEXT,
  display_order SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_dish_images_dish ON dish_images (dish_id, display_order);

CREATE TABLE dietary_flags (
  id    SMALLSERIAL PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

CREATE TABLE dish_dietary_flags (
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  flag_id SMALLINT NOT NULL REFERENCES dietary_flags(id) ON DELETE CASCADE,
  PRIMARY KEY (dish_id, flag_id)
);

CREATE TABLE user_dietary_preferences (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flag_id SMALLINT NOT NULL REFERENCES dietary_flags(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, flag_id)
);

-- Modifier groups are defined at the venue level, reused across dishes
CREATE TABLE modifier_groups (
  id          UUID PRIMARY KEY,
  venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  min_select  SMALLINT NOT NULL DEFAULT 0,
  max_select  SMALLINT NOT NULL DEFAULT 1,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (min_select <= max_select)
);
CREATE INDEX idx_mod_groups_venue ON modifier_groups (venue_id);

CREATE TABLE modifier_options (
  id                UUID PRIMARY KEY,
  group_id          UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  price_delta_cents BIGINT NOT NULL DEFAULT 0,
  display_order     SMALLINT NOT NULL DEFAULT 0,
  is_available      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_mod_options_group ON modifier_options (group_id, display_order);

CREATE TABLE dish_modifier_groups (
  dish_id       UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  group_id      UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  display_order SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (dish_id, group_id)
);

-- =========================================================================
-- 3. REVIEWS
-- =========================================================================
CREATE TABLE reviews (
  id              UUID PRIMARY KEY,
  dish_id         UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  author_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body            TEXT,
  would_recommend BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (dish_id, author_user_id)
);
CREATE INDEX idx_reviews_dish   ON reviews (dish_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_author ON reviews (author_user_id, created_at DESC);

CREATE TABLE review_photos (
  id            BIGSERIAL PRIMARY KEY,
  review_id     UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  cdn_url       TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE review_tags (
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (review_id, tag)
);

-- =========================================================================
-- 4. SOCIAL FEED
-- =========================================================================
CREATE TABLE posts (
  id             UUID NOT NULL,                            -- UUIDv7
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id       UUID REFERENCES venues(id) ON DELETE SET NULL,
  building_id    UUID REFERENCES buildings(id) ON DELETE SET NULL,
  caption        TEXT,
  location       GEOGRAPHY(POINT, 4326),
  like_count     INT NOT NULL DEFAULT 0,
  comment_count  INT NOT NULL DEFAULT 0,
  visibility     TEXT NOT NULL DEFAULT 'public',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
-- Create monthly partitions: posts_2026_04, posts_2026_05, ...
CREATE INDEX idx_posts_feed     ON posts (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_author   ON posts (author_user_id, created_at DESC);
CREATE INDEX idx_posts_venue    ON posts (venue_id, created_at DESC);
CREATE INDEX idx_posts_location ON posts USING gist (location);

CREATE TABLE post_media (
  id            BIGSERIAL PRIMARY KEY,
  post_id       UUID NOT NULL,
  media_kind    media_kind NOT NULL,
  cdn_url       TEXT NOT NULL,
  thumbnail_url TEXT,
  width         INT,
  height        INT,
  duration_ms   INT,
  display_order SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_post_media_post ON post_media (post_id, display_order);

CREATE TABLE post_dish_refs (
  post_id UUID NOT NULL,
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, dish_id)
);

CREATE TABLE post_likes (
  post_id    UUID NOT NULL,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_post_likes_user ON post_likes (user_id, created_at DESC);

CREATE TABLE post_comments (
  id                UUID PRIMARY KEY,
  post_id           UUID NOT NULL,
  author_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  body              TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_post_comments_post ON post_comments (post_id, created_at);

CREATE TABLE post_saves (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX idx_follows_reverse ON follows (followee_id, follower_id);

CREATE TABLE user_favourite_dishes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dish_id    UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dish_id)
);

CREATE TABLE user_favourite_venues (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id   UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, venue_id)
);

-- =========================================================================
-- 5. MESSAGING
-- =========================================================================
CREATE TABLE chat_threads (
  id              UUID PRIMARY KEY,
  venue_id        UUID REFERENCES venues(id) ON DELETE SET NULL,
  subject         TEXT,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_threads_venue_last ON chat_threads (venue_id, last_message_at DESC);

CREATE TABLE chat_participants (
  thread_id    UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  muted        BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX idx_participants_user ON chat_participants (user_id);

CREATE TABLE chat_messages (
  id             UUID NOT NULL,                            -- UUIDv7
  thread_id      UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  kind           message_kind NOT NULL DEFAULT 'text',
  body           TEXT,
  attachment_url TEXT,
  order_ref_id   UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_msgs_thread_time ON chat_messages (thread_id, created_at DESC);

CREATE TABLE chat_message_receipts (
  message_id   UUID NOT NULL,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ,
  read_at      TIMESTAMPTZ,
  PRIMARY KEY (message_id, user_id)
);

-- =========================================================================
-- 6. COMMERCE
-- =========================================================================
CREATE TABLE qr_sessions (
  id          UUID PRIMARY KEY,
  venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  table_label TEXT,
  token       TEXT NOT NULL UNIQUE,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_qr_sessions_venue ON qr_sessions (venue_id, expires_at);

CREATE TABLE orders (
  id                UUID NOT NULL,                         -- UUIDv7
  order_number      TEXT NOT NULL UNIQUE,                  -- "H-2026-000123"
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  venue_id          UUID NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  qr_session_id     UUID REFERENCES qr_sessions(id) ON DELETE SET NULL,
  status            order_status NOT NULL DEFAULT 'draft',
  subtotal_cents    BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  tax_cents         BIGINT NOT NULL DEFAULT 0,
  service_fee_cents BIGINT NOT NULL DEFAULT 0,
  total_cents       BIGINT NOT NULL DEFAULT 0,
  currency          CHAR(3) NOT NULL DEFAULT 'SGD',
  notes             TEXT,
  placed_at         TIMESTAMPTZ,
  accepted_at       TIMESTAMPTZ,
  ready_at          TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_orders_user_time    ON orders (user_id, created_at DESC);
CREATE INDEX idx_orders_venue_status ON orders (venue_id, status, created_at DESC);
CREATE INDEX idx_orders_active       ON orders (venue_id, status)
  WHERE status IN ('placed','accepted','preparing','ready');

CREATE TABLE order_items (
  id                 UUID PRIMARY KEY,
  order_id           UUID NOT NULL,
  dish_id            UUID NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
  dish_name_snapshot TEXT NOT NULL,                        -- immutable; price can change
  unit_price_cents   BIGINT NOT NULL,
  quantity           SMALLINT NOT NULL CHECK (quantity > 0),
  subtotal_cents     BIGINT NOT NULL,
  notes              TEXT
);
CREATE INDEX idx_order_items_order ON order_items (order_id);

CREATE TABLE order_item_modifiers (
  id                 BIGSERIAL PRIMARY KEY,
  order_item_id      UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_option_id UUID REFERENCES modifier_options(id) ON DELETE SET NULL,
  name_snapshot      TEXT NOT NULL,                        -- immutable snapshot
  price_delta_cents  BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_oim_item ON order_item_modifiers (order_item_id);

CREATE TABLE order_status_history (
  id          BIGSERIAL PRIMARY KEY,
  order_id    UUID NOT NULL,
  from_status order_status,
  to_status   order_status NOT NULL,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason      TEXT
);
CREATE INDEX idx_osh_order ON order_status_history (order_id, changed_at);

CREATE TABLE payments (
  id              UUID PRIMARY KEY,
  order_id        UUID NOT NULL,
  provider        TEXT NOT NULL,
  provider_txn_id TEXT NOT NULL,
  status          payment_status NOT NULL DEFAULT 'pending',
  amount_cents    BIGINT NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'SGD',
  idempotency_key TEXT UNIQUE,
  raw_response    JSONB,
  authorized_at   TIMESTAMPTZ,
  captured_at     TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_txn_id)
);
CREATE INDEX idx_payments_order ON payments (order_id);

CREATE TABLE refunds (
  id              UUID PRIMARY KEY,
  payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  amount_cents    BIGINT NOT NULL CHECK (amount_cents > 0),
  reason          TEXT,
  provider_txn_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 7. CONTENT (external blog references)
-- =========================================================================
CREATE TABLE blog_sources (
  id   SMALLSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo TEXT
);

CREATE TABLE blog_posts (
  id               UUID PRIMARY KEY,
  source_id        SMALLINT NOT NULL REFERENCES blog_sources(id) ON DELETE RESTRICT,
  title            TEXT NOT NULL,
  excerpt          TEXT,
  area             TEXT,
  image_url        TEXT,
  external_url     TEXT NOT NULL,
  related_venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blog_posts_venue ON blog_posts (related_venue_id);
CREATE INDEX idx_blog_posts_area  ON blog_posts (area, published_at DESC);
```

---

## 3. Indexing Strategy

| Query | Table | Index type |
|---|---|---|
| "Find stalls near me" | `buildings`, `venues` | **GIST** on `location` (PostGIS geography) |
| "Is this venue open?" | `venues` | partial btree `(building_id, is_open) WHERE deleted_at IS NULL` |
| "Menu for a stall (available dishes)" | `dishes` | partial btree `(venue_id, is_available) WHERE deleted_at IS NULL` |
| "Must-order badges" | `dishes` | partial `(venue_id) WHERE must_order = TRUE` |
| "Social feed (recency)" | `posts` | btree `(created_at DESC)` per partition |
| "Stall-specific feed" | `posts` | btree `(venue_id, created_at DESC)` |
| "My order history" | `orders` | btree `(user_id, created_at DESC)` |
| "Kitchen queue" | `orders` | partial `(venue_id, status) WHERE status IN (...)` |
| "Chat scrollback" | `chat_messages` | btree `(thread_id, created_at DESC)` per partition |
| "Taste recommendations" | `dish_taste_vectors` | **HNSW** cosine via pgvector |
| "Full-text search" | `dishes`, `venues` | **GIN** on `search_tsv`; trigram fallback via `pg_trgm` |
| "Who follows me" | `follows` | reverse btree `(followee_id, follower_id)` |
| "Past reviews of a dish" | `reviews` | btree `(dish_id, created_at DESC) WHERE deleted_at IS NULL` |

---

## 4. Data Integrity Rules

### Foreign Key Cascade Policy

| Table | Column | ON DELETE |
|---|---|---|
| `orders` | `user_id`, `venue_id` | **RESTRICT** — history must survive catalog edits |
| `order_items` | `dish_id` | **RESTRICT** — receipt integrity |
| `venues` | `owner_user_id` | **SET NULL** — venue survives account deletion |
| `reviews` | `author_user_id` | **SET NULL** — preserve anonymized reviews |
| `posts` | `author_user_id` | **CASCADE** — posts are owned content |
| `chat_threads` children | `thread_id` | **CASCADE** — messages are owned by thread |
| `modifier_groups` children | `group_id` | **CASCADE** — options are owned by group |

### Soft Delete Pattern

Tables with `deleted_at`:  `users`, `venues`, `dishes`, `posts`, `reviews`

All read queries must filter `WHERE deleted_at IS NULL`. All partial indexes above are already scoped this way. Never hard-delete these rows once they have FK dependents.

### Money

- All prices and amounts stored as `BIGINT` cents (SGD × 100).
- `price_range_label` is a pre-formatted display string, never computed client-side.
- `order_items.unit_price_cents` and `order_item_modifiers.price_delta_cents` are **snapshots** — immutable after order placement.
- `dishes.rating_avg` is denormalized and updated by a Postgres trigger on `INSERT/UPDATE/DELETE` on `reviews`.

### Constraints

- `users_guest_or_identity` — guest users must not have an email/phone requirement; registered users must have at least one.
- `venue_closures` exclusion — `btree_gist` range exclusion prevents overlapping closure windows for the same venue.
- `follows` CHECK — `follower_id <> followee_id` (no self-follows).
- `reviews` UNIQUE — one review per `(dish_id, author_user_id)`.
- `payments` UNIQUE — `(provider, provider_txn_id)` prevents duplicate charge records.
- `payments.idempotency_key` UNIQUE — retry-safe payment creation.

---

## 5. API Design

### Endpoint Conventions

```
GET    /api/buildings                        — discovery map, supports ?lat&lng&radius&type
GET    /api/buildings/:id                    — building detail + open venues
GET    /api/venues/:id                       — venue detail + menu
GET    /api/venues/:id/menu                  — dishes grouped by category
GET    /api/dishes/:id                       — dish detail + reviews
GET    /api/feed                             — social feed (paginated cursor)
GET    /api/users/me                         — authenticated profile
PATCH  /api/users/me/taste-vector            — update 6-dim taste profile
POST   /api/qr/scan                          — validate QR token → session
POST   /api/orders                           — place order
PATCH  /api/orders/:id/status                — vendor: accept/ready/cancel
GET    /api/orders/:id                       — order detail
GET    /api/chat/threads                     — user's thread list
GET    /api/chat/threads/:id/messages        — paginated message history
POST   /api/chat/threads/:id/messages        — send message
```

### Pagination

- Feed and messages: **cursor-based** on UUIDv7 id (sort by `created_at DESC`, cursor = last seen id).
- Lists: offset/limit acceptable for low-cardinality (e.g. buildings, venue categories).

### Search

```
GET /api/search?q=laksa&lat=1.28&lng=103.85&radius=1000&dietary=halal&category=noodles
```

Executes against `dishes.search_tsv` (FTS) with trigram fallback. Also filters by `dish_dietary_flags` and `venue_category_map`. Returns unified results ranked by FTS rank × distance × rating.

### Taste Recommendations

```
POST /api/recommendations/dishes
Body: { tasteVector: [sweet, spicy, sour, salty, rich, aromatic] }
```

Runs pgvector cosine similarity between `user_taste_vectors.vector` and `dish_taste_vectors.vector`. Top-K results joined against available dishes.

---

## 6. Authentication & Session Model

### Identity Lifecycle

```
QR scan
  → create guest user (is_guest=TRUE)
  → create guest_session (token, expires_at, venue_id)
  → user can order without login

guest orders → prompts sign-up (soft gate)
  → on sign-up: upgraded_to_user_id set on guest_session
  → same user_id preserved — all orders/history intact
```

### Roles

| Role | Can do |
|---|---|
| `diner` | Browse, review, order, chat |
| `vendor_owner` | All of diner + manage venue, menu, accept orders, view stall analytics |
| `vendor_staff` | Same as vendor_owner minus payout settings |
| `moderator` | Flag/remove posts and reviews |
| `admin` | Full access |

One user can hold multiple roles simultaneously (e.g. a vendor who is also a diner).

### Session Tokens

- **JWT** (short-lived, 15m) + **Refresh token** (httpOnly cookie, 7d) for registered users.
- **Guest session token** stored in `qr_sessions.token` — validated per request, expires after the session window (e.g. 2h).
- Redis stores presence state and active QR session → cart mapping.

---

## 7. Real-Time & Messaging

### Architecture

```
Client → WebSocket (or SSE) → Redis pub/sub → Postgres write
```

- On message send: write to `chat_messages`, publish to Redis channel `thread:{id}`.
- Subscribers (all participants in the thread) receive the message in real-time.
- On reconnect: client fetches from last known message id using the REST paginated endpoint.
- `last_message_at` on `chat_threads` is updated on every message insert (denormalized for thread list sorting).
- `chat_participants.last_read_at` updated when user scrolls to bottom or sends a message.
- `chat_message_receipts` written async (delivered_at on delivery, read_at on read event).

### Order Status Push

- Kitchen accepts/rejects order → writes to `order_status_history` → publishes to Redis channel `order:{id}`.
- Client SSE subscription receives status transitions in real-time.
- Fallback: client polls `GET /api/orders/:id` every 10s if WebSocket drops.

---

## 8. Commerce Flow

```
1. QR scan        → POST /api/qr/scan          → validate token, return session
2. Browse menu    → GET  /api/venues/:id/menu   → cached in Redis for 60s
3. Add to cart    → client-side state (Redux/Zustand)
4. Place order    → POST /api/orders            → status: 'placed'
                                                → push notification to vendor
5. Vendor accepts → PATCH /api/orders/:id/status → 'accepted' → push to diner
6. Preparing      → PATCH                        → 'preparing'
7. Ready          → PATCH                        → 'ready' → push to diner
8. Payment        → POST /api/payments           → idempotency_key = order_id
                                                → provider webhook updates status
9. Collected      → PATCH /api/orders/:id/status → 'collected'
```

### Idempotency

- All payment creation calls include `idempotency_key = order_id + attempt_number`.
- `payments.idempotency_key` is UNIQUE — safe to retry on network failure.
- Orders in `draft` status can be modified; once `placed`, `order_items` are immutable.

### Supported Payment Providers (initial)

| Provider | Method |
|---|---|
| Stripe | Card, PayNow QR |
| GrabPay | GrabPay wallet |

---

## 9. Media & CDN

- All image/video uploads go directly to **Vercel Blob** (or Cloudflare R2).
- Schema stores `cdn_url` strings only — no binary data in Postgres.
- `blurhash` strings stored alongside URLs for progressive image loading (matches V1 `DishSummary.blurhash`).
- Upload flow: client → signed upload URL (via `/api/upload/sign`) → direct to CDN → returns URL → stored in schema.
- Video thumbnails generated server-side (Vercel serverless function) on upload completion.

---

## 10. Migrations & Seeding

### Migration tool

Use **Drizzle ORM** or **Flyway** — keep migration files in `db/migrations/`.

```
db/
  migrations/
    0001_v2_initial_schema.sql
    0002_seed_dietary_flags.sql
    0003_seed_venue_categories.sql
```

### Seed data

Seed from existing V1 mock fixtures in `src/lib/services/mock/data.ts`:

| V1 fixture | V2 target tables |
|---|---|
| 3 buildings (Maxwell, Lau Pa Sat, Amoy) | `buildings` |
| 5 venues (Tian Tian, Old School Laksa, etc.) | `venues`, `building_floors` |
| 5 dishes (Chicken Rice, Laksa, etc.) | `dishes`, `dish_images` |
| 2 blog posts | `blog_sources`, `blog_posts` |
| 1 user profile (Wei Ming) | `users`, `user_taste_vectors` |
| `guestProfile` | `users` (is_guest=TRUE) |

### Rating trigger

```sql
CREATE OR REPLACE FUNCTION update_dish_rating() RETURNS TRIGGER AS $$
BEGIN
  UPDATE dishes SET
    rating_avg   = (SELECT AVG(rating) FROM reviews WHERE dish_id = COALESCE(NEW.dish_id, OLD.dish_id) AND deleted_at IS NULL),
    rating_count = (SELECT COUNT(*) FROM reviews WHERE dish_id = COALESCE(NEW.dish_id, OLD.dish_id) AND deleted_at IS NULL)
  WHERE id = COALESCE(NEW.dish_id, OLD.dish_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_dish_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_dish_rating();
```

---

## 11. V1 → V2 Domain Mapping

| V1 TypeScript interface | V2 tables |
|---|---|
| `BuildingSummary` | `buildings` |
| `BuildingType` | `building_type` enum |
| `VenueSummary` | `venues`, `building_floors` |
| `HygieneGrade` | `hygiene_grade` enum |
| `DeliveryLink` | `venue_delivery_links` |
| `DeliveryPlatform` | `delivery_platform` enum |
| `DishSummary` / `DishDetail` | `dishes`, `dish_images`, `dish_dietary_flags` |
| `TasteVector` | `user_taste_vectors`, `dish_taste_vectors` (vector(6)) |
| `TasteKey` | Index 0–5 of the vector column |
| `DietaryFlag` | `dietary_flags`, `dish_dietary_flags`, `user_dietary_preferences` |
| `Review` | `reviews`, `review_photos`, `review_tags` |
| `StallPost` | `posts`, `post_media`, `post_dish_refs` |
| `BlogPost` | `blog_posts`, `blog_sources` |
| `UserProfile` | `users`, `user_taste_vectors`, `user_dietary_preferences`, `user_favourite_dishes`, `user_favourite_venues` |
| `AppSession` | `guest_sessions`, `user_roles` |
| `SearchFilters` | Query params → `dishes.search_tsv`, `venue_category_map`, `dish_dietary_flags` |
| `SearchCategory` | `venue_categories` |

> When the V2 API ships: update `src/lib/services/mock/repositories.ts` to call real endpoints and remove mock data. The repository function signatures (`getDishById`, etc.) should stay identical — screens call repositories, not raw fetch.
