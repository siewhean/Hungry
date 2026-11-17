# Checklist, Portfolio, and Passport Guide

Updated: 2026-05-27

Scope: user, admin, and service/API reference for the Hungry checklist, portfolio, and passport features.

## User Guide: Checklists

Checklists are private saved lists for food or stall planning.

- Open Profile, then choose `My Checklists`.
- Create a checklist with a short name such as `Want to Try`.
- Add a dish, stall, or custom note from the checklist item picker.
- Optional `Planned visit date` and `Reminder` fields can be added while saving an item.
- Dish and stall detail pages also provide `Add to Checklist`.
- Mark an item as tried after visiting or eating it.
- Reorder controls include both explicit up/down buttons and a drag handle; partial reorder
  requests are still rejected by the store and service.
- If a referenced dish or stall is no longer available in the local catalogue, detail screens show `Deleted dish` or `Deleted stall` instead of failing.

Offline behavior:
- Checklists and checklist items are persisted locally.
- If a network-backed load fails and cached data exists, the store keeps the cached list visible.
- Write operations still need the active service path to succeed; failed writes surface as errors instead of silently changing server state.

## User Guide: Portfolios

Portfolios are curated food lists that can remain private or be published.

- Open Profile, then choose `Hungry Portfolios`.
- Create a portfolio with a type: recommendation, ranking, trail, or collection.
- Choose visibility: private, followers-only, or public.
- Add dishes or stalls from the portfolio item picker.
- Ranking items support scores from 1 to 10 only.
- Owner rows include explicit reorder controls and a drag handle for ranking polish.
- Duplicate dish or stall entries in the same portfolio are blocked in the store, mock service, and database migration.
- Publish a portfolio to make it public and earn passport contribution progress.
- Public portfolios can be followed or flagged.

Offline behavior:
- Portfolios, portfolio items, collaborators, and follow status are persisted locally.
- If a network-backed read fails and matching cached data exists, the store keeps the cached data visible.
- Follow status is scoped to the signed-in user in the Supabase service path.

## Admin Guide: Portfolio Moderation

Portfolio flags support a minimal moderation queue.

- Users can flag public portfolios for spam, inappropriate, misleading, or other reasons.
- A user can only have one pending flag for the same portfolio.
- The database migration adds a rate-limit trigger for flag creation.
- Ops/admin review access is gated by `public.app_is_current_user_ops_admin()`.
- Admins can resolve a flag as dismissed or removed.

Operational checks:
- Run `supabase/smoke/checklist_portfolio_passport.sql` against staging before enabling the feature publicly.
- The smoke returns rows only for missing controls.
- Critical failures include disabled RLS, missing hardened functions, or unsafe direct insert privileges.

## Service/API Reference

Primary app access should go through `getHungryService()`.

Checklist namespace:
- `createChecklist(name)`
- `getChecklists()`
- `getChecklist(id)`
- `updateChecklist(id, name)`
- `deleteChecklist(id)`
- `addChecklistItem(input)`
- `getChecklistItems(checklistId)`
- `updateChecklistItem(id, updates)`
- `markChecklistItemTried(id)`
- `deleteChecklistItem(id)`
- `reorderChecklistItems(checklistId, itemIds)`

Portfolio namespace:
- `createPortfolio(input)`
- `getPortfolios(filters)`
- `getPortfolio(id)`
- `updatePortfolio(id, updates)`
- `deletePortfolio(id)`
- `publishPortfolio(id)`
- `addPortfolioItem(input)`
- `getPortfolioItems(portfolioId)`
- `updatePortfolioItem(id, updates)`
- `deletePortfolioItem(id)`
- `reorderPortfolioItems(portfolioId, itemIds)`
- `addPortfolioCollaborator(portfolioId, userId, role)`
- `removePortfolioCollaborator(portfolioId, userId)`
- `getPortfolioCollaborators(portfolioId)`
- `followPortfolio(portfolioId)`
- `unfollowPortfolio(portfolioId)`
- `getPortfolioFollows(portfolioId)`
- `isFollowingPortfolio(portfolioId)`
- `flagPortfolio(portfolioId, reason, details)`
- `getPortfolioFlags(filters)`
- `resolvePortfolioFlag(flagId, resolution)`
- `searchPortfolios(query, filters)`

Passport namespace:
- `getPassportStamps()`
- `getPassportProgressEvents(categoryId?)`

Supabase RPCs:
- `add_portfolio_item_with_passport(...)`
- `publish_portfolio_with_passport(...)`
- `reorder_checklist_items(...)`
- `reorder_portfolio_items(...)`
- `search_portfolios(...)`

Security notes:
- `portfolio_items` direct authenticated insert is revoked; add items through the checked RPC.
- `passport_progress_events` direct authenticated insert is revoked; contribution events are written by checked server functions.
- All security-definer functions pin `search_path = public`.
- The migration adds partial unique indexes for duplicate dish/stall checklist and portfolio entries.
