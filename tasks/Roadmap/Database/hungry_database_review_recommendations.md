# Hungry Database Review & Scalability Recommendations

**Project:** Hungry  
**Focus:** Database scalability, social media features, merchant operations, user personalization, and high-volume readiness  
**Generated:** 2026-05-14

---

## 1. Executive Summary

Hungry already has a strong backend direction: PostgreSQL/Supabase, PostGIS for location discovery, pgvector for taste and recommendation vectors, object storage for media, and a domain model that already considers users, venues, dishes, reviews, posts, merchants, QR ordering, payments, refunds, and supply priming.

The next improvement is **not simply adding more columns**. The most important next step is to separate:

1. Raw imported data
2. Canonical production data
3. User-generated content
4. Merchant-controlled data
5. Third-party enriched data
6. Derived ranking/recommendation data
7. Operational/audit data

The current system is suitable for beta/prototype usage, but before scaling to high user volume, merchant onboarding, and social feeds, the database should be upgraded to support provenance, deduplication, server-side pagination, feed ranking, moderation, merchant organizations, menu versioning, and background jobs.

---

## 2. Current Strengths

### 2.1 Strong backend direction

The current architecture makes good choices:

- PostgreSQL/Supabase as the primary relational database
- PostGIS for location-aware discovery
- pgvector for recommendations and taste vectors
- Supabase Storage / object storage for media
- RLS patterns for user isolation
- Future merchant, social, and QR ordering workflows already considered

### 2.2 Useful existing domains

The project already accounts for many important entities:

- Users
- User roles
- Vendor profiles
- Buildings / hawker centres / food courts
- Venues / stalls / restaurants
- Dishes
- Reviews
- Posts
- Post media
- Chat
- QR sessions
- Orders
- Payments
- Refunds
- Menu OCR
- Merchant claim interests

### 2.3 Good supply-priming concept

The menu OCR and “claim this stall” flow is a strong two-sided marketplace strategy. It lets Hungry collect menu data and merchant interest before fully launching the merchant portal.

---

## 3. Main Risks in the Current Implementation

### 3.1 Google Sheets should not become the production database

Your Google Sheet is useful for staging and enrichment, but it should not be treated as the source of truth once the product scales.

A spreadsheet is weak for:

- Deduplication
- Access control
- Audit trails
- Data provenance
- Concurrent edits
- Large-scale querying
- Merchant workflows
- App performance
- Data validation

### 3.2 App-side full hydration will not scale

The current pattern of loading broad Supabase tables into app/service-level memory caches is acceptable for a small beta dataset, but it will not scale once there are:

- Tens of thousands of venues
- Hundreds of thousands of dishes
- Frequent posts
- Likes, comments, saves
- Merchant updates
- Personalized feeds
- Search traffic

The app should request small, paginated, server-filtered result sets instead of loading full tables.

### 3.3 Imported data will create duplicates

Food stall data in Singapore will naturally contain duplicates because the same business can appear across:

- SFA/NEA records
- Google Places
- Merchant websites
- Delivery platforms
- Instagram/Facebook
- Manual entries
- OCR menu submissions
- User-generated posts

Without a deduplication and provenance layer, the database will become messy quickly.

### 3.4 Merchant workflows need a more flexible ownership model

The earlier assumption that one merchant account owns exactly one stall is useful for MVP simplicity, but the database should evolve to support:

- One owner managing multiple stalls
- One brand managing multiple outlets
- Staff accounts
- Manager roles
- Ops reviewers
- Accountants
- Franchise-style merchant groups

### 3.5 Social media features need moderation and partitioning

Once users can post, comment, like, save, report, upload photos, and follow each other, the database must support:

- High write volume
- Content moderation
- Abuse reporting
- User blocking
- Private/public visibility
- Feed ranking
- Notification fanout
- Comment threading
- Partitioned high-volume tables

---

# 4. Priority Recommendations

---

## P0 — Must Fix Before Scaling Beyond Beta

### 4.1 Build a staging import pipeline

