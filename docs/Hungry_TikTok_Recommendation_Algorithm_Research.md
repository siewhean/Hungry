---
title: "Understanding TikTok-Style Recommendation Systems and Designing a Taste-Learning Engine for Hungry"
subtitle: "A source-grounded research and engineering blueprint"
author: "Hungry — Product & Engineering Research"
date: "20 October 2026"
version: "1.0"
status: "Research and proposed architecture; no production implementation performed"
---

# Understanding TikTok-Style Recommendation Systems and Designing a Taste-Learning Engine for Hungry

**Research and engineering blueprint | 20 October 2026 | Version 1.0**

> **Central question.** How can Hungry infer what an individual wants to eat from normal in-app behaviour—searches, dish views, saves, reviews, and route requests—without repeatedly asking them to complete preference questionnaires?
>
> **Bottom line.** Build an *intent-aware, evidence-weighted, continuously updated* recommender. Preserve the user's current search as a hard priority, learn a separate long-term food-affinity profile, diversify recommendations, and optimise for useful food decisions rather than minutes spent scrolling.

## Executive summary

TikTok's advantage is not a single publicly known equation. Its own documentation describes a feedback system in which interactions (including views, skips, likes, shares and searches), content information, and context are combined to rank potential recommendations. TikTok says interactions generally have greater influence than weak contextual proxies such as device settings. It also explicitly introduces unfamiliar material to avoid purely repetitive feeds. [1–4] The precise production architecture, weights, objective functions, sampling policies, and model parameters are not publicly disclosed.

ByteDance's published **Monolith** paper provides valuable evidence of *recommender-system engineering techniques*: sparse identity embeddings, collision avoidance, continuous event ingestion, and online training with rapid parameter synchronisation. It documents an implementation in BytePlus Recommend and advertising/recommendation evaluation contexts; **it is not public proof that TikTok's present-day For You feed uses Monolith unchanged**. [5–6] Independent studies further show that TikTok-style behaviour-conditioned feeds can reinforce interests quickly, while highlighting risks of topic lock-in and difficulty escaping unwanted recommendations. [7–9]

Hungry's problem differs materially from short-video consumption. A video can be watched in seconds; a meal choice depends on **dish relevance, location, price, availability, dietary constraints, and the immediate craving**. Hungry must infer distinct concepts: *curiosity* (a search), *consideration* (a detail view), *intent* (saving/opening directions), *experience* (a verified or credible tried/reviewed dish), and *taste* (repeat positive responses to dish characteristics). Search and a saved dish are not automatically proof of a favourite food, and a low dwell time is not reliable dislike.

**Recommended system:** a modular, two-stage candidate-retrieval and ranking engine with an explicit query-intent layer, short-term session state, long-term preference vector, item metadata and semantic embeddings, exposure-aware training data, hard eligibility filters, calibrated utility predictions, and a final diversity re-ranker. Start with audited dish metadata and deterministic scoring; graduate to gradient-boosted learning-to-rank and contextual bandits only after trustworthy labels and adequate traffic exist. Use Supabase Postgres/RLS and Edge Functions as practical starting infrastructure. [10–13]

**Proposed north-star metric:** *Weekly Meaningful Food Decisions* (WMFD), counted from defensible indicators that the product actually helped someone choose food. Use D7/D28 cohort retention, search success, time-to-decision, recommendation diversity, negative-feedback rate, privacy/opt-out rates and latency as safeguards. Do **not** optimise pure screen time or arbitrary search count.

### Evidence-quality legend

| Label | Meaning | How this document uses it |
|:--|:--|:--|
| **Documented by TikTok** | Public TikTok newsroom or support statements | Inputs, relative categories of signals, diversity, controls; not exact weights |
| **Published by ByteDance** | Research article or public repository | Evidence of feasible engineering techniques; not a verified diagram of TikTok's live stack |
| **Independent observation** | Controlled audits, interviews, or external analyses | Behavioural outcomes under study conditions; not the proprietary model internals |
| **Established recommender science** | Peer-reviewed industry/academic methods | Candidate retrieval, sequential modelling, counterfactual evaluation |
| **Hungry proposal** | Choices introduced in this report | Weights, schemas, metrics, SLAs, experiments and roadmap; require testing |

## 1. Research scope, methodology and limits

This report triangulates: (a) TikTok's first-party descriptions of the For You feed, recommendation controls and search; (b) ByteDance's Monolith research and open repository; (c) independent empirical studies of TikTok personalisation; (d) foundational industrial recommender-system research; (e) current Supabase documentation; and (f) Singapore's Personal Data Protection Commission guidance. Primary sources are prioritised. [1–18]

**Out of scope:** decompiling TikTok, obtaining internal telemetry, assuming ByteDance's open repository equals TikTok's production code, claiming access to ranking weights, or promising algorithmic performance before an A/B test. Recommendations in this report are a reproducible **design hypothesis** for Hungry, not a copy of protected internal machinery.

### 1.1 What can and cannot be concluded

| Question | Supported conclusion | Unknown or unsupported claim |
|:--|:--|:--|
| Does TikTok learn from passive usage? | Yes: watch/skip behaviour and other interactions influence feeds. [1–2] | Exact dwell-time threshold or coefficient |
| Does search history matter? | Yes: TikTok describes searches as signals, including for search surfaces. [2–3] | A fixed universal ranking boost for each search |
| Is the system adaptive? | TikTok documents adaptation; ByteDance documents real-time training technology. [1,5] | The exact online-update interval of today's For You feed |
| Does it explore outside a user's history? | TikTok documents diversity and exploratory recommendations. [1] | That TikTok uses a 70/20/10 split or any fixed mix |
| Does it combine content and user features? | Yes, at the level of documented feature categories. [1–2] | Its full feature set or latest model architecture |
| Can rapid adaptation cause harm? | Independent audits report interest amplification and unwanted persistence under study conditions. [7–9] | A universal time/interaction threshold for all real users |

## 2. TikTok's publicly documented learning loop

### 2.1 Input signals: interactions, content, context

