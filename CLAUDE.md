# Claude Entrypoint - Hungry

Purpose: give Claude the smallest useful project map before it reads any large files. Keep this file stable and concise so repeated Claude sessions can reuse/cache the same prefix. Put volatile status in `tasks/backlog.md`, `tasks/verification.md`, and `tasks/session-log.md`, not here.

Token design basis: Anthropic recommends placing stable reusable context first for prompt caching, using direct structured prompts, and managing long context explicitly. See:
- https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
- https://docs.anthropic.com/en/docs/build-with-claude/context-windows

---

## 0. Default Token Contract

Use low-token mode unless the user explicitly asks for a broad explanation.

- Read this file first.
- Read only the next specific doc/file needed for the task.
- Prefer `rg`, `sed`, and `git diff` over broad file opens.
- Return deltas: changed files, verification, blockers.
- Do not restate project history when `tasks/session-log.md` already has it.
- Do not open archive/roadmap files unless the active task names them.
- Use one task ID, one feature area, or one route surface at a time.
- For status, trust in order: `tasks/backlog.md` -> `tasks/verification.md` -> `tasks/session-log.md`.

---

## 1. Fast Project Shape

| Area | Path | Read when |
| --- | --- | --- |
| App shell/navigation | `src/app/navigation/` | Routes, deep links, tabs, auth gating |
| Screens | `src/app/screens/` | User, merchant, auth, onboarding, detail, Discover, Profile, Review |
| Shared UI | `src/components/ui/` | Buttons, inputs, sheets, dialogs, typography, image semantics |
| Domain components | `src/components/{dish,stall,social,merchant,review,...}/` | Reusable feature cards/sections |
| Feature logic | `src/features/` | Prefetch, post composer, merchant validation, search hooks |
| Stores | `src/store/` | Zustand session/profile/social/location/merchant state |
| Services | `src/lib/services/` | Mock/Supabase service provider contracts |
| Theme/tokens | `src/theme/` | Colors, spacing, typography, radii, accessibility contrast |
| Types | `src/types/domain.ts` | Canonical domain model; do not duplicate types |
| Constants/flags | `src/constants/featureFlags.ts` | Production/staging/dev route and feature gates |
| Supabase | `supabase/{migrations,smoke,functions}/` | Database, RLS, storage, smoke SQL |
| Tests | `src/**/*.test.ts`, `tests/e2e/`, `.maestro/` | Source contracts, Playwright, native smoke |
| Product/workflow docs | `tasks/` | Active task state, verification, lessons, contracts |
| Design sources | `design/`, `tasks/design-system.md`, `PROJECT_INSTRUCTIONS.md` | UI work only |
| Marketing site | `marketing/website/web-v2/` | Next.js marketing work only |
| Data/floorplans | `data/`, `scripts/floorplan/`, `store-layout-editor/` | Mall/store/floorplan work only |

---

## 2. Canonical Entry Points

Open these files only when the task requires them.

| Task type | Minimal read set |
| --- | --- |
| Bug in a screen | Specific screen + directly imported component/store/service |
| UI polish | `PROJECT_INSTRUCTIONS.md`, `tasks/design-system.md`, specific screen/component |
| Navigation/auth | `src/app/navigation/navigationTypes.ts`, `RootNavigator.tsx`, relevant stack/tab file |
| Data/service behavior | `src/types/domain.ts`, `src/lib/services/types.ts`, active mock/supabase implementation |
| Supabase work | Relevant migration/smoke + `src/lib/services/supabase/supabaseService.ts` |
| Feature flag/gating | `src/constants/featureFlags.ts`, `RootNavigator.tsx`, focused route contract |
| Accessibility | `accessibility-audit-report.md`, `docs/accessibility-style-guide.md`, touched primitive/screen |
| Performance/prefetch | `src/features/navigation/prefetch.ts`, navigation file, affected screen |
| Merchant portal | `src/app/screens/merchant/`, `src/components/merchant/`, merchant service methods |
| Testing only | `tasks/test-harness.md`, exact focused test file |
| Release readiness | `tasks/backlog.md`, `tasks/verification.md`, `tasks/environment.md` |

---

## 3. Protected Sources

Treat these as high blast-radius. Read before editing, patch narrowly, and run a relevant focused check.

