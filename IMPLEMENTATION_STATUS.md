# Checklist, Portfolio, and Passport Implementation Progress

## Completed (Phase 1: Foundation)

### 1. Database Schema ✅

- **File**: `supabase/migrations/20260527103000_checklist_portfolio_passport.sql`
- **Tables Created**:
  - `checklists` - User checklists with name and timestamps
  - `checklist_items` - Polymorphic items (dish/stall/custom) with reminder/planned dates
  - `portfolios` - User portfolios with type, visibility, and publish state
  - `portfolio_items` - Polymorphic items with score, public/private notes
  - `portfolio_collaborators` - Viewer/editor roles
  - `portfolio_follows` - Independent portfolio following
  - `portfolio_flags` - Moderation system with reason and status
  - `passport_progress_events` - Event sourcing for passport progress
- **Extensions**: Added `portfolio_items_added`, `public_portfolios_published`, `trails_completed` columns to `passport_stamps`
- **Indexes**: Proper indexes on foreign keys, position columns, and query patterns
- **Constraints**: Type checks, polymorphic validation, unique constraints

### 2. RLS Policies ✅

- **Checklists**: Private to owner (all CRUD operations)
- **Checklist Items**: Inherit checklist ownership
- **Portfolios**: Visibility-based access (public, followers_only with user_follows check, owner, collaborators)
- **Portfolio Items**: Inherit portfolio visibility, owner/editor can modify
- **Portfolio Collaborators**: Owner manages, all can view if can view portfolio
- **Portfolio Follows**: Users manage own follows, all can view
- **Portfolio Flags**: Users flag public portfolios, admins review
- **Passport Events**: Users view own events, system can insert

### 3. Backend Functions ✅

- `record_passport_progress()` - Insert event and update stamp counters
- `add_portfolio_item_with_passport()` - Add item with automatic passport progress
- `publish_portfolio_with_passport()` - Publish and record progress for all categories
- `reorder_checklist_items()` - Batch position updates
- `reorder_portfolio_items()` - Batch position updates
- `search_portfolios()` - Full-text search with visibility filtering
- `update_updated_at_column()` trigger for all tables

### 4. TypeScript Types ✅

- **File**: `src/types/domain.ts`
- **Types Added**:
  - `Checklist`, `ChecklistItem`, `ChecklistItemType`
  - `Portfolio`, `PortfolioItem`, `PortfolioType`, `PortfolioVisibility`, `PortfolioItemType`
  - `PortfolioCollaborator`, `PortfolioCollaboratorRole`
  - `PortfolioFollow`, `PortfolioFlag`, `PortfolioFlagReason`, `PortfolioFlagStatus`
  - `PassportStamp` (extended), `PassportProgressEvent`, `PassportEventType`

### 5. Service Layer Types ✅

- **File**: `src/lib/services/types.ts`
- **Input Types**: `ChecklistItemCreateInput`, `PortfolioCreateInput`, `PortfolioItemCreateInput`
- **DataRepository Extensions**: 50+ optional methods for checklist/portfolio/passport operations
- **HungryService Extensions**:
  - `checklist` namespace with 11 methods
  - `portfolio` namespace with 20 methods
  - `passport` namespace with 2 methods

### 6. State Management ✅

- **File**: `src/store/useChecklistStore.ts` - Full CRUD for checklists and items with AsyncStorage persistence
- **File**: `src/store/usePortfolioStore.ts` - Full CRUD for portfolios, items, collaborators, follows with AsyncStorage persistence
- **File**: `src/store/usePassportStore.ts` - Extended existing store with database-backed stamps and events

### 7. Navigation Types ✅

- **File**: `src/app/navigation/navigationTypes.ts`
- **ProfileStackParamList**: Added 10 new routes (ChecklistsHome, ChecklistDetail, ChecklistItemPicker, PortfoliosHome, PortfolioDetail, PortfolioCreate, PortfolioEdit, PortfolioItemPicker, PortfolioCollaborators, PortfolioSearch)
- **RootStackParamList**: Added 4 new routes (ChecklistDetail, PortfolioDetail, PortfolioPublicView, AdminPortfolioFlags)

### 8. Screen Components (Started) ✅

- **File**: `src/app/screens/checklist/ChecklistsHomeScreen.tsx` - List view with create/navigate (✅ Complete with correct imports and theme usage)

---

## Completed Work (Phase 2: Implementation)

### 1. Service Layer Implementation ✅

**Priority: CRITICAL** - Nothing works without this

- [x] `src/lib/services/mock/mockService.ts` - Implement all checklist/portfolio/passport methods with in-memory data
- [x] `src/lib/services/supabase/supabaseService.ts` - Implement all methods with Supabase client calls
- [x] Wire up service methods to call backend functions and RLS-protected tables
- [x] Fix TypeScript type errors and null checks