TikTok lists: content a user watches in full or skips; liked, shared and commented-on posts; accounts connected through follows; content properties such as hashtags, sounds and views; and user/context factors including location, time zone, language and device settings. For Search, it states that **past search behaviour**, the query–content match and other engagement signals may affect suggested search terms and search results. For most users, interactions (including time spent) are generally weighted more strongly than other factors. [1–3]

A useful engineering abstraction is:

`displayed item + user context → observed action → updated user representation → scored candidates → new displayed items`

The loop matters because **only items actually exposed to the user can generate observable feedback**. The algorithm's own past selections alter what future behaviour is measured—an essential source of feedback-loop bias.

### 2.2 Initial feed, continual adaptation and novelty

TikTok describes a cold start that may use initial interests or general popular content, followed by learning from the person's first actions. It also describes intentionally injecting diverse topics and limiting repetitions. [1–2] This implies three separable product requirements for Hungry:

1. The first Hungry screen must be useful with **no taste history**; show diverse, contextually relevant dishes.
2. Early actions should influence recommendations quickly, but one unusual search must not dominate a permanent profile.
3. Even confident predictions require adjacent and novel choices to learn about evolving interests and prevent monotonous feeds.

### 2.3 Negative feedback and agency

TikTok has publicised the **Not Interested**, **Why this video**, **Refresh your For You feed**, and **Manage Topics** controls. [3–4] Independent evaluations indicate that unwanted-topic suppression may not always persist after the user stops actively correcting a feed. [8–9] Hungry should therefore make negatives unusually clear and durable: a user who rejects peanuts, an ingredient, or a recommended dish should not have to repeatedly reject it. Food allergies and dietary exclusions should be explicit **hard constraints**, not probabilistic preferences inferred from clicks.

### 2.4 What ByteDance's Monolith contributes to this discussion

Liu et al.'s 2022 Monolith system studies high-cardinality categorical IDs and distribution shift. It introduced an embedding-table design without hash collisions and an online-training architecture in which new behaviour is reflected in model updates, while parameter-serving constraints and fault tolerance are managed separately. Its open-source readme describes batch and real-time training/serving. [5–6]

**The lesson for Hungry is not to copy Monolith's distributed parameter servers.** It is to separate event collection, feature/profile freshness, model training and serving. At Hungry's early scale, incrementally updating simple preference aggregates is likely cheaper, more transparent and more testable than deploying large embeddings and streaming model training.

## 3. Independent research: speed of learning and its risks

Baumann et al. used controlled interest-conditioned accounts and reported strong interest amplification, often developing within the first **200 watched videos**, alongside reduced diversity as alignment intensified. The sample, scripted activity and time period matter: this is an independent audit, not a claim about every TikTok session. [7]

Kaplan et al. (2026) assessed user agency with controlled accounts and found sensitivity to explicit and implicit signals, but also difficulties removing unwelcome topics permanently. [8] Vera and Ghosh (2025) interviewed 14 present or former users and reported frustrating experiences when a single search or related engagement appeared to over-influence content; the small qualitative sample illustrates a failure mode rather than quantifying population prevalence. [9]

**Hungry design implications:**

- *Confidence gating:* multiple distinct actions across sessions outweigh one exceptional interaction.
- *Separate intent horizons:* today’s search can be strong immediately but need not become a permanent preference.
- *Negative persistence:* explicit “show less” applies beyond the current feed refresh.
- *Diversity floor:* keep useful variety, especially across cuisine, flavour and price.
- *Causal humility:* changes in click rate alone can reflect what the algorithm chose to expose.

## 4. Model the food problem correctly: intent is not taste

Hungry should not have a single “likes Chinese food” score as its sole view of a person. Food behaviour is situational and multi-dimensional.

| Latent concept | Observable signals | Primary uncertainty | Appropriate lifetime |
|:--|:--|:--|:--|
| **Immediate intent** | Submitted query, active filters, typed price cap | Could be for someone else | This search/session |
| **Short-term craving** | Repeated recent views/searches of related dishes | Temporary mood or event | Hours to days |
| **Long-term taste** | Repeat saves, repeated preference, credible reviews across days | Historical patterns can drift | Weeks to months |
| **Practical constraints** | Time, declared budget, travel range, venue availability | Context changes per meal | Per request |
| **Hard requirements** | User-declared allergy, dietary restriction, accessibility need | Must not be guessed from behaviour | Until the user changes it |
| **Social/collection intent** | Sharing lists, saving dishes for others | Not necessarily the user's palate | Separate feature channel |

### 4.1 An illustrative event sequence

A person searches `mala xiang guo`, opens three results, saves one, then searches `spicy ramen` two days later. Hungry can increase estimates of interest in spicy dishes and noodles. But if tomorrow they search `ice cream near me`, ice cream should dominate **search candidate retrieval**; prior spicy-food interest may only break ties among relevant results. A ramen fan should never see ramen ranked above exact-match chicken rice for the query `chicken rice`.

### 4.2 Localisation and food ontology

Develop a hierarchical, evidence-backed taxonomy: `dish → variants/synonyms → food type → ingredients → preparation → flavours → cuisine (if genuinely supported)`. Represent each attribute with a source and confidence. The same dish name can correspond to multiple recipes; **do not infer allergens, ingredients or spice level solely from a name**. Uncertain cuisines and flavours should be `NULL` or `unknown`, not forced labels.

Singapore-specific lexical mappings are important: `BCM ↔ bak chor mee`, `MLXG ↔ mala xiang guo`, `BKT ↔ bak kut teh`; use a curated synonym dictionary plus semantic retrieval, and disambiguate terms with multiple meanings. Merchant-supplied dish details should override scraped guesses when verified. Track each image's origin and ensure Discover uses actual dish/stall imagery rather than unrelated stock images.

## 5. Recommendation system architecture

### 5.1 The retrieval–ranking–re-ranking funnel

Industry research commonly describes candidate generation and ranking as distinct stages. Covington et al.'s YouTube system explicitly separates the broad retrieval of candidates from their finer-grained ranking; this is a useful architecture pattern, **not a claim that TikTok must use exactly YouTube's model**. [10]