Do not import Google Sheets rows directly into production tables.

Recommended pipeline:

```text
Google Sheets / CSV
→ staging_food_businesses
→ validation + deduplication
→ canonical buildings / venues / dishes / menus / media
→ production Supabase tables
```

Recommended staging tables:

```sql
staging_food_businesses
staging_google_places_observations
staging_menu_items
staging_photos
staging_import_errors
import_runs
```

Recommended import tracking fields:

```text
import_run_id
source_name
source_file
row_number
raw_payload
parsed_payload
validation_status
error_reason
created_at
```

This allows you to re-run failed imports safely, validate rows before production insertion, trace bad data back to the source, avoid corrupting canonical records, and compare new imports with older imports.

---

### 4.2 Add a source and provenance layer

You need to know where each field came from.

Recommended tables:

```sql
external_sources
external_place_refs
venue_source_observations
dish_source_observations
photo_source_observations
```

Example table:

```sql
CREATE TABLE external_place_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id),
  source text NOT NULL, -- google_places, nea, sfa, merchant, manual, ocr
  external_id text,
  source_url text,
  confidence numeric,
  matched_at timestamptz DEFAULT now(),
  last_seen_at timestamptz,
  raw_payload jsonb
);
```

The same venue may have conflicting information from Google, merchants, official records, user submissions, delivery platforms, and OCR. The system should store observations and decide what to trust instead of blindly overwriting canonical data.

---

### 4.3 Replace app-side full-cache hydration with server-side queries

Instead of hydrating broad tables and filtering client-side, create server-side RPCs or API endpoints.

Recommended RPC/API functions:

```sql
search_dishes(query, lat, lng, radius, dietary_flags, limit, cursor)
get_venue_detail(venue_id)
get_home_feed(user_id, cursor)
get_nearby_open_venues(lat, lng, radius, now)
get_merchant_dashboard(merchant_id)
get_dish_detail(dish_id)
get_user_profile_summary(user_id)
```

Use cursor pagination everywhere.

Good cursor options:

```text
created_at + id
rating_score + id
distance + id
score + id
```

Avoid offset pagination for large feeds and searches.

---

### 4.4 Standardize IDs and avoid foreign-key type drift

All core entity IDs should use the same type.

Recommended standard:

```text
users.id              uuid
buildings.id          uuid
venues.id             uuid
dishes.id             uuid
posts.id              uuid
orders.id             uuid
merchant_claims.id    uuid
media_assets.id       uuid
```

If you need source-specific IDs, add separate fields:

```text
slug
public_code
external_id
source_row_id
google_place_id
nea_licence_number
sfa_licence_number
```

Do not use `TEXT` for core foreign keys unless there is a strong reason.

---

### 4.5 Add canonical deduplication logic

Recommended dedupe signals:

```text
Google Place ID
UEN
SFA licence number
NEA licence number
postal code + unit number
business name normalized
building / hawker centre
latitude / longitude proximity
phone number
website
social URL
delivery platform URL
```

Recommended tables:

```sql
CREATE TABLE venue_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id),
  alias_name text NOT NULL,
  source text,
  confidence numeric,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE venue_merge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surviving_venue_id uuid REFERENCES venues(id),
  merged_venue_id uuid REFERENCES venues(id),
  reason text,
  merged_by uuid,
  merged_at timestamptz DEFAULT now()
);
```

A good F&B database depends on clean entity resolution. Duplicate venues will break merchant claiming, menus, reviews, ratings, orders, analytics, search, and recommendations.

---

## P1 — Social Media Database Improvements

### 4.6 Separate social posts from reviews

A review is structured product data. A post is social content.

Recommended model:

```sql
reviews
review_photos
review_tags

posts
post_media
post_likes
post_comments
post_saves
post_reports
post_mentions
post_dish_refs
post_venue_refs
```

Do not overload a single table to handle reviews, TikTok-style posts, comments, and merchant updates.

---

### 4.7 Partition high-write social tables

Recommended partitioned tables:

```text
posts
post_comments
post_likes
post_saves
notifications
user_activity_events
chat_messages
post_impressions
```

Partitioning approach:

```text
posts: monthly by created_at
comments: monthly by created_at
chat_messages: monthly by created_at
notifications: monthly by created_at
user_activity_events: monthly by occurred_at
```

High-volume social systems generate many writes. Partitioning keeps queries, deletes, archiving, and maintenance manageable.

---

### 4.8 Add feed-ranking read models

Do not compute the entire feed live from many joins.

Recommended table:

```sql
CREATE TABLE user_feed_items (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  score numeric NOT NULL,
  reason text,
  inserted_at timestamptz DEFAULT now(),
  seen_at timestamptz,
  PRIMARY KEY (user_id, post_id)
);
```

Ranking inputs:

```text
follow graph
liked dishes
saved venues
review history
location
dietary preferences
time of day
post engagement
freshness
merchant promotions
diversity guardrail
```

A feed should be optimized for fast reads. Ranking can happen asynchronously.

---

### 4.9 Add moderation infrastructure

Recommended tables:

```sql
content_reports
content_moderation_actions
blocked_users
muted_users
hidden_posts
trust_scores
```

Example:

```sql
CREATE TABLE content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);
```

Moderation should cover posts, comments, reviews, photos, merchant uploads, menu submissions, profile names, and merchant descriptions.

---

## P1 — Merchant Database Improvements

### 4.10 Replace single-owner assumptions with merchant organizations

Recommended model:

```sql
merchant_organizations
merchant_members
merchant_roles
merchant_outlets
merchant_claims
merchant_verification_events
```

Suggested hierarchy:

```text
merchant_organization
  └── merchant_members
  └── venues
      └── menus
      └── menu_items
      └── orders
```

Merchant roles:

```text
owner
manager
staff
ops
accountant
viewer
```

This supports one owner with multiple stalls, staff access, multi-outlet brands, future merchant portal, QR ordering, order inboxes, and analytics dashboards.

---

### 4.11 Use merchant change requests instead of direct live edits

Recommended table:

```sql
CREATE TABLE merchant_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_org_id uuid,
  venue_id uuid,
  change_type text NOT NULL,
  payload jsonb NOT NULL,
  status text DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

Auto-approve low-risk changes:

```text
price
availability
dish description
opening-hour note
featured dish toggle
```

Require review for high-risk changes:

```text
business name
ownership
location
licence number
bank/payout information
legal business details
```

---

### 4.12 Add menu versioning

Recommended tables:

```sql
menus
menu_versions
menu_sections
menu_items
menu_item_variants
modifier_groups
modifier_options
menu_item_availability
price_history
```

Orders should always store immutable snapshots:

```text
dish_name_snapshot
unit_price_snapshot
modifier_snapshot
merchant_name_snapshot
tax_snapshot
```

Menus change frequently. Historical orders must not change when current menu prices change.

---

## P1 — User and Personalization Improvements

### 4.13 Build a user behavior event table

Recommended append-only table:

```sql
CREATE TABLE user_behavior_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id uuid,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  properties jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
```

Track events such as:

```text
dish_tap
venue_tap
save_dish
save_venue
post_like
post_comment
review_submit
search_submit
order_place
menu_view
share
follow
```

Then aggregate into:

```sql
user_habit_profiles
user_dish_affinities
user_venue_affinities
user_time_window_preferences
user_search_profiles
recommendation_snapshots
```

---

### 4.14 Add privacy controls

Recommended table:

```sql
CREATE TABLE user_privacy_settings (
  user_id uuid PRIMARY KEY,
  personalization_enabled boolean DEFAULT true,
  location_history_enabled boolean DEFAULT false,
  public_profile_enabled boolean DEFAULT true,
  allow_dm_from text DEFAULT 'followers',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

User-facing privacy features:

```text
clear search history
clear behavior history
disable personalization
delete account
export data
block users
hide saved lists
private profile mode
```

---

## P1 — Search and Discovery Improvements

### 4.15 Create dedicated search documents

Recommended table:

```sql
CREATE TABLE search_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  cuisine text[],
  dietary_flags text[],
  location geography(Point, 4326),
  search_tsv tsvector,
  embedding vector,
  popularity_score numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
```

This can support queries like:

```text
"open now nearby"
"cheap lunch under $5"
"best halal chicken rice near me"
"vegetarian food in Tanjong Pagar"
"popular spicy noodles near me"
```

Use a combination of:

```text
Postgres full-text search
trigram search
geospatial filtering
popularity score
embedding similarity
personalization score
```

---

### 4.16 Compute open-now status properly

Do not rely only on a static `is_open` flag.

Use:

```sql
venue_operating_hours
venue_special_hours
venue_closures
merchant_live_status
```

Derived fields:

```text
is_open_now
next_open_at
next_close_at
closure_reason
last_merchant_status_update
```

Factors:

```text
weekly operating hours
public holidays
merchant manual override
temporary closures
sold-out status
special events
```

---

## P1 — Data Quality and Enrichment Improvements

### 4.17 Store Google Places data separately

Do not overwrite canonical venue fields directly with Google Places data.

Recommended table:

```sql
CREATE TABLE google_places_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id),
  google_place_id text,
  display_name text,
  formatted_address text,
  rating numeric,
  user_rating_count int,
  price_level text,
  opening_hours jsonb,
  website_uri text,
  google_maps_uri text,
  photos jsonb,
  fetched_at timestamptz DEFAULT now(),
  field_mask text[],
  raw_payload jsonb
);
```

Your canonical venue should remain controlled by your own confidence and trust rules.

---

### 4.18 Create a universal media asset table

Recommended table:

```sql
CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid,
  venue_id uuid,
  dish_id uuid,
  source text,
  storage_bucket text,
  storage_path text,
  cdn_url text,
  external_url text,
  width int,
  height int,
  blurhash text,
  attribution jsonb,
  moderation_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
```

Reference this from:

```text
dish_images
venue_images
review_photos
post_media
menu_photo_submissions
merchant_uploads
```

You do not want random image URLs spread across many unrelated tables.

---

## P2 — High-Volume Infrastructure Improvements

### 4.19 Add read replicas and connection pooling

Before serious launch, plan for:

```text
Supabase primary DB for writes
read replicas for heavy reads
connection pooling for mobile traffic
Redis for hot cache / presence / rate limits
background jobs for enrichment and ranking
object storage CDN for media
```

Recommended cached data:

```text
venue detail
dish detail
hot menus
homepage modules
merchant dashboard stats
feed pages
search suggestions
```

---

### 4.20 Move heavy work into background jobs

Do not run heavy jobs inside user request paths.

Background job candidates:

```text
Google Places enrichment
menu OCR
menu extraction
photo processing
feed ranking
notification fanout
merchant analytics aggregation
recommendation profile updates
duplicate detection
import validation
```

Recommended tables:

```sql
background_jobs
job_attempts
import_runs
enrichment_runs
```

---

### 4.21 Add materialized counters and analytics summaries

Use raw event tables as source of truth, but maintain summary fields for fast reads.

Examples:

```text
posts.like_count
posts.comment_count
posts.save_count
venues.review_count
venues.rating_avg
dishes.review_count
dishes.rating_avg
merchant_dashboard_daily_stats
venue_daily_stats
dish_daily_stats
```

For high volume, prefer background aggregation over triggers.

---

## P2 — Database Hygiene and Security

### 4.22 Add audit logs for sensitive changes

Recommended table:

```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);
```

Audit these events:

```text
merchant verification
menu price changes
bank payout changes
order status changes
refunds
admin moderation
venue merges
account deletion
role changes
```

---

### 4.23 Standardize soft deletion

Use soft deletion consistently:

```text
deleted_at
deleted_by
delete_reason
restored_at
restored_by
```

Apply to:

```text
users
venues
dishes
posts
comments
reviews
media_assets
merchant_claims
menu_items
```

---

### 4.24 Add stronger uniqueness constraints

Recommended uniqueness rules:

```sql
UNIQUE (building_id, unit_number)
UNIQUE (venue_id, normalized_name)
UNIQUE (google_place_id)
UNIQUE (user_id, venue_id)
UNIQUE (user_id, dish_id)
UNIQUE (provider, provider_txn_id)
UNIQUE (merchant_org_id, venue_id)
```

This prevents accidental duplicate records.

---

# 5. Recommended Target Architecture

Organize the database into modules.

```text
1. Identity
   user_profiles
   user_roles
   user_privacy_settings
   user_blocks
   user_devices

2. Food Graph
   buildings
   floors
   venues
   venue_aliases
   venue_source_refs
   dishes
   menu_sections
   menu_items
   modifiers
   dietary_flags

3. Enrichment
   import_runs
   staging_food_businesses
   google_places_observations
   source_observations
   data_quality_flags

4. Social
   posts
   post_media
   comments
   likes
   saves
   follows
   reports
   moderation_actions

5. Merchant
   merchant_organizations
   merchant_members
   merchant_claims
   merchant_verifications
   merchant_change_requests
   merchant_audit_log

6. Commerce
   qr_sessions
   orders
   order_items
   payments
   refunds
   payouts
   webhooks

7. Personalization
   user_behavior_events
   user_habit_profiles
   dish_taste_vectors
   user_taste_vectors
   recommendation_snapshots

8. Ops
   background_jobs
   import_errors
   audit_log
   feature_flags
```

---

# 6. Recommended Implementation Roadmap

## Phase 1 — Stabilize canonical food data

1. Add staging import tables.
2. Add source/provenance tables.
3. Add venue aliases and merge events.
4. Add Google Places observations table.
5. Build dedupe logic before importing all 32k rows.

## Phase 2 — Fix app read patterns

1. Replace full-cache hydration with server-side paginated queries.
2. Add RPCs for venue detail, dish search, nearby open venues, and feeds.
3. Add cursor pagination.
4. Add indexes for common queries.

## Phase 3 — Social scalability

1. Separate posts from reviews.
2. Add moderation tables.
3. Add follows, saves, likes, reports, hidden posts, and blocked users.
4. Add feed read model.
5. Partition high-write social tables.

## Phase 4 — Merchant readiness

1. Add merchant organizations.
2. Add merchant members and roles.
3. Add merchant change requests.
4. Add menu versioning.
5. Add verification events and audit logs.

## Phase 5 — Personalization and high-volume systems

1. Add user behavior event table.
2. Add privacy settings.
3. Add habit profile summary tables.
4. Add recommendation snapshots.
5. Add background jobs and materialized counters.

## Phase 6 — Commerce readiness

1. Finalize QR sessions.
2. Finalize order lifecycle.
3. Add immutable snapshots to orders.
4. Add payment/refund/webhook audit records.
5. Add merchant payout summaries.

---

# 7. Shortlist of Most Important Next Actions

If you only do 10 things next, do these:

```text
1. Create staging import tables for Google Sheets / CSV.
2. Add source/provenance tables.
3. Add Google Places observations table.
4. Add venue alias and merge-event tables.
5. Standardize core IDs and foreign keys.
6. Replace app-side full hydration with paginated server-side queries.
7. Separate reviews from social posts.
8. Add merchant organizations and merchant members.
9. Add menu versioning.
10. Add user_behavior_events with privacy controls.
```

---

# 8. Final Assessment

Hungry’s current schema direction is strong for a serious F&B/social/merchant product, but it needs a data-quality and scalability layer before the full database is imported and before merchant/QR/social features scale.

The most important principle:

```text
Do not let raw imported data, merchant edits, user-generated content,
Google observations, and canonical production data all live in the same
flat structure.
```

The database should be designed around:

```text
canonical truth
source observations
review workflows
auditability
deduplication
server-side pagination
background processing
privacy controls
merchant ownership
feed scalability
```

Once those are in place, Hungry can scale much more safely toward a real social food discovery and merchant platform.