- `src/app/navigation/RootNavigator.tsx`
- `src/app/navigation/navigationTypes.ts`
- `src/store/useSessionStore.ts`
- `src/lib/services/mock/data.ts`
- `src/lib/services/types.ts`
- `src/types/domain.ts`
- `src/theme/tokens.ts`
- `src/constants/featureFlags.ts`
- Supabase migrations and RLS policies

---

## 4. Workflow Rules

1. Use `hungry-intent-router` for broad, vague, or multi-step Hungry requests.
2. For non-trivial work, update/consult `tasks/backlog.md` first if a row already exists.
3. Implement directly when the request is clear; do not stop at a proposal.
4. Do not revert unrelated dirty work.
5. Record verification in `tasks/verification.md` for broad/risky changes.
6. Append a short line to `tasks/session-log.md` after focused task work.
7. Update `tasks/lessons.md` only after a correction or repeated mistake.
8. Keep final responses short: what changed, what passed, what remains.
9. Every new Supabase migration (anything after `20261022110000`) needs a matching `supabase/rollbacks/<name>.down.sql`, a `-- smoke:` header, no `begin;`/`commit;`, and staging rehearsal evidence from `scripts/db/rehearse.sh <version>` committed at `supabase/rehearsals/<version>.json`. Prod only via `scripts/db/ship.sh` (it backs up first); never hand-paste migration SQL into prod, and never use a `-- no-down:` / `-- no-rehearsal:` waiver without sh's explicit approval. CI fails otherwise (`npm run audit:supabase:migration-safety`). Runbook: `supabase/manual/safe-migration-runbook.md`.
10. Rate limits: every new RPC the anon role can execute, every new table or RPC a signed-in user can hit in a loop, and every new Edge Function needs a cap (`app_private.request_rate_rules` row in a migration; Edge Functions call `app_can_make_ip_request` / `app_can_make_user_request`) or an entry with a reason in `supabase/rate-limit-allowlist.json`. `npm run check:rate-limits` fails CI otherwise. Details in `supabase/README.md` (Rate limits).

11. Error tracking is mandatory (enforced by `src/lib/monitoring/error-reporting-contracts.test.ts` in CI): every Edge Function is served with `serveWithSentry("<name>", handler)` from `supabase/functions/_shared/sentry.ts` (never bare `Deno.serve`), handled failures call `reportFunctionError`, and screens that catch errors call `reportError` from `@/lib/monitoring/reportError`. Do not add a screen to `screen-error-reporting-baseline.json`; the list only shrinks.

---

## 5. Verification Budget

| Change | Default verification |
| --- | --- |
| Docs-only | `git diff --check -- <touched docs>` |
| One screen/style tweak | Focused source contract or visual smoke if relevant |
| Shared UI/theme/types | Focused tests + `npm run typecheck` |
| Navigation/auth/service/Supabase | Focused tests + `npm run typecheck` + relevant smoke |
| Release/PR readiness | `npm run typecheck`, focused tests, broader suite as needed |

Do not run full suites by default for small edits. Do run full suites when the change touches shared contracts or the user asks for production readiness.

---

## 6. Search Patterns

Use these before reading broad files.

```bash
rg -n "RouteName|component|functionName" src
rg --files src/app/screens src/components src/features
git diff -- <file>
git status --short
```

For current status:

```bash
rg -n "TASK-ID|area keyword" tasks/backlog.md tasks/verification.md tasks/session-log.md
```

---

## 7. Graphify

Use `graphify-out/` only for architecture or dependency-map questions. Skip it for routine code edits, UI polish, docs updates, and focused bug fixes.

If used:
- Prefer `graphify-out/wiki/index.md` when present.
- Otherwise read `graphify-out/GRAPH_REPORT.md`.
- Do not rebuild graphify unless the task explicitly needs an architecture map refresh.

---

## 8. Session-End Checklist

Before ending a session that changed files:

- Verification selected and run, or intentionally skipped with reason.
- `tasks/backlog.md` updated if task status changed.
- `tasks/verification.md` updated for broad/risky/task work.
- `tasks/session-log.md` appended for focused work.
- `tasks/lessons.md` updated only if a correction/lesson occurred.
- Final answer gives only delta, verification, and blockers.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.