```text
APP EVENTS ──> ingest/validate ──> event store ──> feature aggregates
   │                                     │                │
   └──── active search + filters ────────┴─> session intent │
                                                         v
DISH CATALOG ─> ontology + data-quality + optional embeddings
                                                         │
        HARD FILTERS: dietary declarations, location, actual availability
                                                         │
          CANDIDATE SOURCES: keyword, semantic, nearby,
               taste-based, recent, quality/novel discovery
                                                         │
        RANK: query relevance + predicted decision utility
                                                         │
        RE-RANK: diversity, repetition limits, exploration
                                                         │
            FEED + IMPRESSION LOG + EXPLANATION
                                                         │
                 outcomes return to event store <─────────┘
```

### 5.2 Candidate generation: maximise *eligible relevant coverage*

For search, build separate candidate pools:

- **Lexical retrieval:** exact dish names, phrase matches, Singaporean abbreviations, typo-tolerant matches and full-text matching.
- **Semantic retrieval:** embedding similarity for natural language such as “spicy soupy food below $10”; guard against semantic matches that violate explicit terms.
- **Local/contextual retrieval:** nearby stalls, time-of-day appropriateness, updated menus, verified availability.
- **Personalised retrieval:** dishes sharing supported attributes with past positive examples.
- **Controlled exploration:** relevant new dishes or under-exposed stalls with adequate metadata and quality.

Deduplicate by canonical dish/stall IDs, enforce constraints, log candidate sources and cap contribution from any one stall or cuisine. If there are few results, expand the search radius or explain limited matches rather than silently violating dietary restrictions or budget limits.

### 5.3 Ranking: predict meaningful value, not mere clicks

A candidate-level utility estimate may combine predicted probabilities of different outcomes:

`U(u,d,c) = a·P(saving) + b·P(opening_directions) + c·P(positive_review_later) + d·relevance − e·dissatisfaction − f·travel_cost`

This is a **Hungry proposal**. Coefficients should be selected using experiments, and delayed review labels are sparse and not necessarily attributable to the earlier recommendation. Never equate directions being opened with the meal certainly being purchased.

For an initial deterministic search score, favour query relevance; for Discover, favour taste, useful context, novelty and diversity. Avoid claiming arbitrary starting weights are statistically optimised. If using embeddings, normalise feature score ranges first; otherwise scales can unintentionally dominate.

### 5.4 Re-ranking for useful diversity

A greedy maximum-marginal-relevance-style step can discourage successive very similar dishes:

`score_next(d) = base_score(d) − λ · max(similarity(d, already_selected)) + η · under_exposed_quality_bonus(d)`

Apply business rules: do not show four versions of the same stall's menu in the first five tiles; do not bury exact search matches solely to improve diversity; diversify cuisine/food type/price where appropriate, while preserving available and suitable items. A small, logged exploratory allocation can reveal previously hidden preferences. Any fixed exploration percentage in a prototype is experimental and not a known TikTok parameter.

### 5.5 Freshness is different from newness

Ranker freshness refers to the model using recent events. Catalog freshness refers to current menu prices, merchant status, dish availability and images. Hungry needs both. Stale prices and incorrect opening hours destroy trust even when the learned tastes are excellent.

## 6. Event instrumentation: the foundation of learning

### 6.1 Record events with semantics, not just clicks

| Event | Candidate information | Strength of taste evidence | Caveat |
|:--|:--|:--|:--|
| `search_submitted` | Current query and interpreted intent | Low for long-term taste; high for this search | Query may be for another person |
| `result_impression` | Exposure, visible rank/position, source policy | No direct positive preference | Necessary denominator for evaluation |
| `dish_opened` | Dish characteristics | Low-to-medium | Might be accidental or comparison shopping |
| `meaningful_detail_view` | Sustained, foreground-visible exploration | Medium only after validated threshold | Text length, UX, loading affect dwell |
| `dish_saved` | Bookmark / wish-list | Medium-to-high intent | Save ≠ tried, may be for a friend |
| `directions_opened` | Strong real-world consideration | Medium-to-high intent | Directions ≠ visit; user may abandon |
| `dish_shared` | Social relevance | Moderate, context-dependent | Not necessarily personal preference |
| `review_submitted` | Stated post-meal experience | High only when credibility and sentiment are meaningful | Reviews may be sparse, biased or fraudulent |
| `not_interested` | Explicit negative evidence | Strong negative for the rejected item/tag | Avoid over-generalising to entire cuisine |
| `user_taste_override` | Direct preference control | High authority | Keep distinct from inferred interests |

**Implementation principle:** log searches only when submitted, not on every keystroke. Log an impression only if the tile actually appeared within the viewport for a meaningful interval. Preserve *request ID, position, source ranker, query/context and experiment variant*. Without logged non-clicked impressions, ranking models learn from an incomplete picture of what could have been chosen.

### 6.2 Recommended event record

```json
{
  "event_id": "uuid-per-event",
  "user_id": "authenticated-user-id-or-null",
  "anonymous_session_id": "rotating-pseudonymous-id",
  "session_id": "uuid",
  "request_id": "recommendation-request-id",
  "event_type": "dish_saved",
  "dish_id": "canonical-dish-id",
  "search_query": null,
  "surface": "discover",
  "rank_position": 3,
  "policy_version": "ranker_v1.2",
  "experiment_variant": "treatment",
  "event_time_client": "untrusted-client-timestamp",
  "event_time_server": "server-generated-timestamp",
  "metadata_version": "taxonomy_2026_10",
  "consent_or_settings_version": "preference-settings-version"
}
```

The example is a contract sketch, not a proposed exposure of all these values to clients. `rank_position` is meaningful primarily for impressions and clicked results linked to a shown request. **Never trust** a client-provided price, verified purchase, user role, benefit amount or review status. Avoid storing raw GPS traces; coarse area or purpose-limited proximity calculations are often sufficient. Sensitive free-text searches may require stricter data handling.

