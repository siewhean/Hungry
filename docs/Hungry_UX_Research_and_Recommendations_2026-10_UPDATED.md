---
title: "HUNGRY"
subtitle: "UI/UX Benchmark Research, Product Design Audit & Page-by-Page Improvement Blueprint"
author: "Independent research and source-code-informed assessment"
date: "22 October 2026"
lang: en-SG
mainfont: "Lato"
fontsize: 10pt
geometry:
  - margin=0.85in
colorlinks: true
linkcolor: "black"
urlcolor: "blue"
header-includes:
  - \usepackage{fancyhdr}
  - \pagestyle{fancy}
  - \fancyhead[L]{HUNGRY / UX RESEARCH}
  - \fancyhead[R]{OCT 2026}
  - \fancyfoot[C]{\thepage}
  - \setlength{\headheight}{14pt}
---

> **Decision statement.** Hungry should optimize for **"I know what I want to eat" → "I found a trustworthy, practical option" in under three minutes**. The social layer should strengthen dish discovery rather than replace it. The first redesign priority is not a new color scheme; it is to shorten the path from craving to dish, stall and directions. **Every screen must establish one obvious primary next action, avoid equally weighted competing CTAs, and reveal only relevant choices (Hick's Law; §17).**

**Assessment type:** Comparative design research + static repository / documentation review, supplemented on 22 October by a visual heuristic review of 20 provided Hungry iOS screenshots. **Not:** a live, instrumented app audit or a claim that all referenced screens were manually tested on iOS and Android. Some repository documents are historical and are identified accordingly. **Evidence snapshot:** GitHub `siewhean/Hungry`, `main` tree `4aea4b2c9a491b292e423fcac10cc7d632f4a430` inspected 20 October 2026. Public competitor principles checked against official product documentation and UX research (sources in §16). Recommendations are hypotheses to validate with users. **Revision 22 October 2026:** adds Hick's Law, five enforceable primary-action rules, a screen-by-screen application matrix and release checks (§17).

\newpage

# 1. Executive summary

## 1.1 Positioning and why design matters

Hungry is a Singapore-centric, **dish-first** food discovery product: users seek *laksa*, *nasi lemak*, *chicken rice* or "something spicy below S$8 nearby," then choose the stall and how to get there. The repository already contains thoughtful features: personalized taste vectors (sweet, spicy, sour, salty, rich, aromatic), rich discovery and result surfaces, map, dish/stall detail, review composer, post composer, collections/portfolios, and merchant tools. That breadth now creates a risk: a user with a simple food decision can feel the product is a social platform, merchant network, game and directory at the same time.

**Recommendation:** make the *dish decision loop* the organizing principle. Every prominent element should answer at least one of four questions: *What should I eat? Where can I get it? Can I trust this information? What do I do next?* Everything else is secondary.

## 1.2 Summary of highest-impact decisions

| Decision | Current evidence | Recommended direction | Priority |
|---|---|---|---|
| Home's job | The current root `Home` tab wraps `HomeFeedScreen` in `mode="social"` | Test a personalized **dish-first Home** with social proof integrated into dish cards, not a long general social feed | P0 |
| Choice clarity / Hick's Law | Provided screenshots show competing large CTAs, dense profile functions, and tasks with too many immediate options | Define one primary action per screen/state; reduce competing choices through clear hierarchy and contextual reveal (§17) | P0 |
| Navigation | Four navigation tabs **Home, Discover, Review, Profile**, with a central **Create** action in the bar | Explore **Home / Explore / Saved / Profile**; move Review/Create to contextual actions, not a pseudo-tab | P0 test |
| Search | Search, results, filters and browse modes already exist | One visible search affordance; persistent chips; natural-language and synonym matching; preserve query/filter/back position | P0 |
| Card comprehension | Several complex discovery/content screens, distinct dish/stall cards | Food photo + dish + stall + price + distance + status as consistent hierarchy; differentiate types without unrelated layouts | P0 |
| Availability and trust | Data quality and merchant availability are complex; past branch review warned against hardcoded values | Data-provenance rules; explicit unknowns; timestamps for mutable content; no fabricated review count/hygiene/verification | P0 |
| Speed and feedback | Historical performance plan reports delayed filter/tab responses; current code adds preloading and skeletons | Measure on devices; immediate pressed/selected state, navigate-first, skeletons, p95 guardrails | P0 |
| Taste learning | An implicit collector exists but `IMPLICIT_LEARNING_ENABLED=false` | Start with transparent, low-risk, opt-in signals and explicit "Not interested" controls; calibrate taste-match UI | P1 |
| Merchant tools | Substantial screens exist but are currently production gated | Make the merchant workflow excellent in staging; keep it separate from consumer architecture until rollout QA | P2 / launch gate |

The table is a **prioritization proposal**, not an empirically measured grade of the running application.

## 1.3 What success looks like

**North-star outcome:** meaningful food-decision completion (a user opens a dish and takes an actionable next step: directions, call, delivery deep link, save for a near-term meal or verified stall visit). Avoid optimizing engagement minutes alone: an app that fulfills the goal in 45 seconds can be better than one that keeps someone scrolling for 15 minutes.

**Six core indicators:** first useful dish exposure time; search-to-detail conversion; detail-to-practical-action rate; saved-dish revisit rate; task completion for dietary/budget/area constraints; p95 tap feedback and route transition time. Add trust and safety guardrails: incorrect availability complaints, falsely labeled dietary items, broken directions, misinformation reports and screen-reader task failures.

# 2. Research scope and evidence quality

## 2.1 Sources and limits

**Primary evidence:** current repository files for navigation, feature flags, core screens and components, code-level performance notes, design tokens and prior QA checklists. **Secondary evidence:** Nielsen Norman Group, Baymard's August 2026 8-app food-delivery benchmark, Apple/Android guidance, Google Maps and TikTok/Spotify/Airbnb product disclosures, and Duolingo product writing [1–15]. **Synthesis:** proposed adaptations specifically for Singaporean mobile food discovery.

Baymard's August 13, 2026 report manually assesses 8 delivery/takeout apps/sites across 390+ UX parameters and calls out weak repeat-journey support, dietary filtering and navigation/return paths [2]. These are strong **transferable design lessons**, not proof Hungry has identical ordering problems. Google Maps' dish thumbnail → photos/reviews pattern is directly relevant [6]. Apple states tab bars are for top-level **navigation**, not actions [4].

**Evidence labels used below:** **Observed in code** (file/behavior found); **Historical documented concern** (earlier audit, must retest); **Recommendation** (design hypothesis), **Not yet verified** (requires live testing). A code screen existing is not proof the end-to-end screen works in production.

## 2.2 Scope boundary and current release reality

The repo's actual primary navigation is Home, Discover, Review and Profile with a centered Create action. Map discovery is a separate route, not currently a bottom tab. A previous `tasks/screens.md` document describes an older five-tab setup including Maps; **do not implement against that outdated inventory**. `src/constants/featureFlags.ts` currently gates **merchant centre/claim, DMs, comments, stories, collections, Passport/gamification, Crave, floorplans, OAuth and prototypes** in production; portfolio lists and stall alerts are explicitly enabled. Group wheel hosting is gated, while solo wheel behavior can remain available. Treat all gated screens as design-readiness recommendations, not shipped user experience.

Merchant ownership also differs between old PRD wording and evolved code: early product documents envisaged a standalone merchant web dashboard while current source has mobile merchant tabs. Product needs a clear architecture decision before merchant launch; do not market either channel as live without release verification.

## 2.3 User cohorts and primary jobs

| Cohort | Frequent job | What a good flow must deliver |
|---|---|---|
| Indecisive local commuter | "Something good below S$8, <10 minutes away" | Immediate nearby relevant shortlist, price, status, distance, directions |
| Confident dish-seeker | "Best laksa near me" | Natural spelling/synonyms, dish-dominant results, clear comparisons |
| Dietary-constrained user | "Reliable halal/vegetarian/no-nuts option" | Verified labels, unknown states, explicit disclaimers, no unsafe inference |
| Explorer/tourist | "What do I order at this hawker centre?" | Recognizable photos, descriptions, floor/unit, actual stall path |
| Returning saver | "What did I bookmark last week?" | Fast Saved entry and grouping by food type/area/last saved |
| Verified merchant, busy owner | "Update sold-out and price in seconds" | Lightweight edits, safe publish feedback, owner permissions, image upload |

# 3. What makes an app look good **and** feel good

**3.1 Visual hierarchy.** Show one unmistakable primary decision per viewport. Order information by decision utility: appetizing dish photo, dish title, S$ price, stall name, distance/availability, then a small amount of ratings/social proof. Promotion badges, account banners and editorial copy must never compete with the dish. Apply the principle of minimalist, recognition-based interfaces [1].

**3.2 Intent before decoration.** A relevant preset ("Under S$8", "Open now", "Near me", "Halal") is more useful than a beautiful carousel that hides all items until swiped. Use concise Singaporean wording users recognize, but explain niche dishes without patronizing copy. Filter chips should visibly reflect selection, quantity and removability.

**3.3 Photography as information.** Food apps use photography to answer "Do I want this?" Use a verified **actual dish image** first, a verified stall logo/storefront second where appropriate, and an intentionally neutral branded no-photo state last. Do not silently substitute unrelated Unsplash photos or generative food images for real dish inventory. Use consistent crop ratios and overlays for text contrast; cap resolution and prefetch based on expected viewport.

**3.4 Consistency instead of sameness.** Home, cards, details, results, lists and merchant forms should reuse the same semantic design tokens, iconography, typography and interaction conventions. But a dish card must remain visibly distinct from a stall card: dish title leads dish cards; stall name, operating status and location lead stall cards.

**3.5 Meaningful feedback.** A tapped filter reacts immediately; the loading placeholder resembles the destination; saving confirms the selected state; leaving a draft explains whether it is saved. Reversible actions have Undo where feasible. Motion should clarify cause and effect rather than prolong completion.

**3.6 Decision confidence.** A rating without review count, an "Open now" label without hours data and a "98% match" without calibration can damage trust. Every factual claim must be data-backed or explicitly unavailable. Distinguish editorial "Recommended" from data-calculated "Popular". Airbnb's Guest Favorites criteria illustrate why badges should be grounded in consistent review/reliability evidence [7].

**3.7 Accessible interaction.** Minimum **44×44 pt iOS / ~48×48 dp Android** recommended touch regions for interactive controls, with visible labels and native font scaling. This is a mobile best-practice target; WCAG 2.2's web criterion 2.5.8 has a different 24 CSS px minimum with defined exceptions [5]. Respect VoiceOver/TalkBack, Reduce Motion, high contrast and system text scaling.

**3.8 Perceived and measured performance.** Food-photo grids stress decoding/network, and large React components amplify JS work. Show immediate state, preserve previous content when refreshing, virtualize lists, memoize/filter off first frame, and run device profiling. Optimize *input-to-visible-feedback*, not just backend request duration.

**3.9 Hick's Law and single-action focus.** Decision time tends to increase as the number and complexity of competing choices increases. Do not remove useful choices arbitrarily: group them, sequence them, distinguish them, and reveal advanced controls only when the task requires them. **Each screen should have one primary next action, visually stronger than secondary controls.** This design standard is operationalized against Hungry's supplied screenshots in §17 [15–17].

# 4. Cross-app benchmark: what to learn, why, and what to avoid

The comparison focuses on **transferable patterns** rather than implying that the apps all share Hungry's business model. Specific platform interface layouts may vary by region, account and software version. Sources [2–14] validate the relevant design practices and product capabilities; the Hungry mapping is our recommendation.

| App / category | What is valuable | Why it works | Adapt to Hungry | Avoid copying |
|---|---|---|---|---|
| **GrabFood** — local delivery | Food-led browsing, clear price/merchant identity, local merchant recognition | Lowers scan cost and establishes nearby context | Verified stall logo with real menu photos, concise delivery deep links | Homepage dominated by promotions/campaigns, pricing framed as a delivery checkout |
| **Uber Eats** — marketplace | Dish/menu imagery and fast paths into relevant item | Converts fuzzy appetite into tangible choices | Dish-first results linking into stall | Extensive delivery-cart complexity Hungry does not own |
| **DoorDash** — marketplace | Practical filters and restaurant/menu choice context | Helps people narrow huge catalogs | Open now, budget, distance, dietary, sort control | Overpersonalized ads and hidden total-cost assumptions |
| **Deliveroo** — marketplace | Clear categories and local browse paths | Familiar browse vocabulary reduces uncertainty | Hawker/local categories tuned to Singapore; persistent applied filters | Treating restaurant as only searchable entity |
| **foodpanda** — marketplace | Visual menu cards, fast merchant context | Photos and price accelerate consideration | Contextual outbound order where available; do not redirect prematurely | Misleading availability / too much CTA density |
| **Google Maps** — local search | Dish thumbnails within places, photos/reviews and practical routing | Connects social proof to a real-world destination [6] | Excellent stall address, floor/unit and directions; user evidence linked to specific dish | Becoming a map-first general directory |
| **Airbnb** — decision marketplace | Image-led listings, trusted badges, clear filters, saved shortlists | Supports choice and reduces risk [7] | Evidence-based "well-reviewed" only when sample thresholds exist; collections for meal plans | Badges without reliable eligibility thresholds |
| **TikTok** — adaptive feed | Learns from watch and engagement behavior; easy feedback | Reduces repeated explicit preference work [8] | Behavior-based *food taste* inference and "not for me", bounded discovery | Infinite-scroll compulsion as the primary goal |
| **Instagram** — social discovery | Polished visual posts and native save/share | Makes peer content compelling and reusable | Small dish-tagged social proof attached to stall/dish | Turning Hungry into a generic follower-first photo feed |
| **Pinterest** — visual exploration | Visual collections, thematic browsing and saves | Helps users externalize a plan while scanning inspiration | "Next lunches", "Date-night dishes", "Hawker discoveries" lists | Endless image inspiration that cannot be acted upon locally |
| **Spotify** — recommendations | Mix of familiar, new and context-relevant picks, experiment culture | Balances relevance, novelty and habit [9] | Explainable "Because you saved laksa" vs "Try something different" rails | Opaque scores with no override |
| **YouTube** — recommendations | Content-focused browsing with explicit user signals | Better ranking learns usefulness, not merely raw clicks [10] | Rank by confidence-adjusted positive action and avoid repetition | Engagement bait/social chatter that delays decisions |
| **Duolingo** — habit-forming learning | Simple progress moments and nonintrusive streak support | Reinforces accomplishment, repeated utility [11] | Optional food passport/missions when real discovery value exists | Guilt-inducing streaks, notifications or points for empty engagement |

**A particularly useful benchmark contradiction:** Even leading food-delivery apps in Baymard's 2026 sample ranked overall "poor" to "mediocre" on industry-specific flows. Popularity is *not* proof of best practice. Their menu/dietary/return-path weaknesses are opportunities for Hungry [2].

# 5. Proposed information architecture

## 5.1 Current versus candidate

**Current observed navigation:** Home (social post feed) / Discover / [Create action] / Review / Profile. Map and search are additional routes; Saved is nested within Profile → Lists / Favourites. The user can get to these tasks, but **frequency of use** and **task importance** need measurement before deciding whether they merit first-level positions.

**Candidate experiment:** **Home | Explore | Saved | Profile**. From Home and Explore, a contextual **Review** action appears on an actual dish/stall; a Create/Share action appears at suitable entry points instead of occupying a bar slot. Explore contains **Dishes / Stalls / Map** views plus search. Home is a ranked dish feed. Profile includes taste fingerprint and account/creator identity.

Do not blindly change navigation: compare candidate against the current tab arrangement in moderated first-use tests and an A/B rollout. Retain familiar app back gestures and the current tab's scroll/filters when returning from details. This aligns with Apple guidance about tab bars and preserving navigation state [4].

![Candidate navigation architecture — an experiment, not the current app](hungry_ux_assets/structure.png)

## 5.2 The ideal journey

![Ideal food-decision journey, including guest continuation, preference and practical action](hungry_ux_assets/journey.png)

**Minimum low-friction path:** Open → prefilled area → relevant visible dishes → tap dish → compare price, status, stall and photo → directions or save. **Alternative:** type "spicy noodles below $10" → disambiguated dishes → results with filter chips → same details/action. **Recovery:** missing location → manual area, no matches → broaden radius/remove chip, missing image → honest fallback, offline → cached results with age, closed stall → clearly marked alternative.

## 5.3 Design for constraints, not only happy paths

A price/availability filter without real source freshness is worse than omitting that claim. Search must still work if location is refused. Preserve exact search text, selected filters, scroll location and map bounds on back navigation. External navigation return should land in the same detail. Require login **at the save/review/post action**, not at general browsing or route entry. Use account return routes to finish interrupted action.

# 6. Core interaction patterns to standardize

| Pattern | Interaction contract | Why |
|---|---|---|
| Search | Top search always visible on Explore; remembers term & active chips; accepts dish, stall, location, cuisine | Recognition and direct task entry |
| Filters | Horizontally scrollable short chips; one "All filters" bottom sheet; counts and clear all; no invisible filters | Constrains choice without trapping user |
| Sorting | Closest / Best match / Rating (with sample size) / Lowest price; explain if availability sparse | Sorting is a deliberate user choice |
| Dish card | 4:3 food image; dish name, S$ price, stall name, distance, one trust/status line | Enables 2-second scan |
| Stall card | Logo/storefront, stall name, verified hours/unit if known, sample menu teaser | Separates venue selection from dish selection |
| Detail actions | Persistent bottom **Directions** as primary for nearby; Save as secondary; delivery link when real | Bridges browsing to real-world step |
| Save | Optimistic UI with rollback on error; choose list only after default save succeeds | Avoids extra decision friction |
| Navigation | Back restores filters, query, scroll; tabs preserve nested state; out-of-app return consistent | Reduces cognitive disorientation |
| Images | Known-real menu photo first, actual stall photo/logo second, labeled no-photo fallback | Trust and legibility |
| Errors | Inline retry without losing form/query/draft; offer broadened alternatives | Supports recovery rather than dead end |
| Recommendation | Explanation: "You saved similar spicy dishes" or "Popular near your area" if supported | Control over inference and ranking |
| Primary action hierarchy | One high-emphasis, relevant action in each screen/state; all other actions secondary/tertiary | Removes equal-weight choice competition; see §17 |
| Contextual disclosure | Advanced controls in clearly labeled filters, menus, expandable sections or later steps; necessary safety info stays exposed | Reduces cognitive load without hiding necessary capabilities |

# 7. Page-by-page audit — first launch, onboarding and account

All screen names in this section reflect existing routes/files in `src/app/screens/` or registered navigation. Status **Core** means relevant to consumer launch; **Conditional** means tied to release flags or authenticated work.

## 7.1 Launch, onboarding and permission journeys

| Page / file | Source-informed assessment | Redesign specification |
|---|---|---|
| **Splash** (`SplashScreen`) | Bootstrap decides guest/auth/onboarding routes. | No marketing carousel on every launch. Use one clean logo, preserve background continuity, provide retry + offline route if initialization fails; avoid a blank prolonged launch. |
| **Onboarding Welcome** (`WelcomeScreen`) | Onboarding contains a welcome step. | Promise: **"Find the dish. Not just the restaurant."** Show 2 authentic local dish photos, one primary **Find food**, secondary **Personalize my picks**. Never demand a sign-in before users understand the benefit. |
| **Taste Quiz** (`TasteQuizScreen`) | Source has taste, budget and dietary choices, Back/Skip/Next. | Convert sliders into easily grasped food examples where possible; 3–5 quick steps or progressive disclosure. Show progress and Skip. Avoid asking six abstract dimensions simultaneously; keep advanced sliders optional. |
| **Dietary Preferences** (quiz phase) | Searchable dietary restrictions, multiple selections. | Distinguish preference vs medical allergy. Require exact, verifiable tags. Provide **"Prefer not to say"** and **"I have an allergy"** with clear uncertainty messaging; never infer allergy safety from dish name. |
| **Food Openness** (`FoodOpennessScreen`) | A configurable willingness-to-try-new-food phase exists. | Phrase as **"Stick to favourites / Mix it up / Surprise me"** with visual examples; allow later change in Settings; avoid impacting strict dietary exclusions. |
| **Taste Profile Result** (`TasteProfileResultScreen`) | A personalized result screen is already present. | Celebrate a real *decision* benefit, not a pseudo-scientific personality label: **"We'll start with spicy and savoury picks"** plus editable preferences and button **Explore nearby food**. |
| **Location Permission** (`LocationPermissionScreen`) | Dedicated request stage exists. | Explain what unlocks: distance, nearby, directions. Offer **Use my location**, **Choose area instead**, **Not now**. Only invoke system prompt after the user's action, not on initial launch. |
| **Manual Location Picker** (`ManualLocationPickerScreen`) | Route exists for area choice. | Search postal code, neighbourhood, MRT and hawker centre; show selected area persistently on Explore. Retain preferred area without GPS and supply reselect entry. |
| **Onboarding Auth** (`OnboardingAuthScreen`) | Separate optional authentication route. | Present sign-up after first value or when saving, with a visible **Continue as guest** if allowed. Explain benefit: keep saves and taste profile across devices; return to interrupted action. |

**Recommended onboarding split:** The *guest fast-path* asks only location/area, then shows useful dishes. The *personalized fast-path* asks 2–3 easy questions and lets the user edit any answer later. Measure both with real novices; avoid insisting on a numerical taste-vector quiz before seeing real food.

## 7.2 Authentication and recovery

| Page / file | Specific recommendation |
|---|---|
| **Login** | Use clear email and password fields, password visibility toggle, inline error, remembered return action. Never clear user's input on wrong password; expose recovery. |
| **Sign Up** | One primary CTA, minimal fields, keyboard types and autocomplete, concise terms; show why an account helps without obstructing browse. |
| **Email Verification** | State exactly what is being verified, show masked email, paste/autofill-friendly code input and **Resend** countdown/error. Persist account progress across app background. |
| **Forgot Password** | Explain that reset is sent if the account exists, do not reveal account existence in messaging; maintain visual flow. |
| **Reset Password** | Visible password rules and match state, paste-safe controls, expiration recovery, explicit success; test deep-link state. |
| **Reset Password Success** | One primary **Back to sign in**, no ambiguous next steps; maintain return-to-save context when possible. |
| **SignInPromptSheet** (shared) | Never silently discard user's intended Save/Review/Post. Explain "Sign in to keep this dish saved" and return to exactly that dish/action after login. |

# 8. Page-by-page audit — home, discovery, search and maps

## 8.1 Top-level Home / Explore

| Page / file | Observed in source | Prioritized improvement |
|---|---|---|
| **Home Feed** (`HomeFeedScreen`, `mode="social"`) | Rich author/post/feed interactions, reviews, photos, save/like/comment/follow; currently the first tab. | **P0:** experiment with dish-first opening: greeting/area, search, **For your taste**, **Open nearby**, **Under S$8**. Place social proof under relevant dish/venue instead of opening to a generic following feed. Preserve a clear social subsection for community users. |
| **Discover Home** (`DiscoverHomeScreen`) | One very large screen (~3,073 source lines) with location, dynamic search, chips, browse dishes/stalls, quick bites, "Decide for me" and "Pick with friends". | **P0:** reduce first-viewport choices to search, compact intent chips and one personalized rail. Organize deeper sections by job (Near you / Budget / Local favourites / Explore cuisine). Split render-heavy domains to memoized components; measure filter response. |
| **Review Feed** (`ReviewFeedScreen`) | Separate top-level Review tab. | Test whether review reading belongs inside dish detail or a dedicated community tab. A review feed needs dish, stall, price, author and time provenance on every item—not only stars and social reactions. |
| **Create Action** (`SwipeableTabNavigator`) | Central Plus is an action within a tab-bar-style control, distinct from actual navigation routes. | **P0 navigation experiment:** move to contextual composer FAB/action sheet; offer **Post a photo** or **Review a dish**. A tab bar should represent destinations, not commands [4]. If keeping center action, make its different behavior extremely clear and test discoverability/accessibility. |
| **Activity Inbox** (`ActivityInboxScreen`) | Messages and updates categories present; DMs gated in production. | Group actionable events by source (followed stall/menu, review interactions, account); deep link to exact content; don't render disabled message affordances in consumer production. Clear unread state and privacy. |
| **Activity Post Detail** (`ActivityPostDetailScreen`) | Dedicated entry route. | Preserve origin in back navigation; show explicit post-stall-dish relations and robust deleted/private content state. |

### Recommended Discover top fold

A practical proposed initial viewport: **(1)** area selector + "Hungry?" heading, **(2)** full-width search "Try laksa, chicken rice, halal under $8", **(3)** single-row intent chips (Near me / Open now / Under S$8 / Halal), **(4)** a strong 2-column dish grid or horizontal first rail with food photography, S$ prices and stall names. A prominent **Surprise me** control may sit near filters or just below results, not compete with navigation and content simultaneously.

## 8.2 Search and list browsing

| Page / route | Source-informed observation | Redesign specification |
|---|---|---|
| **Dish Search** (`DishSearchScreen`) | Search field and recent searches, source placeholder examples. | Focus field automatically *on explicit search entry*; suggestions grouped by Dish / Stall / Area; recent terms removable; corrected local spelling without blocking literal match. Show cuisine only if genuinely classified. |
| **Search Results** (`SearchResultsScreen`) | Supports dishes/stalls browse modes, loading, no results and retry. | Keep search term pinned; show result count and selected chips; sort by **Best match / Nearest / Lowest price**; show why match; avoid mixing stalls and dishes in one undifferentiated list. |
| **Browse Dishes** (`BrowseDishes`) | Registered route and shared grid logic. | Lead with dish type/name rather than venue; ensure price comparability and clear minimum availability. Offer photo-only results only if data sufficiently complete. |
| **Browse Stalls** (`BrowseStalls`) | Registered route and shared grid logic. | Show verified logo/storefront, operating status and area/unit; preview 2–3 real dishes so the choice stays food-relevant. |
| **Quick Bites** (`QuickBitesScreen`) | Route supports Quick Bites, trending, editorial, budget, late-night collections and location params. | Define and surface **why** each list qualifies. For "Quick" show actual walking/travel estimates only when available; for "Budget" enforce current S$ threshold; for "Late night" check hours. |
| **Search empty state** (shared) | Existing no-match message and retry. | Keep filters visible with one-tap **Clear restrictive filters**, **Widen area**, and **Search for stalls**. Avoid a global zero-results page when query has valid nearby alternates. |
| **Search with no GPS** (shared) | Manual location available elsewhere. | Ask for an area in place, not a permission loop. A usable "All Singapore" browse mode beats blocking the whole screen. |
| **Food-type/cuisine tags** (data/UI) | Data reconciliation work is ongoing in the project. | Display verified specific cuisines only; leave uncertain cuisines untagged. Unverified cuisine must never act as a hard search exclusion. |

### Search behavior and ranking specification

Prioritize: **hard constraints** (verified dietary restrictions, manually selected area, price cap, opening constraints with adequate confidence) → **semantic text relevance** (dish names, transliterated/synonym forms, cuisine, stall) → **distance/time** → **calibrated quality** (rating adjusted for review count and recency) → **personal taste** → **diversity/exploration**. Constraints have explicit source status; unknown availability or dietary labels should not be silently treated as affirmative.

Support Singapore queries: "mee pok" vs "bak chor mee," "chicken rice," "nasi lemak," "ban mian," "laksa," "roti prata" vs "prata". Treat spellings, synonyms, mixed Chinese/Malay/English vocabulary and food-type hierarchy as search design features. Avoid unverified claim that all are exact synonyms; synonym maps need curated validation.

## 8.3 Map, Decide For Me, Crave and Wheel

| Page / route | Source-informed observation | Redesign specification |
|---|---|---|
| **Discover Map / Home Map** (`HomeMapScreen`) | Map search, venue cards, legend and preview affordances exist. | Maintain same applied filters as list view; tap pin → preview bottom sheet with 1–3 real dishes; "View stall" and "Directions" obvious. Map should be a **way to find food**, not a decorative geographic layer. |
| **Map Zoomed In** (`MapZoomedInScreen`) | Route takes `buildingId`; floorplans currently disabled. | Show location hierarchy (building → floor → unit if verified), fallback to text list if floorplan unavailable. Never draw inaccurate stall positions. Preserve selected venue when returning to map. |
| **Decide For Me Result** (`DecideForMeResultScreen`) | Shows radius, dish, taste, "Not for me", other picks, save and directions; expands search if empty. | Make result immediately actionable. Keep **Try another** alongside **Why this?**, **Directions**, price, stall and area. Limit reroll repetition; preserve hard filters. Make surprise fun but not theatrical. |
| **Crave swipe mode** (`CraveScreen`, gated) | Present in source but non-production. | Before launch: replace bare swipe-only semantics with **Interested / Not for me / Save** buttons and non-swipe alternatives. Respect reduced motion. Learn only with transparent privacy and feedback controls. |
| **Wheel Home / solo decision** (`WheelHomeScreen`) | Wheel choice route present; group features gated. | Place beside **Decide for me** as a fun optional path, not primary task requirement. Preload options and display eligible choices; ensure wheel never picks closed/ineligible dishes. |
| **Wheel Lobby** (`WheelLobbyScreen`, group gated) | Group session route exists; backend may not support real external joining in production. | Show share code, membership/presence, clear leave action, expiration and permission to host. Do not present simulated sessions as real. |
| **Wheel Spin** (`WheelSpinScreen`) | Animatable selection route. | Animation should finish fast and support skip/reduced motion. Winner criteria and exclusions visible before starting. |
| **Wheel Result** (`WheelResultModal`) | Result modal component. | Show tangible result: dish, stall, price and **Get directions**. Add **Spin again** only as a secondary. |

# 9. Page-by-page audit — detail, reviews and social creation

## 9.1 Product detail is the pivotal conversion screen

| Page / file | Source-informed observation | Redesign specification |
|---|---|---|
| **Dish Detail V2** (`DishDetailScreenV2`) | Existing photos, rating, taste panel, hours, directions, venue link, similar dishes and recovery states. | Make one-screen decision possible: hero actual dish photo; dish + S$ price; stall, verified location and current status; taste highlights with honest data; clear bottom **Directions** / **Save**. Hide unavailable review/rating claims rather than substitute defaults. |
| **Stall Detail** (`StallDetailScreen`) | Rich page with directions/call/save/share, owner panel, categories, menu, links. | Hero should identify stall; **Menu** immediately visible; group categories; emphasize *what to order* with dish photos and price. Render floor/unit precisely when known; organize hours as concise current state + expand. |
| **Catalog Raw Detail** (`CatalogRawDetailScreen`) | Raw imported catalog fallback route. | Keep as an explicitly **unverified listing** with provenance and "Suggest correction" entry; prevent raw data surfaces from looking equally verified as owner-managed listings. |
| **Merchant Claim Explainer** (`MerchantClaimExplainerScreen`, gated) | Merchant claim content exists but release gated. | Explain one-stall ownership, proof steps, estimated process without invented timings, eligibility and data that becomes editable. Do not encourage user-facing claim until backend/verification launch approval. |
| **Blog Post WebView** (`BlogPostWebViewScreen`) | Editorial article route exists. | Show credible publisher/attribution, external link and **View mentioned dishes on Hungry** deep links; never trap users in a WebView without safe back/close or blur article from listing data. |
| **Photo unavailable** (`NoDishPhoto` shared) | Explicit fallback component exists. | Use a warm brand-neutral illustration marked **Photo not available**; never substitute another dish's photo. Promote merchant upload corrections where appropriate. |
| **Stall image / logo** (`StallLogoMark`, images) | Reusable stall logo component and image fallback exist. | Separate logo from storefront and dish image; protect aspect ratio and transparency. Prioritize approved owner assets and record source/licensing; show generic initial mark only as fallback. |

**Suggested Dish Detail information order:** photo → *dish name + S$ price* → serving stall + "[area, floor/unit]" → reliable open/availability and distance → one primary real-world CTA → what it tastes like / ingredients (verified) → dish-level reviews → more from this stall → similar dishes. Avoid making a taste radar chart more prominent than price, location and ability to eat the dish now.

## 9.2 Review, ratings and composer

| Page / route | Source-informed observation | Redesign specification |
|---|---|---|
| **Review Screen / ReviewStack** (`ReviewScreen`) | Stall/dish selection, overall rating, text, optional music, taste tags, recommendation, publish. | Offer **Quick review** (~20–30 seconds): pick dish already in context → overall sentiment/star → 1–3 taste tags → submit, with optional photo/text. Advanced music/share should never block a useful review. |
| **Review Feed** (`ReviewFeedScreen`) | Community review browsing. | Surface dish-level evidence and freshness; label review date, sample size, "from verified order" only if verifiable (Hungry currently doesn't process orders). Sort **Most recent / Most helpful** with disclosure. |
| **Review Share Sheet** (`ReviewShareSheet`) | Share-related component exists. | Preview exact shared information, real dish link, accessible native share, privacy controls and attribution. |
| **Review Success** (`ReviewSuccessModal`) | Dedicated feedback component exists. | One small confirmation with **View review**, **Share**, **Done**. No mandatory upsell or delayed celebratory animation; never imply fabricated rewards. |
| **Review History** (`ReviewHistoryScreen`) | Listed under Profile. | Display chronological dish imagery, rating and date, with Edit/Delete (subject to policy), and access to same dish/stall. |
| **Post Composer** (`PostComposerScreen`) | Dish picker, photo/video media, caption and publish; V1 ships. | Prioritize media pick → tagged dish/stall → short caption → audience/privacy → publish. Autosave draft before interruption, show upload progress and recovery. Explicit media usage consent. |
| **Post Composer V2** (`PostComposerScreenV2`, prototype) | Route exists behind prototype flag. | Use as an experiment; do not promote two parallel composers. Merge only proven higher-completion details into V1; release flag and moderation proof required. |
| **Story Viewer / Add Story** (`StoryViewerScreen`, `AddStoryScreen`, gated) | Feature flagged for nonproduction. | Only ship if it helps discover **real dishes at real stalls**; display accessible pause/skip, temporal label, venue deep links and moderation. Not a required core navigation surface. |
| **Activity social post view** (`ActivityPostDetail`) | Social content can link to posts. | Link photo and caption to tagged dish/stall with explicit "Go to dish" action. Retain back to source feed and privacy boundaries. |
| **Direct Messages / Chat Detail** (`DirectMessagesScreen`, `ChatDetailScreen`, gated) | Screens exist but production disabled. | Do not introduce merely for retention. Require moderation/report/block, privacy, abuse handling and real-time delivery quality first. Facilitate native sharing before in-app DM investment. |
| **User Profile** (`UserProfileScreen`) | Public social profile capability exists. | Show useful food interests, credible visits/reviews and user posts, privacy-respecting follow. Don't expose location trails or contact info. |
| **Followers / Following** (`ProfileConnectionsScreen`) | Dedicated connection lists exist. | Make mutual context clear; de-emphasize vanity metrics. Proper private-account states, pending requests and remove/follow feedback. |

## 9.3 Content model convergence

Hungry presently has **posts, reviews, dish cards, stall pages and social views**. These should not compete as unrelated data objects. Establish a canonical connection: a **post** may tag one or more dishes/stalls; a **review** is evidence about a specific dish, and optionally about the stall; a **dish** belongs to the verified menu of a stall; a **saved item** points to an entity and preserves its identity after an image/price change. Avoid collapsing reviews and posts into a single ambiguous creation screen; provide context-aware defaults.

# 10. Page-by-page audit — profile, saved food and collections

| Page / file | Source-informed observation | Specific recommendation |
|---|---|---|
| **Profile Home** (`ProfileHomeScreen`) | Large social profile, Taste Fingerprint, posts, review/stall/saved tabs and quick-access menu. | Lead with functional identity and **Saved food**; keep taste fingerprint edit link but not ahead of saved items. Use strong section hierarchy. If users primarily explore food, don't demand follower-centric behavior. |
| **Taste Fingerprint** (Profile section) | Six-axis taste visualization/persona summary in current source. | Rename dimension labels in friendly terms; show what the system learned vs what the user stated; **Edit taste** and **Reset recommendations**. Never show precision beyond model reliability. |
| **Favourites** (`FavouritesScreen`) | Saved dishes have a dedicated route. | Replace flat chronological-only presentation with useful grouping: **All / Near me / Dish type / Saved recently** and persistent sort. Preserve stale/outdated dish labels and direct shortcuts to stall. |
| **Lists Home** (`ListsHomeScreen`) | Current hub: Saved, Your lists, Checklists. | Clarify: "Saved" = quick bookmarks, "Lists" = themed folders, "Checklists" = things to try. Use only one entry point, no competing collection taxonomies. |
| **Checklists Home** (`ChecklistsHomeScreen`) | Checklist routes exist. | Support simple **Want to try / Tried** progress, locality and modest optional rewards. No fake visits or social proof. |
| **Checklist Detail** (`ChecklistDetailScreen`) | List of target items. | Clear completion state, quick note and real location; sorting by distance to reduce actual travel effort. |
| **Checklist Item Picker** (`ChecklistItemPickerScreen`) | Select dish/stall/custom item. | Unified search with icon labels for item type; deduplicate picks; show confirmation without losing current list. |
| **Portfolios Home** (`PortfoliosHomeScreen`) | Portfolios shareable in production. | Consider renaming **Food lists** in consumer copy; grid with title, item count, visibility, last modified and first 3 real dish thumbnails. |
| **Portfolio Detail** (`PortfolioDetailScreen`) | List detail route exists. | Items grouped optionally by area/cuisine; actionable map/list switching; duplicate-removal and member roles; shared link controls. |
| **Portfolio Create** (`PortfolioCreateScreen`) | New portfolio route exists. | Create title → privacy → first dish; a single progressive step is preferable to a long form. Preview public/private implications. |
| **Portfolio Edit** (`PortfolioEditScreen`) | Editing route exists. | Distinguish metadata editing from item management; visible save / undo / unsaved-changes confirmation. |
| **Portfolio Item Picker** (`PortfolioItemPickerScreen`) | Adding dishes/stalls. | Use the same search card contract, selection checkmarks and finish counter; avoid different vocab from core Discover. |
| **Portfolio Collaborators** (`PortfolioCollaboratorsScreen`) | Collaborative lists. | Clear owner/editor/viewer permissions, pending invitations and removal confirmation; private lists default private. |
| **Portfolio Search** (`PortfolioSearchScreen`) | Finds lists. | Search by title and theme, not by exposed private list metadata. Default to user-owned/public authorized visibility. |
| **Portfolio Public View** (`PortfolioPublicViewScreen`) | Public share link route is enabled. | View without app install where technically supported; show creator attribution and privacy, safe fallback for unlisted/deleted content, clear Open in Hungry deep link. |
| **Visited Stalls** (`VisitedStallsScreen`) | Profile utility. | Differentiate "marked visited" and location inferred; don't infer a visit from one tap or GPS alone. Provide manual correction. |
| **Followed Stalls** (`FollowedStallsScreen`) | Follows are supported. | Show meaningful menu updates, newly available dishes and sold-out notices **with timestamp**. Avoid overwhelming users with merchant promos. |
| **Follow Requests** (`FollowRequestsScreen`) | Social moderation of connections. | Group requests by sender, show mutual context and privacy. One-tap approve/decline with undo and rate limits. |
| **Social Grid / Social Post Detail** (`SocialGridScreen`, `SocialPostDetailScreen`) | Saved/liked social-post views. | Explicitly distinguish **Saved dishes** from **Saved posts**. Show source attribution and links back to the actionable dish. |
| **Edit Profile** (`EditProfileScreen`) | Existing profile editor. | Simple fields, character counts, photo preview, optimistic save state and privacy-safe defaults. |
| **Add Stall** (`AddStallScreen`) | User-suggested stall route. | Create an unverified **suggestion**, not an instantly verified entity. Show evidence fields (name/address/photo) and review state; avoid exposing duplicate stalls. |
| **Settings** (`SettingsScreen`) | Large account preferences view. | Group Account / Taste and discovery / Notifications / Privacy and safety / App. Make permission and data controls easy to find and reversible. |
| **Change Password** (`ChangePasswordScreen`) | Security route. | Show strength guidance and verification; security errors must be explicit, successful change confirmed, and current session behavior explained. |
| **Account Deletion** (Settings/dialog) | Account deletion safeguards exist. | Plain explanation of consequences and a noncoercive cancel path; support required grace-period behavior if backend policy provides it; communicate request status. |
| **Passport / Missions** (`PassportScreen`, `MissionsScreen`, gated) | Gamification surfaces exist but are not production enabled. | Reward real first-party value (try a cuisine, save a useful list), not idle scrolling. No compulsive streak loss; accessibility/reduced motion and truthful criteria required before public launch. |

**Key simplification:** From any detail, **Save** should work without forcing a list taxonomy decision. On first save, use an unobtrusive confirmation **Saved · Add to a list**. On Saved home, users can later sort, group or create a shared food list.

# 11. Page-by-page audit — merchant centre (staging / gated)

**Release caution:** All of these screens are source-level merchant experiences, but `merchantCentreEnabled` is false in the production flag resolution. The following is a **merchant UX roadmap**, not a claim that live merchants can already use each workflow. Existing `src/app/screens/merchant/` code implements several concepts; require permissions, verification, image rights and backend audit before rollout.

| Page / file | Source-informed observation | Specific recommendation and release check |
|---|---|---|
| **Merchant Dashboard** (`MerchantDashboardScreen`) | Views, average rating, verification/profile alerts, unreplied reviews, shortcut to menu. | **First card: Today's tasks** (sold-out dishes, incomplete photo, unanswered review). Second: actionable **Edit menu**. Only show metrics with data/source window (e.g., views **last 7 days**) and avoid vanity stats as leading content. |
| **Merchant Menu** (`MerchantMenuScreen`) | Search, image cards, sold-out/available switches, add manually, OCR photo drafts. | Default compact editable rows with dish photo, name, S$ price and availability toggle; bulk **Mark available** with confirmation; immediate optimistic feedback then server-verified result. |
| **Dish Editor** (`DishEditorScreen`) | Editing dish details including pricing and media. | Top preview of customer-facing card; fields Name / Price / Description / Category / Verified ingredients and dietary indicators / Photos / Available. Validate S$ and missing data. Safe Save Draft vs Publish state, with explicit server result. |
| **OCR Drafts** (`OCRDraftScreen`) | OCR-assisted menu entry exists. | Clearly label extraction as **Unreviewed draft**; per-field confidence and quick correction. Never silently publish OCR-inferred prices, allergens or cuisine; require human review. |
| **Merchant Analytics** (`MerchantAnalyticsScreen`) | Metrics surface exists. | Four clear questions: Which dishes are seen? Which get details? Which get directions/saves? What changed? Use time range, trend comparator, sample size and no unverified conversion-to-sale claims. |
| **Merchant Profile** (`MerchantProfileScreen`) | Merchant-facing profile entry. | Separate public business preview from private management. Show verification and most recent publish timestamp. |
| **Business Profile Editor** (`BusinessProfileEditorScreen`) | Stall address/hours/contact/editing. | Structure by **Business details / Where to find us / Hours / Media**; map preview plus floor/unit. Use day-by-day hours editor and special closure overrides; validate format before publish. |
| **Opening Hours Editor** (`OpeningHoursEditor`) | Reusable component exists. | Support breaks, days closed, public-holiday override and "closing early today" with expiry. The consumer app must reflect actual source uncertainty and timezone. |
| **Merchant Image Field** (`MerchantImageField`) | Shared image edit primitive exists; earlier project discussion noted legacy URL-only upload. | Prioritize **Choose from gallery / Camera / Upload**, crop and preview, progress/retry, file size/type limits, rights confirmation, suitable image moderation. URL paste may remain an advanced fallback. Verify actual native permissions on devices. |
| **Verification Centre** (`VerificationCentreScreen`) | Claim/verification status flows exist. | Show requirements, evidence, step tracker, rejection reasons and ability to resubmit without restarting. No "Verified" badge until server approval. |
| **Home-Based Verification** (`HomeBasedVerificationScreen`) | Specialized verification route. | Explain why documents are requested, what is public/private, who can see evidence, and how long it is retained. Avoid exposing private home address without authorization. |
| **Customer Inbox** (`CustomerInboxScreen`) | Merchant/customer messages and review-related actions. | Divide reviews needing reply from official customer requests. No fake response-time promise; include report/abuse moderation and user privacy. |
| **Featured Visitors** (`FeaturedVisitorsScreen`) | Social merchandising component exists. | Require creator permission and attribution for reposted customer photos; allow removal; never automatically claim endorsement. |
| **Promotion List** (`PromotionListScreen`) | Promotion management exists. | Simple promotion states (Draft / Scheduled / Live / Expired), start/end times, visibility status, edit/disable with audit. Keep consumer pages useful without promos. |
| **Promotion Builder** (`PromotionBuilderScreen`) | Merchant offer editor exists. | Price/timing validation, specific dish applicability, legal/discount wording, live preview and publish review. Promote only with verified inventory and offer eligibility. |
| **AI Assistant** (`AIAssistantScreen`) | Experimental merchant AI surface. | Keep suggestions clearly **assistive**, never directly modify price/availability/verified facts. Show proposed changes, source confidence and confirm-before-publish. |
| **Merchant Settings** (`MerchantSettingsScreen`) | Merchant account and configuration. | Clear merchant access/permissions, notification settings, billing if ever introduced, support, sign out and security. |
| **Outlet Switcher** (`OutletSwitcher`) | Component supports multiple outlets; early product requirements assumed one account = one stall. | Resolve organization/outlet permission model explicitly. Show only authorized outlets; indicate which venue an edit affects. No cross-outlet leakage. |
| **Consumer Claim CTA** (`MerchantClaimExplainer`) | Feature gated. | When enabled, locate discreetly on Stall Detail **Is this your stall?**; never compete with consumer directions or menu. |

**Merchant UX service level:** Updating a price or sold-out flag should take *seconds, not multiple screens*. The flow should say what changed, when it is visible to customers, and whether the publication succeeded. This deserves direct on-device testing with busy hawker merchants rather than office-only design review.

# 12. Hungry visual design system — recommended specifications

These are **implementation proposals** anchored to existing tokens, not instructions to discard the current visual identity. Actual values should be pulled from `src/theme/tokens.ts` and validated for iOS/Android accessibility.

## 12.1 Identity: modern Singapore food discovery

**Mood:** warm, delicious, straightforward, credible and distinctly local. **Avoid:** generic enterprise SaaS blue/purple, white-on-white emptiness, hyperactive neon gradients, tiny floating captions over busy images and mock stock-food cards.

| System layer | Proposed rule | Implementation notes |
|---|---|---|
| Brand accent | Keep Hungry orange around `#E8531E` | Use for **one** primary CTA, active selected state and limited highlights; contrast test each combination. |
| Text | Deep navy / near-black, high contrast | Existing Nunito and DM Mono are a differentiator; use Nunito for hierarchy, DM Mono **only** for prices/numbers, with tabular lining where possible. |
| Canvas | White/warm neutral backgrounds | Avoid tinted cards inside tinted cards; food imagery carries saturation. |
| Spacing | Default **16 px** horizontal gutters; 8/12/16/24/32 vertical rhythm | Reuse existing `spacing` scale, prevent density jumps across screens. |
| Corners | 8 px chips and 12–18 px cards/sheets (tokenized) | Consistency matters more than whether exact radius is 16 or 18. |
| Images | Dish 4:3 or 1:1 depending on card context; photo content should remain identifiable | No stock substitutions, no distorted logos, show unavailable state. |
| Primary controls | At least 48–52 px high; short verb labels; visible spinner/disabled state | Maintain native hit-slop, focus order and keyboard behavior. |
| Navigation | 4 clear destination tabs preferred for experiment; top-level label visible | Keep Search in Explore and primary CTA in contexts rather than a competing bar button. |
| Animation | 100–300 ms for UI feedback, respecting Reduce Motion | Prefer touch feedback, smooth image transition and sheet entrance; no prolonged spin/fade sequences. |
| Shadows | Light, 1–2 elevation families | Avoid cards appearing visually detached or clickable when not actionable. |
| Status | Text + symbol + semantic color, never color alone | Open/closed, verification, dietary, price changes and errors. |

## 12.2 Standard card templates

**Dish:** Hero photo (~55–65% of card height); one/two-line name; S$ price visually strong; stall name + area in quieter typography; optional verified "Open now" / distance chips. Rating only with sample size and provenance. Save target at top-right must not occlude food.

**Stall:** Logo/storefront image; stall name; open status / hawker name / floor/unit; "Top dishes" thumbnail strip if available. Do not display another stall's logo as a fallback.

**Social post:** Media + author attribution + tagged dish and stall as prominent tappable row; social actions as secondary. A post should answer what food it shows rather than merely how many likes it received.

**Review:** Dish/stall linkage, rating/taste tags, date and authored text/image; helpful report/flag. Default sort by relevance/recency with selectable alternative.

**Merchant menu row:** thumbnail + item name + S$ price + toggled availability + edit; supports rapid repeated edits.

## 12.3 Screen-state matrix, mandatory

| State | Consumer expectation | Merchant expectation |
|---|---|---|
| Loading | Content-shaped skeleton, no layout jump | Inline row skeleton / action progress |
| Refreshing | Existing results remain visible; subtle refresh signal | Prevent duplicate saves, identify in-flight changes |
| Empty | Reassuring task-specific path, not a dead end | CTA to add first dish/photo/hours |
| Error | Explain what failed; explicit Retry; preserve filters/search text | Preserve unsaved changes, do not imply publish succeeded |
| Offline | Show last cached info with age and no unsupported live status | Allow draft offline with clear unsynced indicator or disable action honestly |
| Permission denied | Manual location / photo alternative | Gallery/upload permission recovery and Settings link |
| Unauthorized | Browse allowed; prompt on gated action, return afterwards | Verification/role-specific route with no private data leakage |
| Stale data | Reveal updated/opening-hour uncertainty | Conflict warning, version compare, explicit retry/reload |
| Success | State changes + optional Undo | Timestamped "Updated for customers" only on confirmed backend commit |

# 13. Ranking, personalization and ethical retention

## 13.1 What Hungry can reasonably borrow

TikTok explicitly describes its For You feed as responsive to interest and engagement, and supports explaining why a post was shown [8]. Spotify's public engineering discussion emphasizes separating personalization from experimentation [9]. Hungry should learn **food preference and decision relevance**, not maximize addictive feed consumption.

The repository contains `src/hooks/useImplicitSignalCollector.ts`, including dwell, photo zoom, category click, dismissal and rapid scroll signals. Importantly, it explicitly sets **`IMPLICIT_LEARNING_ENABLED = false`**, so collecting/using these signals is **not currently an enabled consumer-learning capability**. Before launch: establish privacy disclosure/consent, safe retention, suppression for sensitive inference and quality evaluation. Do not treat scroll-past as strong dislike; it may reflect slow loading or an accidental swipe.

## 13.2 A practical transparent recommendation system

**Candidate ingredients (illustrative, not current production model):**

- Hard constraints: validated dietary exclusions, price cap, selected area/radius, available-now *only if reliable*.
- Explicit positive: user saved dish, asked for more of a cuisine, marked a dish "Interested".
- Explicit negative: "Not for me" at a dish or a repeated dismissal, not a single accidental scroll.
- Behavioral context: search text, dish detail open, repeat revisit, directions click, optional photo viewing; downweight passive views.
- Exploration: small share of unfamiliar dishes with similar sensory profile, and a visible **Try something new** affordance.
- Trust: quality-adjusted signal from real review history; content completeness and freshness.

Use an explainable ranking score with weights **learned from real success outcomes**, not arbitrarily presented as a "96% taste match." When cold-start data is sparse, rank by query relevance, distance, validated business info and popular dishes; let users set spicy/budget favorites voluntarily. Personalization must never override strict allergy/dietary exclusions.

## 13.3 Why the retention should feel useful

Duolingo's streak work illustrates habit reinforcement [11], but food discovery is not language learning. Rather than daily pressure to open Hungry, use **practical positive loops**: revisit saved food, discover a new dish type, receive a useful menu/price update from a followed stall, or build a lunch list with friends. Push only when the event actually matters; easy opt-out; avoid scarcity theatrics and fake urgency. Evaluate the model on **completed food decisions per user-week** and **user satisfaction**, not session duration alone.

# 14. Prioritized implementation backlog

**Scoring method:** Impact (H/M/L) is expected direct value for user's decision journey; Effort (S/M/L) is relative implementation uncertainty based on current code surface; Confidence (High/Medium/Low) reflects strength of evidence, not statistical certainty. No impact lift is claimed without experiment.

## P0 — Foundation and core discovery

**UX-01 — Dish-first Home test** *(Impact High · Effort Medium · Confidence Medium).* **Owner:** `HomeFeedScreen` / navigation. Experiment against social-first Home; success means fewer actions to first useful dish and increased task completion without unacceptable social satisfaction loss.

**UX-02 — Authentic, standard dish/stall cards** *(High · Medium · High).* **Owner:** `DishCard`, `StallLogoMark`, Discover/results. No stock images posing as menu photos, consistent dish/stall hierarchy, verified fallback for missing photos and logos.

**UX-03 — Search, filter and back-state contract** *(High · Medium · High).* **Owner:** `DishSearchScreen`, `SearchResultsScreen`, Discover. Filters react instantly; returning from detail retains query, chips, list position and selected results mode.

**UX-04 — Trust provenance/unknown data** *(High · Medium · High).* **Owner:** service layer and all details, map and merchant UI. Do not invent availability, rating, review count, hygiene score or distance; source and last-update age available for investigation.

**UX-05 — Bottom navigation usability experiment** *(High · Medium · Medium).* **Owner:** `SwipeableTabNavigator`. Compare current arrangement against Home/Explore/Saved/Profile with contextual Create/Review; creator task success is a guardrail.

**UX-06 — Device response profiling** *(High · Medium · High).* **Owner:** Home, Discover, tabs and details. Log p50/p95 touch-to-feedback on representative iOS and lower-end Android; eliminate no-response taps.

**UX-07 — Browsing as a guest** *(High · Small–Medium · High).* **Owner:** onboarding/auth/search. A new user must see food without GPS/signup, and resume save/review after signing in.

**UX-08 — Sticky, actionable detail controls** *(High · Small · High).* **Owner:** Dish/Stall detail. Directions and Save work, delivery link shown only when valid; safe-area and keyboard behavior verified.

**UX-09 — Real-world accessibility proof** *(High · Medium · High).* **Owner:** all core screens. Complete VoiceOver/TalkBack, large text and reduced-motion journeys on devices, including carousels and chips.

**UX-19 — Hick's Law / one-primary-action redesign** *(Impact High · Effort Medium · Confidence High as a heuristic, requires user validation).* **Owner:** consumer screen owners + design system. Remove equal-prominence CTA pairs, clarify the primary next action for every state, and reduce first-viewport choice competition. Apply the screenshot matrix and QA gates in §17.

**UX-20 — Contextual relevance and progressive disclosure** *(Impact High · Effort Medium · Confidence Medium).* **Owner:** Discover, details, onboarding, review/post composer, profile and merchant. Hide unavailable/unneeded options until user context makes them useful; keep accessibility, account recovery and safety-critical information discoverable and correctly prioritized.

## P1 — Retrieval, reviews, learning and expansion

**UX-10 — Simplify Saved hub** *(Medium–High · Medium · Medium).* **Owner:** Favourites, Lists and Portfolios. Saving is one action, items retrievable by recent, dish type and area without taxonomy confusion.

**UX-11 — Contextual quick reviews** *(Medium · Medium · Medium).* **Owner:** ReviewScreen. Start from a dish and complete a useful review without mandatory media/music or draft loss.

**UX-12 — Explainable taste learning** *(High · Large · Medium).* **Owner:** AI service/events. Explicit opt-in controls; offline ranking evaluation; in-product reasons and "Not for me" work; dietary exclusions remain hard constraints.

**UX-13 — Unified map/list filters** *(Medium · Medium–Large · Medium).* **Owner:** HomeMap and Discover. Same data scope and selection; map/list switch retains filters, radius and view state.

**UX-14 — Local search taxonomy QA** *(High · Medium · High).* **Owner:** catalog and search. Curated food synonyms, no forced cuisine, measured false positives; local terms and transliterations tested.

**UX-15 — Cross-link content objects** *(Medium · Large · Medium).* **Owner:** posts/reviews/dishes/stalls. Tag associations correct, references resolve after edits, private/deleted content shows honest states.

**UX-21 — Decision-load usability experiment** *(Impact Medium–High · Effort Small–Medium · Confidence Medium).* **Owner:** product analytics / research. Compare current versus simplified Discover, Review, Detail and Merchant Menu flows on time to correct primary action, decision hesitation, accidental taps, task success and recoverability. Do not treat an arbitrary button-count target as proof of good UX.

## P2 — Gated merchant and engagement surfaces

**UX-16 — 30-second merchant updates** *(Merchant impact High · Medium · High).* **Owner:** Menu, DishEditor, Hours. Merchant changes price/availability quickly and confirms the actual consumer-visible result.

**UX-17 — Native merchant media + OCR safeguards** *(Merchant impact High · Large · High).* **Owner:** ImageField/OCRDrafts. Gallery upload, preview, retry, source rights and human validation before publishing extracted fields.

**UX-18 — Social, Crave and Passport launch gates** *(Impact Variable · Large · Confidence Low–Medium).* **Owner:** feature flags and privacy/moderation. Do not enable without verified real data, accessible alternatives, guardrails, reporting and rollback.

**Suggested order of work:** Finish UX-02, UX-03, UX-04, UX-06 and UX-07 as trust/performance foundations in parallel with usability prototypes for UX-01/UX-05. Avoid a massive simultaneous visual rebuild. Release behind measured, reversible flags with a crisp compare-to-baseline plan.

# 15. Research validation and execution plan

## 15.1 Moderated usability protocol

Recruit **5–8 people per core cohort** for an initial directional study (indecisive locals, dietary-constrained users, travellers/new residents), with Singapore-area variety and an Android/iPhone mix. The number is an iteration starting point, not a statistically representative sample. Separately recruit **4–6 merchants** for the gated portal. Do not coach where buttons are; record interactions and post-task interviews with consent.

| Task | Scenario prompt | What to measure |
|---|---|---|
| T1 — craving | "Find laksa within 15 minutes' travel, under S$10." | Task completion, time to credible dish, wrong taps, need for filters |
| T2 — no GPS | "Decline location, choose Jurong West, find a budget dinner." | Location recovery success, confusion, permission loops |
| T3 — dietary | "Find a halal lunch with reliable source info." | Correct classification, confidence, false reassurance or unsafe labels |
| T4 — decide | "You have no food in mind; pick something to eat now." | Time from Home to actionable decision; usefulness of surprise |
| T5 — return | "Save a dish, leave, then find it again later." | Save affordance discovery, collection confusion, revisit success |
| T6 — map | "Find the stall and its unit within a hawker centre." | Accuracy of location, back-path preservation, map/list comprehension |
| T7 — contribute | "Write a quick dish review with optional photo." | Completion, permissions, draft loss, time spent |
| T8 — merchant | "Mark an item sold out and change another price." | Error rate, completion time, publication confirmation, rollback |

**Capture:** first click/tap, dead ends, time, navigation reversals, confidence rating after action, abandonment reasons, two-minute recall, accessibility mode, precise data/source accuracy. Avoid interpretation based on users saying the screen "looks modern" alone.

## 15.2 Proposed A/B and instrumentation

**Experiment A:** current Home vs dish-first Home. **Primary:** actionable food decision per eligible session. **Guardrails:** search errors, crash rate, save/review completion, unsubscribes, content diversity, user-reported choice confidence. **Experiment B:** current tab bar vs Home/Explore/Saved/Profile with contextual Review/Create. **Primary:** target-route discovery and completion. **Guardrails:** creator post volume and review participation.

Instrument anonymized, privacy-compliant events such as `search_started`, `filter_applied`, `dish_impression`, `dish_opened`, `stall_opened`, `directions_tapped`, `save_completed`, `review_completed`, `result_not_interested`, `guest_location_chosen`, with timestamp, page, experiment group, sufficient contextual group labels, and consent status. Avoid logging raw location/address, exact search phrases containing personal information, private content or sensitive identifiers without a justified privacy basis.

**Performance acceptance targets (initial engineering targets, not measurements):** p95 visible feedback after tap <150 ms; tab switch perceived <300 ms; search filter update <500 ms p95; detail content ready <1 s on representative connections; common task to first useful dish <10 s for warm sessions; accessible loading state appears immediately when a request is delayed. Revise after profiling real devices, including low/midrange Android and weak mobile signal. Historical June 2026 repo QA documents had unverified runtime p95 and screen-reader checks; current tests must be rerun rather than assuming unresolved failures.

## 15.3 Accessibility acceptance matrix

**Must demonstrate, not merely unit-test:** keyboard/screen-reader labels for food cards, photo descriptions, tab selected state, modal focus return, error announcements, account forms, filter chip state, map alternatives and taste sliders. On iOS: VoiceOver, Dynamic Type, Reduce Motion and reasonable targets. On Android: TalkBack, font scaling and 48dp touch targets. On both: 200% scaled text scan for clipping; no text embedded in screenshots; strong price contrast; focus visible; motion-reduced alternative to swipes/roulette.

## 15.4 Content/data acceptance checks

- **Authenticity:** exact dish photo provenance, logo source and rights, no synthetic/stock image misrepresentation.
- **Completeness:** dish price as of date/source, stall location/operating hours, optional contact; no silent defaults.
- **Dietary truthfulness:** classifications trace to merchant verified label or credible source, disputed/unknown status surfaced; allergens treated separately from cuisine/taste guesswork.
- **Social truthfulness:** ratings from actual approved reviews, display counts only with reliable aggregation and sufficient sample context, reports/removals reflected.
- **Geographic truthfulness:** floor/unit present only if verified; map pin uncertain if coordinates approximate; "nearby" calculated relative to selected area or permitted device location.
- **Freshness:** menu update time, edited photo consistency, closure notice expiry; invalidated cache and user-visible refresh result.
- **Permissions:** per-role merchant edits, draft/published separation, audit log and accessible rollback.

# 16. References and source map

The following sources were retrieved or reviewed for this report. **Source-specific findings** are cited where used; product/design extrapolations are explicitly ours. Research covers interface principles and official documentation, not independent instrumented comparisons of every competitor's October 2026 build.

### External UX and product research

[1] Nielsen Norman Group, *10 Usability Heuristics for User Interface Design*. https://www.nngroup.com/articles/ten-usability-heuristics/

[2] Baymard Institute (13 Aug 2026), *Food Delivery & Takeout UX Benchmark: 3,100+ Performance Scores and 1,900+ Best Practice Examples*. https://baymard.com/research-articles/food-delivery-and-takeout-ux-benchmark-2026

[3] Baymard Institute, *Food Delivery & Takeout Ecommerce UX Research*. https://baymard.com/research/online-food-delivery

[4] Apple Developer, *Human Interface Guidelines — Tab Bars* (updated 2026). https://developer.apple.com/design/human-interface-guidelines/tab-bars

[5] W3C WAI, *Understanding SC 2.5.8 Target Size (Minimum)*. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum

[6] Google Maps Help, *Add & explore dishes in Google Maps*. https://support.google.com/maps/answer/7321152?hl=en

[7] Airbnb (2025), *Understanding Guest Favorites*. https://www.airbnb.com/resources/hosting-homes/a/understanding-guest-favorites-642

[8] TikTok, *Why and how the For You feed recommends content*. https://support.tiktok.com/en/getting-started/for-you/test-for-you

[9] Spotify Engineering (2026), *Why we use separate tech stacks for personalization and experimentation*. https://engineering.atspotify.com/2026/1/why-we-use-separate-tech-stacks-for-personalization-and-experimentation

[10] YouTube, *On YouTube's recommendation system*. https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/

[11] Duolingo, *Improving the streak*. https://blog.duolingo.com/improving-the-streak/

[12] Android Developers, *Navigation bar component*. https://developer.android.com/develop/ui/compose/components/navigation-bar

[13] Android Developers, *Accessibility foundations*. https://developer.android.com/design/ui/mobile/guides/foundations/accessibility

[14] Baymard Institute, *Ecommerce Search UX research*. https://baymard.com/research/eCommerce-search

[15] Jon Yablonski, *Laws of UX — Hick's Law*. https://lawsofux.com/hicks-law/

[16] Nielsen Norman Group, *Progressive Disclosure*, Jakob Nielsen. https://www.nngroup.com/articles/progressive-disclosure/

[17] Nielsen Norman Group, *Button States: Communicate Interaction* (primary, secondary and tertiary button emphasis). https://www.nngroup.com/articles/button-states-communicate-interaction/

### Hungry project/source evidence

[H1] GitHub repository and README: https://github.com/siewhean/Hungry

[H2] Current navigation: https://github.com/siewhean/Hungry/blob/main/src/app/navigation/SwipeableTabNavigator.tsx

[H3] Current route definitions: https://github.com/siewhean/Hungry/blob/main/src/app/navigation/navigationTypes.ts

[H4] Production flags: https://github.com/siewhean/Hungry/blob/main/src/constants/featureFlags.ts

[H5] Discover source: https://github.com/siewhean/Hungry/blob/main/src/app/screens/discover/DiscoverHomeScreen.tsx

[H6] Home feed source: https://github.com/siewhean/Hungry/blob/main/src/app/screens/home/HomeFeedScreen.tsx

[H7] Search/results: https://github.com/siewhean/Hungry/blob/main/src/app/screens/search/SearchResultsScreen.tsx

[H8] Dish detail: https://github.com/siewhean/Hungry/blob/main/src/app/screens/detail/DishDetailScreenV2.tsx

[H9] Stall detail: https://github.com/siewhean/Hungry/blob/main/src/app/screens/detail/StallDetailScreen.tsx

[H10] Implicit collector (disabled): https://github.com/siewhean/Hungry/blob/main/src/hooks/useImplicitSignalCollector.ts

[H11] Design system reference: https://github.com/siewhean/Hungry/blob/main/docs/DESIGN_STANDARDS.md

[H12] Historical app-performance plan: https://github.com/siewhean/Hungry/blob/main/tasks/Roadmap/Frontend/hungry_app_performance_optimization_plan.md

[H13] Historical accessibility QA (25 June 2026): https://github.com/siewhean/Hungry/blob/main/tasks/Roadmap/app-accessibility-qc-report.md

[H14] Historical app-screen QA (25 June 2026): https://github.com/siewhean/Hungry/blob/main/tasks/Roadmap/app-screen-qc-checklist.md

[H15] Existing merchant surfaces: https://github.com/siewhean/Hungry/tree/main/src/app/screens/merchant

# 17. Hick's Law: one clear primary action and context-aware choices

> **Mandatory new Hungry design policy (22 October 2026).** Every screen should help users understand *what to do next* immediately. Expose only the choices relevant to the current task, emphasize one primary action, and progressively disclose advanced functionality. This policy applies to consumer and merchant screens and to empty, loading, error, signed-out and success states.

## 17.1 What Hick's Law means for Hungry

**Hick's Law (Hick–Hyman Law)** describes how choice/reaction time tends to increase with the number of possible responses and their complexity. A common simplified form is `T = a + b log2(n + 1)` for **roughly equally likely, familiar simple choices**; `a` and `b` depend on the situation and should **not** be treated as Hungry performance constants. The operational lesson is not "always show fewer buttons". It is **reduce unnecessary decisions at the moment users are trying to act**, and make meaningful alternatives clearly distinct [15].

For Hungry, the decisive moment is often "I want to eat something" → "this is the dish" → "this is where I can get it". If Discover simultaneously promotes **Decide for Me**, **Hungry Wheel**, **Stalls & Restaurants**, **Dishes**, **Quick Bites**, **Popular**, and numerous filters as equal competitors, users must first decide *which feature to use*, before choosing food. An attractive screen can still create excessive decision load.

**Design with user intent, not raw item count:** when someone wants to browse, show recognizable dish cards; when they want a surprise, surface one helpful surprise action; when they want to save, save first and organize later; when they want directions, make directions immediately obvious. Many food results may be necessary for good comparison—do not hide useful food inventory just to lower the visible count. Strong category labels, recognizable food photos, relevance sorting and progressive filters can make a long list easier than several layers of menus [15–16].

## 17.2 Five non-negotiable rules

| Rule | Hungry implementation requirement | Good illustration | Violation to remove |
|---|---|---|---|
| **1. Give every screen one obvious primary action.** | Define the primary user job and primary next-step CTA **per state**, not only per route. A browse-oriented screen may make Search its primary affordance; a transactional editor uses Save/Publish. | Dish detail → **Directions** when the user is deciding where to eat; review editor → **Publish review** when valid. | Two unrelated large CTA banners dominating one first viewport. |
| **2. Your main button should look more important than everything else around it.** | Primary uses the strongest approved filled treatment, clear verb label, large accessible tap area, and placement near relevant content. Secondary actions get quiet outlines/text/icon treatments. | Filled **Get directions** with outlined **Save**. | Orange **Skip** competing with a user's intended recommendation; global center + competing with screen CTA. |
| **3. Hide advanced options until someone actually needs them.** | Use progressive disclosure: common options immediately visible; advanced sort, 6-axis taste tuning, playlist/music, custom lists and bulk merchant tools behind clearly labeled expandable affordances or later steps. | **Filters** sheet opens advanced taste sliders while nearby/budget/dietary essentials remain easy to find. | All taste sliders, every sort, every sharing option and every optional field shown at once. |
| **4. Never have two buttons that look equally important.** | Within the same choice group, have at most one high-emphasis primary. Use an explicit hierarchy: **primary → secondary → tertiary/destructive**. Exception: when users must make genuinely symmetric choices, show neutral equal-weight choices and do not pretend one is preferred. | **Directions** filled, **Save** outlined, **Share** icon. | **Decide for Me** and **Hungry Wheel** presented as equally prominent feature CTAs. |
| **5. If an option isn't relevant yet, don't show it.** | Render controls only when the user is eligible and the necessary state/data exists; remove premature steps and inactive experimental features. Preserve clear explanations when an expected option is unavailable. | Only show **Order delivery** when a valid delivery link exists; only show **Save changes** as actionable after valid edits; show **Retry** if data fails. | Empty **Photos**, unusable **Review all**, irrelevant merchant actions in guest discovery, or unsupported hours/ratings presented as facts. |

**Important exception:** hiding *advanced* controls must never conceal safety-critical facts, dietary/allergen warnings, uncertainty about data, the ability to change area or remove a restrictive filter, accessible controls, or a necessary recovery route. "Not relevant" means not useful to this user's current task/state—not a rationale for obscuring choice or forcing a conversion. Non-primary actions must remain findable.

## 17.3 Primary, secondary and tertiary treatment

| Treatment | Visual/interaction contract | Eligible Hungry actions |
|---|---|---|
| **Primary** | **Exactly one prominent action within a screen's active task region**; strongest fill from the existing theme (typically Hungry Orange), unambiguous verb, reachable and accessible; when disabled, explain why. | **Search dishes**, **Directions**, **Publish review**, **Save menu changes**, **Add first photo**, **Retry** on a blocking error. |
| **Secondary** | Outline, tonal fill, subdued surface; still obviously interactive and accessible. | **Save dish**, **Try another**, **Choose area**, **Preview**, **Cancel**, **Follow**. |
| **Tertiary** | Text link, icon with accessible label, overflow menu or disclosure control. | **Share**, **Add to list**, **Advanced taste filters**, **See all**, **Edit dietary preferences**, **More options**. |
| **Destructive** | Clearly labeled destructive treatment, separated from primary positive actions; confirm irreversible results. | **Delete account**, **Delete dish**, **Remove collaborator**, **Discard draft**. |
| **Contextual/conditional** | Hidden when not relevant; otherwise revealed adjacent to content or after intent is indicated. Unavailable expected actions receive an explanation or alternate path rather than a dead end. | Merchant verification/claim, delivery deep links, music for posts, OCR draft cleanup, floorplan details, allergy-source details. |

A global floating action button and a page-level filled CTA can accidentally create **two simultaneous primary actions**. If the screen has a local task (review, save, editing, location permission), the global Create + should be suppressed, visually demoted or not presented in that route. Likewise, a button can be **selected**, **disabled**, **loading**, or **pressed** without changing its *hierarchical role* [17].

## 17.4 Application to the 20 supplied Hungry screenshots

This table applies the five rules to the actual screenshot set supplied for the visual review on 22 October 2026. These are proposed primary actions for the relevant *screen state*, not assertions about the current implementation or a universal guarantee that Directions always outranks Save.

| Screen | One recommended primary action | Make secondary or progressively reveal | Do not surface until relevant |
|---|---|---|---|
| **01 Home** | **Find a dish** (search or dish-first recommendation) | Weekly picks and social feed become subordinate food-discovery sections | Large empty/black media cards; disabled content actions |
| **02 Decide for Me** | **Get directions** after an eligible recommendation | **Save** outlined; **Try another** as quiet link; taste explanation collapsible | Unsupported exact match percentages or unavailable route |
| **03 Dish Detail** | **Directions** for a nearby available dish; adjust CTA if context changes | **Save** as outline, **Reviews** tab, advanced taste metrics collapsed | Delivery button without valid URL; inaccurate rating/hours/photos |
| **04 Stall Detail** | **View menu** on entry (or **Directions** when in location-finding context) | Save/Follow/Share as quiet actions, portfolio/checklist in a Save sheet | Contact links with no data; owner tools for ordinary consumers |
| **05 Review Composer** | **Publish review** once required review fields are valid | Taste tags and photo optional; **Not sure**/recommend choices equal neutral selectors, not competing CTAs | Music, advanced tagging or sharing until user asks |
| **06 Activity Inbox** | **Open latest relevant unread item** as the primary next action, not a giant CTA | Messages/Updates tabs; mark all read in overflow | Unread badges when count is zero; messaging when feature gated |
| **07 Chat Detail** | **Send message** when composed | Attach dish/stall via an optional affordance | Send enabled on blank input; unrelated sharing controls |
| **08 Public User Profile** | **Follow** (or **Following**, clear reversible state) | Posts and reviews organized below a compact header | Blank oversized media blocks; private-only actions |
| **09 Discover** | **Search dishes** / tap an eligible real food result | **Decide for Me** secondary; **Wheel** below fold; Browse Stalls as category | “Nearby” labels when location data cannot support them |
| **10 Reviews Feed** | **Open reviewed dish** | Like/Save/Comment as compact row; Report/Block in overflow | Empty social controls without underlying permissions/backing data |
| **11 Profile** | **Open Saved food** for the primary repeat-visit task | Passport, Missions, Followers and menus below identity/saves | Merchant entry for unverified accounts; unreleased gamification |
| **12 Settings** | **Change the selected setting**; page need not invent a giant CTA | Less-used settings grouped below high-frequency privacy/preferences | Save button if toggles auto-save; irrelevant merchant/account options |
| **13 Review History** | **View past reviews** when available; **Write a review** in genuinely empty state | Sorting and detailed filters only with content | “No reviews” when data elsewhere confirms a review |
| **14 Saved Dishes** | **Open a saved dish** | Sort/Filter as compact controls; organizing into lists after save | Empty Reviewed tab as equal emphasis without content; irrelevant filters |
| **15 Edit Profile** | **Save changes** only when valid changes exist | **Retake taste quiz** as secondary, profile photo edit contextual | Active Save button when nothing changed |
| **16 Passport** | **Explore next eligible trail** | Stamp gallery and portfolio history secondary | Achievements without qualifying verified actions |
| **17 Weekly Missions** | **Continue next relevant mission** | Other missions as compact rows; reward details on demand | Missions impossible due to gated features or unavailable data |
| **18 Add a Stall** | **Continue** current step; **Submit stall** on final verified step | Address/unit/photo details organized into progressive steps; advanced metadata collapsed | Submit before required data; duplicated venue creation if match exists |
| **19 Create Post** | **Choose media** at start; **Publish post** once ready | Tag dish as contextual optional search, not compulsory first screen unless launched from a dish | Composer controls that cannot yet be used; generic Choose on every row |
| **20 Discover variant** | **Search dishes / Explore nearby food** | Under-budget/Halal as visible quick filters; Wheel and advanced browse as secondary | “0 places” + “nearby” claims shown together without scope explanation |

**Cross-screen rule:** A browse screen need not display a giant filled button on every viewport. The primary action can be a dominant search field or a clearly tappable food card. Conversely, when there is a discrete submission or navigation decision, use one filled CTA. Avoid artificial extra steps merely to achieve one button.

## 17.5 Progressive disclosure: what appears *when*

| Moment | Show immediately | Reveal only on intent | Never withhold |
|---|---|---|---|
| First app launch | Area selection, browse food, one useful next step | Full taste quiz, notifications, account sync benefits | Guest/manual-location path and permission explanation |
| Discover before query | Search, 2–4 useful quick filters, authentic visible dishes | 6-axis palate tuning, all cuisine tags, advanced sorting, Wheel | Clear filter reset and result scope |
| After filter applied | Active chips, eligible dish results, easy remove/reset | Explanation of complex ranking, advanced refinements | Dietary constraints, uncertainty, reason for zero results |
| Dish detail | Food identity, price, stall/location, current eligibility and useful CTA | Complete taste model, long reviews, photo gallery | Relevant allergy/source warning and invalid-hours uncertainty |
| On Save | Saved confirmation | Add to list, share list, custom collection labels | Ability to undo accidental save |
| Review/post compose | Relevant item/media, simple required step, publish | Music, advanced tags, audience/reposting options | Privacy choice, mandatory content/safety controls |
| Profile | Saved, own reviews, important identity | Passport, missions, deep preferences, creator statistics | Account/privacy access |
| Merchant editing | Name, price, photo, availability, publish result | Bulk operations, OCR, analytics, scheduled promotions | Validation, unsaved-change warning, verification status |

**Staging criterion:** a control must be *visible* only if it is useful at this step and *enabled* only if its action is feasible. For a common, expected function temporarily unavailable, show a meaningful status or supported alternative rather than making the app appear broken.

## 17.6 Acceptance criteria, QA and measurement

Before each redesigned screen is approved, the designer and engineer should complete the following checks:

1. **Primary-action specification:** write down the user's job and the primary action for default, loading, empty, error, offline, guest, signed-in and successful states. A passive information screen may prioritize one obvious next step without adding a gratuitous filled button.
2. **Hierarchy test:** on a five-second first impression, new participants should reliably identify the intended next action. Any two nearby filled controls of equal prominence trigger a design review; symmetric answers in a questionnaire are deliberately neutral choices, not two primary CTAs.
3. **Relevance test:** zero visible *actionable* buttons that do nothing; zero unsupported delivery/location/review claims; no gated merchant, messaging or game actions outside approved contexts. Explain expected unavailable functions rather than silently hiding important reasons.
4. **Progressive-disclosure test:** necessary everyday actions and critical safety/permission details appear without extra taps; expert options are available from clearly labeled controls and remembered during the task.
5. **Return/repeat journey test:** after Save, filtering, browsing details or opening an advanced sheet, Back returns to the same query, location, filters, list mode and scroll position. Closing an optional sheet should never discard the main task.
6. **Accessibility test:** primary action distinguishable without color alone, labeled for screen readers, reachable with keyboard/switch control, touch target sufficiently large, and not obscured by the keyboard or sticky navigation.
7. **Experiment:** compare baseline and revision for task-success rate, time to *correct* first action, hesitation/mis-taps, full-journey completion and confidence, alongside guardrails for content diversity and creation rates. Avoid interpreting fewer taps in isolation as inherently superior UX.

**Suggested priority:** P0 for Home, Discover, Dish/Stall detail, Review Composer and conflicting saved/review states; P1 for Profile, Saved, Create Post and Add Stall; P2 for gated Passport, Missions, Wheel and merchant expansion. The next design review should reject ambiguous equal-weight CTAs, unrelated default content, and any advanced panel that conceals a frequently needed action.

**Research grounding:** Hick's Law's design interpretation [15], Nielsen Norman Group's progressive-disclosure guidance [16], and primary-versus-secondary button hierarchy [17]. These are design principles, **not** evidence that applying them mechanically will make Hungry faster; measure the actual dish-decision journey.

# 18. Bottom line

The best evolution of Hungry is not "more like TikTok," "more like Grab" or "make everything 3D." It is **a focused, trustworthy Singapore food decision product with exceptional local data, real food imagery, rapid interaction and just enough personalization**. The highest priority is to shorten the first ten seconds, surface relevant dishes, make comparisons easy, preserve back-navigation context and translate an appealing dish into a real-world next step.

**Do first:** user-test dish-first Home and simpler navigation; unify cards/images; fix perceived lag; strengthen search, trust and guest access. **Do next:** saved food retrieval, contextual quick reviews and transparent taste learning. **Gate until proven:** advanced social, game mechanics, merchant release and any feature whose data or privacy handling is not production-ready.

**Final caveat:** This is a research-, source-code- and supplied-screenshot-informed action plan, not a live instrumented usability audit or a claim that every state has been visually inspected in running builds. The 20 supplied iOS screenshots enable a useful heuristic critique; definitive iOS/Android behavior still requires screen recordings, test builds, accessibility sessions and runtime performance traces before shipping. See §17 for the new mandatory decision-hierarchy policy.