**2026-05-26 correction**: The document previously marked this phase complete while the mock
service still returned empty arrays/no-op mutations. The mock checklist/portfolio methods now
persist checklists, items, reorder state, portfolios, portfolio items, collaborators, follows,
flags, search results, duplicate prevention, and score validation in memory.

### 2. Screen Components ✅

**Priority: HIGH** - User-facing features

- [x] `ChecklistDetailScreen` - View/edit checklist, manage items, manual reorder controls and drag-handle reorder polish
- [x] `ChecklistItemPickerScreen` - Search dishes/stalls, add custom text, and add optional planned visit/reminder fields
- [x] `PortfoliosHomeScreen` - Tabs for My/Following/Discover, local search, create/search entry points
- [x] `PortfolioDetailScreen` - View/edit portfolio, manage items, collaborators entry, follow/flag, publish
- [x] `PortfolioCreateScreen` - Create new portfolio with type/visibility
- [x] `PortfolioEditScreen` - Edit portfolio metadata
- [x] `PortfolioItemPickerScreen` - Search dishes/stalls, add score/notes
- [x] `PortfolioCollaboratorsScreen` - Manage collaborators with roles
- [x] `PortfolioSearchScreen` - Search public portfolios
- [x] `PortfolioPublicViewScreen` - Read-only public portfolio view with follow
- [x] `AdminPortfolioFlagsScreen` - Admin moderation queue
- [x] `PassportScreen` - Shows portfolio contribution stats and recent portfolio activity

### 3. UI Components ✅

**Priority: MEDIUM** - Reusable building blocks

- [x] `ChecklistCard` - Display checklist summary
- [x] `ChecklistItemRow` - Display item with tried checkbox and reorder controls
- [x] `PortfolioCard` - Display portfolio summary with type/status metadata
- [x] `PortfolioItemRow` - Display item with score, notes, and owner controls
- [x] `PortfolioTypeSelector` - Radio group for portfolio types
- [x] `PortfolioVisibilitySelector` - Radio group for visibility
- [x] `CollaboratorRow` - Display collaborator with role label and remove action

### 4. Navigation Integration ✅

**Priority: HIGH** - Wire up routes

- [x] Add ProfileStack routes to ProfileNavigator
- [x] Add RootStack routes to RootNavigator for public portfolio/admin flags
- [x] Add deep linking support for portfolio sharing (`portfolio/:portfolioId`)
- [x] Add navigation from DishDetail/StallDetail to add to checklist/portfolio

### 5. Integration Points ✅

**Priority: MEDIUM** - Connect to existing features

- [x] DishDetailScreen - Add "Add to Checklist" and "Add to Portfolio" buttons
- [x] StallDetailScreen - Add "Add to Checklist" and "Add to Portfolio" buttons
- [x] ProfileHomeScreen - Add "My Checklists" and "Hungry Portfolios" profile menu entries
- [x] PassportScreen - Display portfolio contribution stats

**2026-05-26 update**: Active dish and stall detail pages now render a shared save card.
The actions require auth, create/reuse default user-owned targets (`Want to Try` checklist
and `Hungry Picks` private portfolio), prevent duplicate local adds, track item-added
analytics, and fix Supabase snake_case/user ownership mapping so RLS-backed writes work.

### 6. Search Implementation ✅

**Priority: LOW** - Can use basic filtering initially

- [x] Implement trigram search for portfolio names/descriptions
- [x] Add search indexing in migration
- [x] Wire up search UI in PortfolioSearchScreen

**2026-05-27 update**: `search_portfolios()` now uses the portfolio name/description trigram index
and trigram similarity ranking while preserving visibility filtering.

### 7. Analytics Events ✅

**Priority: LOW** - Track usage

- [x] checklist_created, checklist_item_added, checklist_item_tried
- [x] portfolio_created, portfolio_published, portfolio_item_added
- [x] portfolio_followed, portfolio_flagged
- [x] passport_stamp_earned (portfolio contributions)

**2026-05-27 update**: Checklist and portfolio stores now own analytics emission so detail
save actions do not double count item-added events. Passport progress now tracks newly earned
stamp events.

### 8. Testing ✅

**Priority: MEDIUM** - Ensure quality

- [x] Unit tests for stores (useChecklistStore, usePortfolioStore)
- [x] Integration tests for service layer mock checklist/portfolio CRUD flows
- [x] E2E tests for critical flows (create checklist, create portfolio, publish portfolio)
- [x] RLS policy/static smoke tests in Supabase

**2026-05-27 update**: Added focused store tests for checklist and portfolio analytics,
duplicate prevention, score validation, tried-state tracking, and complete-list reorder guards.
Added `supabase/smoke/checklist_portfolio_passport.sql` to verify RLS, grants, search-path
hardening, duplicate indexes, and unsafe direct insert privileges in staging/local Supabase.
Linked RLS smoke execution is complete. E2E app coverage verifies creating a checklist and
creating/publishing a portfolio from the Profile quick-access menu. The E2E pass also fixed
the Profile quick-access menu layering bug and the mock-auth ownership mismatch that caused
new portfolios to render as non-owner content.