### 6.3 Identity, duplication and attribution

Use stable authenticated IDs when possible; temporary anonymous sessions can personalise a single session without requiring sign-up. Merge anonymous history into an account only under an explicit, defensible design. Each event needs an idempotency ID and a bounded deduplication policy; retries must not multiply “saves.” Cap repeated events per user/dish/session and distinguish genuine repeat interest across separate days from accidental rapid tapping.

Attribution windows differ: a save may follow an impression within minutes, while a restaurant visit or review may happen days later. Store the originating `request_id`/`impression_id` when defensible, and preserve uncertain outcomes as **unknown**, not failures.

## 7. From signals to a stable taste profile

### 7.1 A feature-based rather than dish-ID-only representation

Define a dish feature vector containing supported attributes such as:

`x_d = [food_type, cuisine, ingredients, flavours, preparation, spice_level_known, price_band, neighbourhood, semantic_embedding]`

The representation must support multiple values and missingness; e.g. a dish can be both rice-based and soup-based, while cuisine may be legitimately unknown. Tag provenance, confidence and merchant verification status are data features in their own right. Do **not** infer food safety or dietary compliance from semantic similarity.

Define three distinct user representations:

- **Long-term profile** `L_u`: time-decayed affinity to confirmed dish attributes.
- **Session profile** `S_{u,t}`: recent searches, views and filters; short half-life and fast updates.
- **Explicit preference/constraint store** `C_u`: the user's direct choices and exclusions; not allowed to be overridden by inferred probabilities.

### 7.2 An interpretable decay-and-shrinkage baseline

For user `u` and supported food tag `k`, define the signed evidence:

`E_(u,k) = Σ_i [ w(action_i) × c(i,k) × 2^(-age_days(i)/h_k) ]`

where `c(i,k)` is metadata-match confidence, `h_k` is a chosen half-life (e.g., a shorter value for a fleeting craving, longer for broad cuisine), and `w` is a signed, *proposed* action weight. Normalise and shrink sparse evidence:

`A_(u,k) = E_(u,k) / [κ + Σ_i |w(action_i) × c(i,k) × 2^(-age_days(i)/h_k)|]`

This puts `A` approximately in `[-1, +1]` if confidence is in `[0,1]` and introduces conservative shrinkage through `κ > 0`. Track evidence count **and number of distinct sessions/days**, and suppress “strong preference” labels before a minimum evidence threshold. Bayesian or empirical-Bayes alternatives are useful once data exists.

Proposed action weights for an initial instrumented pilot—not scientific facts or TikTok's weights—might start as `search +0.5`, `open +1`, `meaningful view +1`, `save +3`, `directions +3`, `credible positive review +4`, `not interested −4`. This is a *test configuration*, not a deployment recommendation without validation. The same action can have **separate weights for intent and taste**: searching is strong session intent but weak persistent palate evidence.

### 7.3 Worked example: one unusual search should not rewrite the user

Suppose a user viewed and saved spicy-noodle dishes over four separate weeks. They then search “vegan cake” once for a colleague. The new search should cause immediate vegan-cake retrieval for that session; it should **not** erase the long-term spicy-noodle evidence. Repeated subsequent cake saves across weeks would gradually build evidence of a broader dessert interest.

A negative event is similarly scoped: rejecting one chicken-rice stall may mean “that photo, that price, that distance,” not “I dislike chicken rice.” Let the user choose whether feedback applies to that *dish*, *stall* or *dish category* when such distinction matters.

### 7.4 Prevent self-reinforcing mistakes

Signals observed after recommendation are *policy-dependent*. If Hungry over-recommends ramen, it may generate many ramen clicks even from users who prefer other meals. Defences include exposure logging; normalising by what was actually shown; a modest exploratory pool; training only on meaningful, context-aware outcomes; and careful off-policy evaluation where propensities are known. Bias-correction literature warns that clicks are missing-not-at-random and depend on position/examination, so naive click counts are not a reliable pure preference measure. [15,18]

## 8. Algorithms at three maturity levels

### Level 1 — Interpretable baseline (recommended first)

**Inputs:** ontology-backed dish attributes, session query, current filters, user affinity aggregates, distance, budget, stall availability and basic quality signals.

**Serving:** keyword / curated synonym retrieval → eligible candidates → transparent weighted utility score → MMR-style re-rank.

**Learning:** after validated events, update the cached profile incrementally or via short periodic micro-batches. This delivers visibly adaptive personalisation without training a deep neural network.

**Advantages:** low operational cost, easier explanation and debugging, small-data resilience. **Limitations:** manually designed interactions among tags; weaker recognition of subtle co-preference patterns. This level is sufficient to test the fundamental product proposition.

### Level 2 — Learned ranking and embeddings

When Hungry has enough reliable request/impression/outcome history, train a supervised ranker such as gradient-boosted trees on `user × dish × context` features. Useful features include query lexical score, semantic cosine similarity, last-7-day tag affinity, 90-day affinity, previous dish interactions, distance, price-vs-budget, availability confidence, item/stall quality, novelty, session intent and missing-data indicators.

For search, consider hybrid full-text + semantic retrieval. Supabase documents both semantic search (vector embeddings) and hybrid search that combines keyword and meaning. Its automatic-embeddings guidance notes the need to keep vectors in sync with changing content. [11,13]

Train on **temporally separated** data, avoid using future features, and hold out entire user sessions. A model that appears accurate because it learns from data recorded after the decision is invalid. Calibrate probability estimates and compare against the Level 1 rule-based baseline.

### Level 3 — Sequence modelling, collaborative filtering and bandits

**Sequential models** capture a user's changing trajectory rather than just averaged history; SASRec is a well-known self-attention example in the recommender literature. [14] **Collaborative filtering** can surface relationships that the taxonomy misses—e.g. users who appreciate one type of dish disproportionately save another—even if the cuisines are different. Both require sufficiently representative data and careful safeguards against popularity bias.

