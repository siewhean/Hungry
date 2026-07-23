# Claude Entrypoint — Hungry

Use this file as the concise Claude-specific entrypoint. Repository-wide architecture and rules live in `AGENTS.md`; task and verification governance live in `WORKFLOW.md`.

## 1. Start here

1. Read `README.md`.
2. Read `AGENTS.md`.
3. Read `WORKFLOW.md`.
4. Read `tasks/backlog.md` and the relevant section of `tasks/verification.md`.
5. Open only the files required for the current task.

For status, trust this order:

```text
tasks/backlog.md → tasks/verification.md → tasks/session-log.md → tasks/todo.md / Archive
```

## 2. Current non-negotiable product rules

- Hungry has no guest mode.
- Fresh users follow Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app.
- Main app routes must not mount before authentication.
- Supabase is mandatory for authentication and shared writes.
- Excel is an authenticated, read-only catalog fallback for eligible catalog outages only.
- Missing configuration, failed authentication, missing/invalid/revoked sessions, signed-out state, and legitimate no-results must never invoke Excel fallback.
- Released builds must not expose mock providers, prototype routes, developer tools, or unfinished features.

## 3. Minimal read sets

| Task | Read first |
|---|---|
| Screen/UI change | Approved design source, touched screen, directly imported components/stores |
| Navigation/auth | `navigationTypes.ts`, relevant navigator, linking, `useSessionStore.ts`, `useAppBootstrap.ts` |
| Catalog/data source | `serviceProvider.ts`, catalog service, Supabase client/service, Excel adapter |
| Supabase/RLS | Relevant migration, function or smoke SQL, matching client service |
| Profile/social/post/review | Canonical service contract, store cache, Supabase implementation, focused tests |
| Website | `marketing/website/web-v2/` and its local instructions |
| Data pipeline | Canonical workbook/data doc, exact script, its tests and generated-output policy |
| Release readiness | `tasks/backlog.md`, `tasks/verification.md`, release scripts and environment docs |

## 4. Execution rules

- Implement directly when the request and acceptance criteria are clear.
- State assumptions only when they materially affect the implementation.
- Keep diffs focused, but remove files or code that the requested cleanup proves obsolete.
- Do not silently fix unrelated product behavior during repository organization work.
- Do not revert unrelated branch work.
- Prefer existing contracts, primitives, scripts, and providers over parallel abstractions.
- Do not introduce client secrets or service-role credentials.
- Do not claim a skipped, credential-blocked, simulator-blocked, or failing check passed.

## 5. Repository hygiene rules

- Keep root documentation stable and concise.
- Keep live task status in `tasks/backlog.md` only.
- Store historical material in `tasks/Roadmap/Archive/` when it has continuing audit value; delete exact duplicates, generated junk, and obsolete unreferenced output.
- Keep generated logs and screenshots out of Git unless they are explicit release evidence.
- Close superseded PRs and remove obsolete branch refs after owner review.
- Use `main` as the integration source of truth.

## 6. Verification budget

| Scope | Expected evidence |
|---|---|
| Docs and organization | reference/link audit and diff check |
| Focused logic | focused tests; typecheck when contracts changed |
| Shared state/navigation/services | focused tests, typecheck, affected runtime smoke |
| Supabase/security/native/release | relevant full static, integration, native, and external gates |

Do not run broad suites for trivial edits, but do run them for repository-wide cleanup, auth, navigation, service, database, native, or release changes.

## 7. Closeout

For non-trivial work:

- update the active backlog row;
- record verification and blockers;
- append a concise session log entry;
- report changed/deleted files, checks, and residual risks;
- leave the production verdict as No-Go when any P0 proof is missing.