### 9. Edge Cases & Error Handling ✅

**Priority: MEDIUM** - Production readiness

- [x] Handle offline mode for checklists/portfolios
- [x] Handle concurrent edits to portfolios
- [x] Handle deleted dishes/stalls in checklist/portfolio items
- [x] Handle portfolio owner deletion (transfer or cascade)
- [x] Handle collaborator removal while editing
- [x] Validate score range (1-10) for ranking portfolios
- [x] Prevent duplicate items in same portfolio
- [x] Rate limiting for portfolio creation/flagging

**2026-05-27 update**: Checklist and portfolio stores now keep cached data visible when
network-backed reads fail and cached data exists. Detail screens show deleted dish/stall
fallback labels instead of failing on missing catalogue references. Portfolio owner deletion
uses cascading foreign keys. Duplicate dish/stall entries are blocked in stores, mock service,
and new partial unique indexes. Portfolio creation and flagging now have database trigger
rate limits, and pending duplicate flags are blocked. Supabase follow status is now scoped to
the signed-in user. Portfolio mutations now carry an `expectedUpdatedAt` guard through the
store, mock service, Supabase service, and version-aware RPCs. Stale edits refresh the latest
portfolio, record a conflict banner state, and block the outdated mutation until the user
reviews the latest version.

### 10. Documentation ✅

**Priority: LOW** - Can be done last

- [x] User guide for checklists
- [x] User guide for portfolios
- [x] Admin guide for moderation
- [x] API documentation for service methods

**2026-05-27 update**: Added `tasks/checklist-portfolio-passport-guide.md` with user,
moderation, service/API, offline, and security notes.

---

## Next Steps

- No required implementation steps remain for checklist/portfolio/passport.
- Optional environment parity: start local Docker/Supabase later and run a local reset/smoke if local parity proof is needed.

---

## Estimated Effort

- **Phase 1 (Foundation)**: ✅ COMPLETE (~4 hours)
- **Phase 2 (Service Layer)**: ✅ COMPLETE (~3 hours)
- **Phase 3 (Core Screens)**: ✅ COMPLETE for core route surfaces and app-side drag/reminder polish
- **Phase 4 (Reusable UI + Integration)**: ✅ COMPLETE
- **Phase 5 (Polish & Testing)**: ✅ COMPLETE - analytics, docs, store tests, DB uniqueness/rate-limit/search hardening, offline cache fallback, static Supabase smoke, E2E app flows, concurrent-edit conflict handling, reminder fields, drag-handle reorder polish, linked migration apply, and linked smoke proof are complete

**Total Remaining**: none

---

## Migration Status

**Migration Files**:

- `supabase/migrations/20260527103000_checklist_portfolio_passport.sql`
- `supabase/migrations/20260527104500_checklist_portfolio_passport_grant_fix.sql`

**Status**: ✅ Created, Phase 5-hardened, applied to linked remote, and smoke-verified

**2026-05-27 verification**:

- The checklist/portfolio/passport migration was renamed from the duplicate local `0043`
  version to `20260527103000_checklist_portfolio_passport.sql` because linked migration
  history already contains `0043_canonical_food_business_staging.sql`.
- Linked `supabase db push --include-all` applied:
  `20260524041000_merchant_popular_visitor_pins.sql`,
  `20260525120301_merchant_analytics_foundation.sql`,
  `20260527090000_discover_area_venue_count.sql`, and
  `20260527103000_checklist_portfolio_passport.sql`.
- The first linked push exposed an existing-RPC signature issue in
  `20260525120301_merchant_analytics_foundation.sql`; preserving
  `p_session_id text default null` resolved it before the migration was applied.
- Linked smoke found direct authenticated insert grants on `portfolio_items` and
  `passport_progress_events`; follow-up migration
  `20260527104500_checklist_portfolio_passport_grant_fix.sql` revokes those direct inserts
  while keeping checked RPC writes available.
- `supabase migration list --linked` shows all local migrations through
  `20260527104500` applied on the linked remote.
- `supabase db push --dry-run --include-all` reports `Remote database is up to date`.
- `supabase db query --linked -f supabase/smoke/checklist_portfolio_passport.sql`
  returns zero findings.
- Adjacent applied migration smokes also passed:
  `supabase/smoke/merchant_analytics_foundation.sql` returned zero findings and
  `supabase/smoke/discover_area_venue_count.sql` returned `nearby_venue_count = 6684`.
- Local Supabase remains unavailable because Docker is not running, but linked apply/smoke
  now proves the remote schema state.

**Reapply/Recovery Reference**:

```bash
# Linked status
supabase migration list --linked
supabase db push --dry-run --include-all

# Linked smoke
supabase db query --linked -f supabase/smoke/checklist_portfolio_passport.sql
```