**Contextual bandits** can choose between safe exploratory alternatives while trading off observed utility and information gain. Their outputs require logged propensities and appropriate evaluation; deterministic production logs without meaningful action support do not permit unbiased off-policy estimates for unshown items. Doubly-robust estimators may improve efficiency when assumptions and logged policies are adequate. [17]

**Do not start at Level 3.** Deep models can amplify noisy signals and obscure bad metadata. Progress based on measured lift, catalog size, traffic volume, data quality, reliability and team capacity—not because another app is assumed to use a neural network.

### 8.1 Example search versus discovery objective

For **Search**: `rank = 0.65 query relevance + 0.15 session intent + 0.10 long-term taste + 0.05 proximity + 0.05 novelty`.

For **Discover**: `rank = 0.35 long-term taste + 0.20 session intent + 0.15 budget + 0.15 proximity + 0.10 novelty + 0.05 social relevance`.

These are **illustrative initial hypotheses only**; their numbers are not sourced from TikTok and are not validated against Hungry traffic. All components must first be normalised to comparable scales, and safety/eligibility filters must operate **before** scoring. Even a `0.65` query boost cannot repair a retrieval pool that includes irrelevant dishes.

### 8.2 A utility-aware learning objective

A future ranker can learn multiple heads (save, direction-open, negative feedback, eventual satisfaction) rather than reducing all behaviours to one click. Multi-task learning can help where labels overlap but is not guaranteed to improve accuracy. Set decision-relevant utility weights transparently; avoid rewarding mere session length. For new stalls, use calibrated exploration instead of assuming low historical engagement implies low quality.

## 9. Database and service design with Supabase

### 9.1 Minimum schema, mapped to existing Hungry tables

The table names are **proposed**. Before implementation, inspect Hungry's live schema, indexes, existing auth/RLS policies, merchant menu tables, post/review tables, image storage and available status fields. Do not create duplicate dish/user/stall tables.

| Entity | Core fields | Update path | Exposure/access |
|:--|:--|:--|:--|
| `rec_events` | event ID, user/session, type, dish/query, request, time | Validated event ingestion | Owner-only read where exposed; rate-limited writes |
| `rec_impressions` | request/item/rank, visible time, policy, propensity | Server-generated recommendation + confirmed visibility | Private analytics; limited owner access |
| `dish_features` | canonical dish ID, taxonomy tags, provenance/confidence, last verified | Merchant-approved / vetted metadata pipeline | Published fields readable; edit only authorised |
| `rec_user_affinities` | user, tag, score, support, evidence dates, version | Server-only aggregation | User may view/export/reset own profile |
| `rec_session_intent` | session, ephemeral interests/filters, expiry | Short-lived server/client cache | Session-scoped |
| `rec_feedback` | reject item/stall/tag, override, reason, time | Authenticated user control | Owner only |
| `rec_requests` | request ID, sources, ranking version, timings, experiment | Server recommendation service | Private observability |
| `rec_experiment_assignments` | stable user, experiment, variant | Server allocation | Private; no client manipulation |

### 9.2 Illustrative SQL pattern (adapt—not an executable migration)

```sql
-- Example only. Inspect existing dish ID types and RLS first.
create table public.rec_user_affinities (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_type text not null,
  feature_key text not null,
  affinity_score double precision not null
    check (affinity_score between -1 and 1),
  evidence_count integer not null default 0,
  distinct_session_count integer not null default 0,
  feature_version text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, feature_type, feature_key)
);

alter table public.rec_user_affinities enable row level security;

-- Use Data API grants only after reviewing project settings.
revoke all on public.rec_user_affinities from anon, authenticated;
grant select, delete on public.rec_user_affinities to authenticated;

create policy "Read own taste profile"
  on public.rec_user_affinities for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Delete own taste profile"
  on public.rec_user_affinities for delete to authenticated
  using ((select auth.uid()) = user_id);

-- No client INSERT or UPDATE policies:
-- write profile aggregates via a validated privileged backend.
```

For sensitive user data, use RLS and least-privilege grants, and do not put service-role credentials in a browser or mobile client. Supabase notes that RLS policies restrict individual rows; API exposure and grants are distinct concerns. [12] Deletion should also cascade/rebuild any derived embeddings, cached profiles and analytic datasets where required by the actual retention policy.

### 9.3 Event-to-profile processing

```python
# Pseudocode. Schema references and error handling are illustrative.
def process_event(event):
    assert authenticated_or_valid_anonymous_session(event)
    assert event_schema_valid(event)
    if already_processed(event.event_id):
        return  # idempotent

    verified = validate_against_server_catalog(event)
    save_event_once(verified)

    if verified.event_type in {
        "search_submitted", "dish_opened", "dish_saved",
        "directions_opened", "not_interested"
    }:
        evidence = translate_into_scoped_evidence(verified)
        update_short_term_session_state(evidence)
        if meets_long_term_evidence_rules(evidence):
            update_decayed_affinities(evidence)
        invalidate_user_recommendation_cache(verified.user_id)
```

A `search_submitted` event should update **session intent immediately**; a long-term profile update can require repeated or corroborating actions. Track a profile algorithm version so historical scores can be reproduced and rebuilt when weights or taxonomy change.

### 9.4 Latency, scale and operational boundaries

Initial design goals (illustrative, not measured): respond to queries with a P95 server-side ranking latency under a few hundred milliseconds, make recent high-trust actions visible in the next session or sooner, and keep a fallback deterministic feed if ranking fails. Validate actual device/network conditions in Singapore and near the user's selected area. Use indexes on `(user_id, occurred_at)`, canonical dish IDs, active-stall/menu filters and vector indexes only where retrieval tests justify them.

Avoid triggering an expensive full-user-profile recompute on every scroll. Use incremental event aggregates and periodic refreshes; separate urgent updates (explicit negatives/constraints and new search intent) from slower model retraining. Investigate queues/cron only if events and retraining load make them necessary.

## 10. Evaluation design: prove you give users what they want

### 10.1 North-star outcome and supporting metrics

