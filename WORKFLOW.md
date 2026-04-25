# Hungry Workflow

> Operating model for Claude, Codex, Gemini, and any future agents.
> Goal: reduce status churn, keep one active task surface, and make verification repeatable.

---

## 1. Source-of-Truth Hierarchy

1. Figma / approved design artifact
2. `tasks/product-context.md`
3. `tasks/backlog.md`
4. `tasks/verification.md`
5. `tasks/session-log.md`
6. `tasks/todo.md` for historical audit trail and roadmap context

Do not use `tasks/todo.md` as the live status source when `tasks/backlog.md` already contains the task row.

---

## 2. Role Split

| Agent | Primary responsibility | Not primary responsibility |
|------|-------------------------|----------------------------|
| Claude | Scope, prioritization, acceptance criteria, product audit, final sign-off | Large implementation batches, repetitive repo verification |
| Codex | Implementation, repo search, verification, technical cleanup, doc sync for changed work | Broad roadmap narration, repeated project-wide status synthesis |
| Gemini | Visual direction, UX polish, copy variants, design QA | Core engineering execution, backlog governance |

---

## 3. Canonical Task Surface

Use `tasks/backlog.md` for active work.

Each task row should contain:

| Field | Meaning |
|------|---------|
| `id` | Stable task ID |
| `owner` | Claude / Codex / Gemini / Both / User |
| `area` | Product area |
| `status` | `Open`, `In Progress`, `Blocked`, `Done`, `Optional` |
| `evidence` | File path or command proving completion |
| `verification` | Required command or QA evidence |
| `last_updated` | `YYYY-MM-DD` |
| `notes` | Short residual note only |

Rules:
- One canonical row per active task ID.
- Batch summaries and session logs must not restate task status as a second source of truth.
- If a task is completed, update the canonical row first, then append the narrative log.

---

## 4. Required Documents

| File | Purpose |
|------|---------|
| `tasks/backlog.md` | Active task surface |
| `tasks/verification.md` | Current verification bundle evidence |
| `tasks/session-log.md` | Chronological execution history |
| `tasks/todo.md` | Historical roadmap, audit trail, detailed archive |
| `ops/playbooks/implementation.md` | How to run an implementation block |
| `ops/playbooks/verification.md` | Standard verification bundle |
| `ops/playbooks/checklist-reconciliation.md` | How to sync code and docs |
| `ops/playbooks/design-handoff.md` | Gemini → Codex design transfer pattern |
| `ops/prompt-library.md` | Reusable prompts for each agent |
| `ops/low-token-cheatsheet.md` | Default low-token operating rules for all LLM work |

---

## 5. Standard Work Modes

### Low-Token Mode

Default to low-token mode for all Hungry work unless the user explicitly asks for a broad summary or deep narrative.

Low-token mode means:
- bounded scope first
- one canonical source first
- one relevant skill first
- only the delta in output
- direct execution over discussion when implementation is intended

Read `ops/low-token-cheatsheet.md` when shaping prompts, summaries, or closeout responses.

### Intent Routing

Use `hungry-intent-router` as the default first-pass skill when:
- the request is vague
- the request is multi-step
- the correct skill is not explicitly named
- the user asks for broad help without a scoped task ID

If the request is already precise, skip routing and use the direct relevant skill or direct execution path.

`hungry-intent-router` should preserve low-token mode by default when it rewrites and routes a request.

### Planning Mode

Use when:
- scope is unclear
- architecture is changing
- multiple agents are involved
- more than 3 steps are needed

Output:
- scoped task rows in `tasks/backlog.md`
- acceptance criteria
- owner assignment

### Execution Mode

Use when:
- task already has acceptance criteria
- Codex can implement directly

Output:
- code changes
- verification bundle run
- task row updated
- session log appended

### Closeout Mode

Use when:
- feature is nearly done
- user asks “is this done?”
- only verification/doc drift remains

Required output:
- what changed
- what was verified
- what remains open
- exact task IDs updated

---

## 6. Verification Bundle

Default Hungry verification bundle:

1. `npm run typecheck`
2. `npm test -- --runInBand`
3. `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor`

When a task does not need all three, explicitly state why.

Record results in `tasks/verification.md`.

---

## 7. Multi-LLM Sequence

### New feature

1. Claude defines scope and acceptance criteria
2. Gemini provides design direction if UI changes are required
3. Codex implements
4. Codex runs verification bundle
5. Claude audits final result

### Closeout / bug-fix

1. Codex verifies actual code state
2. Codex patches code and updates canonical task rows
3. Claude validates any residual ambiguity
4. Gemini only joins if a visual/UI issue remains

---

## 8. Anti-Patterns

Do not:
- ask Codex broad “what is the status of everything?” questions when a bounded repo query would do
- keep duplicate status rows in multiple docs
- treat session logs as the canonical checklist
- use Gemini for engineering closure
- use Claude for repetitive code verification

Prefer:
- bounded task-ID verification
- evidence-based prompts
- one canonical status row
- append-only narrative logs

---

## 9. Recommended Prompt Style

Good:
- “Implement `C4` only. Update `tasks/backlog.md`, run the verification bundle, and record residual risk.”
- “Verify `SEC-02` and `WEB-11` against current code and docs. Return only mismatches.”
- “Run closeout mode for Sprint 10 staging smoke tasks.”
- “Return only blockers for `OCR-DG-01`.”

Bad:
- “Summarize the whole repo again.”
- “Check if everything is done.”
- “What should we do next?” without naming the active sprint or task IDs.

## 10. Automatic Skill Routing

Default Hungry routing order:

1. `hungry-intent-router`
2. one Hungry-specific execution skill
3. generic specialist skill only if needed
4. direct tool execution

This is the preferred automation path for Hungry work.

## 11. Token Discipline

Apply these rules by default:

1. ask or operate by task ID, file, or bounded surface
2. avoid full-project narration unless explicitly requested
3. use `tasks/backlog.md`, `tasks/verification.md`, and `tasks/session-log.md` as the only active status surfaces
4. prefer targeted shell reads over large prose summaries
5. ask for and return only the delta when possible
