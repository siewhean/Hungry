# Hungry Spec: Content Model and Feed Architecture (Beta)

## Scope

This document defines:
- canonical content entities
- entity boundaries and relationships
- feed placement rules
- ranking and visibility constraints

This is an implementation spec, not product copy.

---

## 1) Content Model (Canonical)

## 1.1 Core Principle

Treat **Post** and **Review** as separate first-class entities with optional linkage.

Reason:
- They solve different user intents (social expression vs structured evaluation).
- They have different required fields and ranking logic.
- They should remain independently queryable and moderatable.

## 1.2 Entity Set

## Authoring entities
- `post`
- `review`
- `bite`

## Interaction entities
- `comment`
- `reaction` (like/save/etc.)
- `rating` (structured score)

## Attachment entities
- `media_asset`
- `music_attachment`
- `tag_attachment` (food tags, taste tags, topic tags)
- `collaborator_attachment`
- `location_attachment`

## Domain entities
- `dish`
- `stall` (or venue-stall)
- `venue`
- `building`
- `user_profile`

## Governance entities
- `report`
- `moderation_action`
- `visibility_rule`

## 1.3 Required Field Boundaries

### `post` (social-first)
Required:
- `id`, `author_id`, `created_at`
- at least one of: `caption` or `media_asset`
- `visibility_state`

Optional:
- linked `dish_id` / `stall_id` / `venue_id`
- `music_attachment`
- collaborators, tags, location

Not required:
- rating

### `review` (structured-first)
Required:
- `id`, `author_id`, `created_at`
- target reference (`dish_id` preferred; else `stall_id`)
- `rating` (normalized scale)
- `review_text` (bounded length)
- `visibility_state`

Optional:
- media, taste tags, location
- linked `post_id`

### `bite` (lightweight moment)
Required:
- `id`, `author_id`, `created_at`
- media OR short text
- `expires_at` if ephemeral behavior is enabled

Optional:
- dish/stall linkage
- taste tags

## 1.4 Relationship Rules

- One composer action may produce:
  - Post only
  - Review only
  - Post + Review (two records, linked by `origin_composer_session_id`)
- `comment` is polymorphic:
  - `parent_type`: post | review | bite
  - `parent_id`
- `rating` belongs to `review` and is denormalized onto dish/stall aggregates.
- `bite` should not silently become `post`; conversion must be explicit.

## 1.5 Lifecycle States

Each authoring entity (`post`, `review`, `bite`) supports:
- `draft`
- `scheduled`
- `published`
- `archived`
- `removed` (moderation/deletion)

Do not mix lifecycle state with visibility state.

Visibility state should be separate:
- `public`
- `followers_only` (if applicable)
- `private`
- `hidden_by_moderation`

---

## 2) Feed Architecture

## 2.1 Surface Contracts

### Home Feed
Primary units:
- `post`
- `bite` (story rail + optional feed cards)

Secondary units:
- lightweight review activity cards (not full review-first cards)

Do not make Home the canonical structured-review surface.

### Review Feed
Primary units:
- `review` cards with rating + tags + target context

Secondary units:
- linked post preview (only if review has linked post)

Do not inject unrelated social posts into Review feed ranking.

### Rate Surface
Function:
- creation entrypoint for quick `review` submission

Output:
- review record only (unless user explicitly chooses multi-publish path)

### Bites Surface / Rail
Primary units:
- `bite` only

Behavior:
- low-friction, short-form, optionally ephemeral

Do not overload with long caption post behavior.

### Detail Surfaces
- Dish Detail: review-heavy + relevant post/bite snippets linked to dish
- Stall Detail: review-heavy + merchant claim + dish-linked social snippets
- User Profile: tab-separated authored content (`Posts`, `Reviews`, `Bites`)

## 2.2 Placement Matrix

| Entity | Home | Review | Rate | Bites Rail | Dish Detail | Stall Detail | Profile |
|---|---|---|---|---|---|---|---|
| Post | Primary | Reference-only | No | Optional preview | Secondary | Secondary | Yes |
| Review | Secondary | Primary | Created here | No | Primary | Primary | Yes |
| Bite | Primary rail | Optional contextual | No | Primary | Secondary | Secondary | Yes |
| Comment | Detail views only | Detail views only | No | Detail views only | Yes | Yes | Thread views |
| Rating | Not standalone | Embedded | Input | No | Embedded aggregates | Embedded aggregates | In review cards |

## 2.3 Ranking Boundaries

Home ranking signals:
- recency
- social engagement velocity
- taste affinity
- creator affinity/diversity

Review ranking signals:
- review quality score
- rating confidence
- relevance to user taste profile
- target recency and helpfulness

Hard rule:
- Do not use identical ranking formula for Home and Review.

## 2.4 Anti-overlap Guardrails

- If a feature can be accessed from multiple surfaces, ownership still belongs to one canonical surface.
- Home can preview reviews; Review owns full review browsing.
- Rate owns quick review creation; Composer owns advanced multi-output creation.
- Bites owns lightweight moments; do not merge semantics into posts.

---

## 3) Composer-to-Content Mapping

## 3.1 Publish Modes

- `post_only` -> create `post`
- `review_only` -> create `review` + `rating`
- `post_and_review` -> create both + link

## 3.2 Validation by Mode

- `post_only`: require caption or media
- `review_only`: require target + rating + bounded text
- `post_and_review`: enforce both rule sets independently

## 3.3 Scheduling

Scheduling should apply per output record:
- if mode is `post_and_review`, scheduler can support:
  - same timestamp for both (default)
  - optional split timestamps (future enhancement)

---

## 4) Beta Decisions Required (Implementation-facing)

1. Canonical review target:
- enforce `dish_id` first, fallback `stall_id`, or allow both equally.

2. Bite expiry:
- ephemeral (24h/48h) vs persistent bites.

3. Multi-publish transaction model:
- atomic all-or-nothing vs partial success with retry queue.

4. Moderation entrypoint:
- central moderation queue vs per-entity queues.

---

## 5) Definition of Done for this spec

- Entities and required fields are represented in domain types.
- Composer modes map to explicit entity creation paths.
- Feed queries are separated by surface contract.
- Home and Review ranking pipelines are independent.
- Profile view is tabbed by entity type.