**Weekly Meaningful Food Decisions (WMFD):** the weekly number of unique users who perform a defensible intent-to-decision action attributable to Hungry, such as explicitly selecting a dish to try or using directions after consulting dish details. This is a proposed proxy—not confirmation of a purchase or meal—so pair it with optional post-experience satisfaction data rather than overclaiming.

| Category | Metric | Definition / warning |
|:--|:--|:--|
| Outcome | `weekly_decision_users` | Distinct users with meaningful choice events |
| Outcome | `decision_rate` | Eligible recommendation sessions resulting in a choice |
| Speed | Time-to-first-relevant-dish | From query/feed start to useful dish interaction; not raw dwell |
| Search | Query success@K | Did an eligible query lead to a relevant result/choice? |
| Recommendation | Save rate per valid impression | Denominator must include actually displayed items |
| Quality | NDCG@K / Recall@K | Offline held-out relevance, with biased-label caveats |
| Calibration | Brier/log loss | Compare predicted probabilities to observed outcomes |
| Exploration | Item/stall coverage; intra-list diversity | Prevent concentration on top merchants/dishes |
| Fairness | Exposure by eligible stall cohort | Investigate unexplained systematic invisibility |
| Experience | Not-interested rate, hide/block rate | Early warning of irrelevant content |
| Retention | D7/D28 cohort retention | Measure new-user cohorts consistently |
| Trust | Stale price / closed-stall recommendation rate | Catalog correctness matters more than clicks |
| Performance | P50/P95 rank/search latency, error rate | Guard against slower personalised search |
| Privacy | Profile reset success, opt-out rate | Confirm agency works, not merely that settings exist |

### 10.2 Offline testing: avoid data leakage and selection bias

Use chronological splits: train on older event history, validate on later sessions, and test on a subsequent untouched period. Freeze item features at their historical valid time; do not use current prices or future reviews when evaluating a past ranking. Examine cold users, new dishes, low-data stalls and neighbourhoods separately. Retain session-level and user-level grouping so leakage does not inflate results.

A larger AUC or NDCG does not guarantee better live food decisions. Logged impressions are generated by an earlier policy and suffer selection bias; classical counterfactual learning-to-rank methods use exposure propensity corrections, under appropriate assumptions. [15] If historical serving was deterministic, it may be impossible to estimate how unshown alternatives would have performed without controlled exploration.

### 10.3 Online A/B test: proposed study design

**Hypothesis:** a privacy-respecting learned-taste ranker increases meaningful dish decisions compared with today's baseline without decreasing trust, diversity or speed.

- **Unit:** stable user (not per event or per screen), so treatment doesn't switch within a session.
- **Control:** current Hungry discovery/ranking pipeline, with the same eligibility and metadata fixes where possible.
- **Treatment:** baseline pipeline + learned user/session affinity + diversified re-ranking.
- **Primary metric:** decision rate per eligible discovery session, with a pre-declared observation window.
- **Guardrails:** misclassified dietary/availability results, search exact-match accuracy, user complaints, latency, hide rate, excessive notification effects and merchant coverage.
- **Analysis:** include confidence intervals, allocation sanity checks, A/A test, sample-ratio mismatch checks and heterogeneity across new/returning users and high/low-history cohorts.

Run a power analysis from actual baseline rates before choosing duration or sample size. Do not advertise 5%, 10% or any other lift before measurement. A novelty-induced short-term click increase can be misleading; watch longer-term cohorts.

### 10.4 What is and is not a negative label

- A direct `not_interested` choice is useful negative evidence.
- An impression followed by a fast scroll is ambiguous: the user may not have noticed the card.
- No click is **missing feedback**, not definitive dislike.
- A negative review is dish-specific and context-dependent; it should not ban an entire cuisine.
- Search abandonment could mean bad results, a phone interruption or a solved decision outside the app.

This labelling discipline is likely more important to early Hungry recommendation quality than replacing a linear model with deep learning.

## 11. Failure modes, safety and governance

| Failure mode | Example | Recommended control |
|:--|:--|:--|
| Single-search overfitting | One dessert lookup makes feed mostly desserts | Search/session intent separated from long-term affinity |
| Filter bubble | Repeated noodle recommendations crowd out variety | Diversity objective, discovery quota, topic coverage monitoring |
| Popularity feedback loop | Famous stalls get all impressions and then all saves | Exposure logging, newcomer coverage, counterfactual review |
| Mislabelled cuisine | Generic dish wrongly tagged Korean | Tag provenance, confidence, blank unknown, merchant verification |
| Unsafe inference | Inferring allergy or religious dietary status from browsing | Explicit opt-in hard constraints; no sensitive inference |
| Stale menu | Dish shown but stall closed / price wrong | Merchant updates, last-verified timestamps, freshness rules |
| Fraudulent actions | Scripted saves manipulate rankings | Server validation, rate limits, bot/abuse heuristics |
| Data leakage | Users see another user's taste profile | Authenticated RLS, least privilege, test access policies |
| Model staleness | User switches interests but feed doesn't adapt | Separate session updates and cached-profile invalidation |
| Negative control ignored | Rejected dish reappears tomorrow | Durable user-level suppression and regression tests |
| Slow ranking | Search results take seconds to load | Indexes, staged retrieval, fallback, performance budgets |
| Proxy engagement optimisation | More scrolling, fewer meal decisions | Decision-based reward; time-to-decision guardrail |

### 11.1 Singapore privacy and data minimisation

Singapore's PDPC issued **Advisory Guidelines on the Use of Personal Data in AI Recommendation and Decision Systems** on 1 March 2024. They discuss personal-data use in AI development and deployment, notification/consent obligations and accountability; the precise lawful basis depends on the data, use and circumstances. [16] This report is a technical proposal, **not legal advice**.

Recommended operational requirements:

1. Explain at collection and in settings that Hungry uses searches and interactions to infer food interests.
2. Collect only signals needed for food discovery; avoid collecting unrelated browsing or cross-app activity.
3. Let users inspect an understandable interest summary, request correction, reset learned preferences and access available deletion/export options.
4. Keep sensitive exclusions user-controlled; never invent or auto-apply allergy, religion or health statuses.
5. Set explicit retention periods; rotate/delete raw events appropriately and rebuild/delete derived profiles.
6. Secure events and profiles; restrict staff and merchant access to individual-level personal data.
7. Assess any third-party AI/embedding providers and cross-border processing against the applicable requirements.
8. Keep children/teens, if in scope, under appropriately stronger safeguards.

### 11.2 Explainability without misleading certainty

Good explanation: “Shown because you have recently saved noodle dishes, and this stall is near your selected area.” Bad explanation: “We know your favourite food is spicy noodles.” Explanations should refer to real logged signals and distinguish *current query* from *inferred long-term interest*.

## 12. Proposed twelve-week execution roadmap

| Weeks | Workstream | Deliverables | Go/no-go test |
|:--|:--|:--|:--|
| 1–2 | Catalog audit and ontology | Dish–stall canonical IDs; reliable food types; cuisine confidence and provenance; search synonym map | Manual QA sample accuracy and coverage documented |
| 2–3 | Instrumentation | Events, valid impressions, search/request IDs, idempotency, RLS/privacy inventory | End-to-end traces and no duplicate event inflation |
| 3–4 | Cold-start/search baseline | Keyword retrieval, strict constraints, curated local/popular results | Relevant search cases pass; no unsafe filter leaks |
| 4–6 | Long-term and session profiling | Weighted/decayed affinities; consent controls; reset; per-action logging | Synthetic persona tests A–E pass |
| 6–7 | Personalised Discover v1 | Candidate union, ranker, de-duplication and variety | Offline quality and latency better than baseline thresholds |
| 7–8 | Search personalisation | Intent-dominant ranking; explainable tie-breaks | Exact dish matches remain prioritised |
| 8–10 | Experimentation | Stable assignments, evaluation dashboards, A/A then A/B test | No sample-ratio mismatch; guardrails clear |
| 10–12 | Iteration and semantic pilot | Refined weights, taxonomy correction, optional hybrid retrieval pilot | Improvement on decision outcomes with safe latency |

Timings are planning estimates; adjust after examining Hungry's existing Supabase schema, front-end flows, user base, data volume and team staffing.

## 13. Acceptance criteria and test cases

| Case | Scenario | Expected result |
|:--|:--|:--|
| A | Repeatedly saves spicy noodles across multiple weeks | Increases long-term spicy/noodle affinity |
| B | Ramen fan searches for `chicken rice` | Chicken rice dominates returned search candidates |
| C | New/anonymous user has zero history | Useful diverse results without mandatory questionnaire |
| D | User explores Thai dishes for a month after Japanese focus | Affinity shifts gradually; older preference not instantly deleted |
| E | User searches for a dish they dislike, once | Session results relevant; no permanent strong taste label |
| F | User rejects a specific stall | That stall suppressed consistently; whole cuisine not necessarily banned |
| G | User declares an allergy | Constraint enforced before ranking; uncertainty handled conservatively |
| H | Dish metadata lacks reliable cuisine | Cuisine remains unknown; no forced cuisine boost |
| I | App retries a save event five times | Exactly one event and one preference update |
| J | User requests profile reset | Profile, relevant caches and derived serving state reset consistently |
| K | Merchant changes price or sold-out status | New recommendations reflect published state; no stale price claims |
| L | One popular stall dominates past activity | Diversified eligible feed includes other qualified stalls |
| M | Ranking service is unavailable | Deterministic safe fallback; no leak of other users' data |
| N | User searches with strong query constraints | Personalisation cannot override explicit query or dietary filters |

## 14. Decision framework: what to build now versus later

**Build now:** canonical dish metadata with provenance; Singapore-aware search; properly logged searches, impressions, opens and saves; separate session and long-term signals; interpretable time-decayed affinity; strict constraints; diverse rankings; basic explanation, opt-out and reset; and a decision-focused experiment dashboard.

**Defer until justified:** a large deep learning stack; Monolith-style distributed online training; complex multi-tower or sequential transformers; heavy AI agent orchestration; unverified geofencing or passive location tracking; merchant paid-boosting inside supposedly organic search; a global XP/gameification economy; and bandit optimisation without propensity logs and reliable utility labels.

### Critical product distinction

**TikTok's objective is often described in terms of predicted content interest and engagement; Hungry should explicitly optimise for *decision quality and trust*.** More screen time can be evidence that the user is stuck choosing. Fewer screens and a better meal choice may be the superior product outcome.

## 15. Research questions requiring Hungry's own data

1. Which in-app behaviour best predicts a satisfying eventual food choice: search, save, directions, review or another event?
2. How much of a user's palate is stable compared with time-of-day cravings?
3. Does lexical + semantic search outperform lexical search on Singapore food terms, and under what ambiguity constraints?
4. Do confidence-calibrated cuisine/flavour tags outperform fully automatic forced tagging?
5. What diversity level helps discover new dishes without reducing query satisfaction?
6. How should the app handle lists saved for friends, shared household meals and mixed-intent searches?
7. How quickly must profile updates propagate before users notice a benefit?
8. Can under-exposed but high-quality stalls be surfaced without lowering relevance?
9. Which user segments gain the most from personalised ranking, and which need a stronger cold-start experience?
10. What privacy controls are understandable and used, and how reliably can preferences be reset?

These are hypotheses for future experiments, not answered by TikTok disclosures or the cited papers.

## Appendix A — Proposed configurable feature weights

| Signal | Session-intent starting weight | Persistent-taste starting weight | Notes |
|:--|--:|--:|:--|
| Search submitted | +4 | +0.5 | High current intent; weak long-term evidence |
| Dish opened | +1 | +1 | Only if a meaningful impression preceded it |
| Meaningful detail view | +1 | +1 | Threshold validated against device/UX |
| Save dish | +3 | +3 | Consideration signal, not confirmed tasting |
| Open directions | +3 | +3 | Intent signal, not proven purchase |
| Credible positive review | +1 | +4 | Verify context and review quality |
| Not interested (dish) | −5 | −4 to dish only | Scope negatives carefully |
| Explicit preference override | As specified | User-controlled authority | Never infer a hard dietary rule |

