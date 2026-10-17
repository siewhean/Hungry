# Hungry Workflow

Operating model for Claude, Codex, Gemini, and future contributors. The goals are one active source of truth, bounded changes, repeatable verification, and clean branch/document lifecycles.

## 1. Source-of-truth hierarchy

1. Approved product/design source for the requested behavior.
2. Current runtime code, migrations, and configuration.
3. `tasks/backlog.md` — active status and ownership.
4. `tasks/verification.md` — current evidence and blockers.
5. `tasks/session-log.md` — chronological execution history.
6. `tasks/todo.md` and `tasks/Roadmap/Archive/` — historical context only.

Historical documents do not override current code or an approved product-policy change. Reconcile contradictions explicitly.

## 2. Canonical task surface

Use `tasks/backlog.md` for active work. Each row should contain:

| Field | Meaning |
|---|---|
| `id` | Stable task ID |
| `owner` | Responsible person/agent |
| `area` | Product or engineering area |
| `status` | Open, In Progress, Blocked, Done, Optional |
| `evidence` | File, PR, command, screenshot, or external proof |
| `verification` | Required checks |
| `last_updated` | ISO date |
| `notes` | Residual risk only |

Rules:

- One canonical row per active task.
- Update the canonical row before narrating status elsewhere.
- Do not turn session logs or audit reports into parallel task trackers.
- Archive or delete superseded planning documents after their active information is reconciled.

## 3. Roles

| Agent | Primary responsibility |
|---|---|
| Claude | Scope, requirements, prioritisation, product/legal ambiguity, final audit |
| Codex | Implementation, repository search, testing, technical cleanup, code/doc reconciliation |
| Gemini/design agent | Visual direction, UI polish, design comparison and copy alternatives |
| Human owner | Credentials, production dashboards, legal sign-off, destructive branch/data decisions |

Agents may cross roles when the task requires it, but evidence and source-of-truth rules remain unchanged.

## 4. Work modes

### Planning

Use when architecture, product policy, branch reconciliation, or more than three dependent steps are involved.

Required output:

- bounded scope;
- acceptance criteria;
- task ownership;
- verification plan;
- explicit destructive actions requiring owner approval.

### Execution

Use when acceptance criteria are clear.

Required output:

- focused implementation;
- removal of newly orphaned code/files;
- risk-appropriate verification;
- active-task and evidence updates.

### Closeout

Use when implementation is complete or the user asks whether it is ready.

Required output:

- changes made;
- files removed/moved;
- checks and exact results;
- remaining manual/external blockers;
- Go, Go Candidate, or No-Go verdict.

## 5. Branch and pull-request lifecycle

`main` is the integration source of truth.

### Creating work

- Create one branch per coherent change set.
- Open one PR from that branch to its actual integration base.
- Avoid long chains of dependent PRs unless sequencing is unavoidable.
- Name branches by purpose, not agent/session identity alone.

### Updating work

- Rebase or update the active branch before final verification.
- Resolve duplicated implementation rather than carrying both paths.
- If another PR fully supersedes a branch, close the old PR with a disposition comment.
- Do not merge a stale branch merely to preserve history; commits and closed PRs already preserve history.

### Closing work

- Merge only after required checks and review evidence pass.
- Close superseded, duplicate, abandoned, or already-integrated PRs.
- Delete merged/superseded branch refs after owner review when repository tooling permits.
- Keep release branches only when an active release or rollback policy requires them.

## 6. Repository and documentation lifecycle

### Keep at repository root

Only stable entrypoints, build/configuration files, security policy, and workspace manifests.

### Keep under `tasks/`

- top level: active ledgers and stable product/engineering contracts;
- `tasks/Roadmap/<Domain>/`: current domain plans and audits;
- `tasks/Roadmap/Archive/`: unique historical material no longer active.

### Delete instead of archive

Delete files that are:

- exact duplicates;
- generated logs/reports reproducible by a script or CI;
- empty or temporary work products;
- obsolete and unreferenced with no meaningful audit value;
- stale screenshots containing no required release evidence.

### Generated outputs

Prefer CI artifacts or ignored local directories. Commit generated data only when it is an intentional runtime/release input with a documented generator and provenance.

## 7. Verification budget

Choose the smallest useful set, except broad cleanup/auth/navigation/service/database/release work requires broad verification.

| Scope | Verification |
|---|---|
| Docs-only | reference/link audit, formatting/diff check |
| Focused behavior | focused unit/contract test; typecheck if contracts changed |
| Shared UI/state/navigation/service | focused tests, typecheck, lint, affected runtime smoke |
| Supabase/security/data | static audit, focused tests, migration/RLS smoke, credential-backed proof where required |
| Native/release | full relevant static checks, device/simulator smoke, build/store/monitoring proof |
| Repository-wide cleanup | deleted-reference search, typecheck, lint, tests, asset audit, security scans, CI |

Record results in `tasks/verification.md`. “Not run”, “skipped”, “blocked”, and “passed” are distinct states.

## 8. Product safety boundaries

- No guest mode in the app.
- Main app surfaces require successful authentication.
- Supabase is the authentication and shared-write authority.
- Excel is an authenticated read-only catalog outage fallback only.
- Mock providers are development/test-only.
- Deep links and return routes must not bypass auth, feature flags, or role checks.
- Disabled or unmoderated advanced features remain off in production.
- Secrets and service-role credentials never enter client code or prompts.

## 9. Session closeout checklist

Before ending non-trivial work:

- [ ] Changed files trace to the requested scope.
- [ ] Obsolete imports, files, scripts, and references created by the change are removed.
- [ ] Active backlog row is current.
- [ ] Verification evidence and blockers are recorded.
- [ ] Session log has a concise entry.
- [ ] Documentation matches current code and product policy.
- [ ] Superseded PR/branch disposition is recorded.
- [ ] Final response distinguishes completed work from unverified or external gates.