All numeric values in this appendix are **proposed configuration knobs**, for controlled experimentation only. They are not empirical estimates of actual TikTok behaviour.

## Appendix B — Suggested experiment event contract

```typescript
// Pseudotype; align with Hungry's current schemas and auth.
type RecommendationEvent = {
  eventId: string;              // UUID, idempotency key
  sessionId: string;
  requestId?: string;           // join to rendered recommendation set
  dishId?: string;              // canonical catalogue identifier
  type: "search_submitted" | "result_impression" |
        "dish_opened" | "dish_saved" | "directions_opened" |
        "not_interested" | "review_submitted";
  surface: "search" | "discover" | "dish_detail";
  searchQuery?: string;         // submitted query only; minimise retention
  visiblePosition?: number;     // actual visible rank, not merely returned
  clientTime: string;           // untrusted; server time is authoritative
  recommendationPolicy?: string;
};
```

## Appendix C — Source notes and reference bibliography

The references separate first-party descriptions from independent research. TikTok's internal weights and model source are not claimed to be known. Access checked in October 2026; check links again before a production architecture decision.

1. **TikTok Newsroom (2020).** *How TikTok recommends videos #ForYou*. First-party evidence for user interactions, content properties, cold start and feed diversity. https://newsroom.tiktok.com/how-tiktok-recommends-videos-foryou?lang=en-AU
2. **TikTok Support (accessed 2026).** *How TikTok recommends content*. First-party summary of feed and search signals, importance of interaction factors, and content/personalisation controls. https://support.tiktok.com/en/using-tiktok/exploring-videos/how-tiktok-recommends-content
3. **TikTok Newsroom (2022).** *Learn why a video is recommended For You*. First-party evidence for search and interaction signals and explanations. https://newsroom.tiktok.com/why-this-tiktok?lang=en-GB
4. **TikTok Newsroom (2025).** *More ways to discover new content and creators you love*. Public information about Manage Topics, filtering and user control. https://newsroom.tiktok.com/more-ways-to-discover-new-content-and-creators-you-love-sg?lang=en-SG
5. **Liu, Z., et al. (2022).** *Monolith: Real Time Recommendation System With Collisionless Embedding Table*. ORSUM@ACM RecSys 2022 / arXiv:2209.07663. Evidence of ByteDance recommender-system engineering, **not verified live TikTok architecture**. https://arxiv.org/abs/2209.07663
6. **ByteDance (public repository; accessed 2026).** *bytedance/monolith*. Open framework and documentation for sparse-embedding and real-time recommender models. https://github.com/bytedance/monolith
7. **Baumann, F., Arora, N., Rahwan, I., & Czaplicka, A. (2025 preprint; 2026 journal).** *Dynamics of algorithmic content amplification on TikTok*. Controlled sock-puppet audit showing rapid amplification and diversity trade-offs; limited external validity. https://doi.org/10.1140/epjds/s13688-026-00629-2
8. **Kaplan, L., Patel, D., Gerzon, N., Mislove, A., & Sapieżyński, P. (2026).** *When “For You” Isn't For You: Measuring User Agency in TikTok's Algorithmic Feed*. Controlled independent audit of feed responsiveness and user control. https://arxiv.org/abs/2605.10690
9. **Vera, J. A., & Ghosh, S. (2025).** *“They've Over-Emphasized That One Search”: Controlling Unwanted Content on TikTok's For You Page*. Qualitative interview study (n=14), useful for identifying failures, not estimating prevalence. https://arxiv.org/abs/2504.13895
10. **Covington, P., Adams, J., & Sargin, E. (2016).** *Deep Neural Networks for YouTube Recommendations*. ACM RecSys 2016. Foundational retrieval-and-ranking architecture example. https://research.google/pubs/deep-neural-networks-for-youtube-recommendations/
11. **Supabase (accessed 2026).** *Hybrid search*. Practical keyword + vector retrieval documentation. https://supabase.com/docs/guides/ai/hybrid-search
12. **Supabase (accessed 2026).** *Row Level Security*. Guidance for private user-scoped data and access policies. https://supabase.com/docs/guides/database/postgres/row-level-security
13. **Supabase (accessed 2026).** *Semantic search* and *Automatic embeddings*. Vector concepts and keeping embeddings current. https://supabase.com/docs/guides/ai/semantic-search ; https://supabase.com/docs/guides/ai/automatic-embeddings
14. **Kang, W.-C., & McAuley, J. (2018).** *Self-Attentive Sequential Recommendation*. SASRec; foundational sequential-interest modelling. https://arxiv.org/abs/1808.09781
15. **Joachims, T., Swaminathan, A., & Schnabel, T. (2017).** *Unbiased Learning-to-Rank with Biased Feedback*. WSDM. Position/exposure-bias methodology and assumptions. https://www.cs.cornell.edu/people/tj/publications/joachims_etal_17a.pdf
16. **Singapore Personal Data Protection Commission (2024).** *Advisory Guidelines on Use of Personal Data in AI Recommendation and Decision Systems*. Official Singapore data-protection guidance. https://www.pdpc.gov.sg/organisations/regulations-decisions/regulatory-guidance/advisory-guidelines-on-use-of-personal-data-in-ai-recommendation-and-decision-systems
17. **Dudík, M., Langford, J., & Li, L. (2014/2015).** *Doubly Robust Policy Evaluation and Learning*. Foundations for cautious off-policy evaluation. https://arxiv.org/abs/1503.02834
18. **Zhang, Y., et al. (2021).** *Causal Intervention for Leveraging Popularity Bias in Recommendation*. SIGIR 2021. Research on popularity bias and recommender feedback. https://arxiv.org/abs/2105.06067

---

**Document provenance:** prepared for Hungry product/engineering planning from publicly accessible sources. Claims explicitly identified as Hungry proposals, example scores, architecture sketches or pseudocode must be validated against Hungry's actual product, Supabase configuration and user behaviour before deployment.
