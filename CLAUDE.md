# Claude Entrypoint — Hungry

---

## Startup Sequence

| Step | Action |
|------|--------|
| 1 | Read `README.md` — project state and quick reference map |
| 2 | Read `AGENTS.md` — master harness dictionary and document TOC |
| 3 | Read `WORKFLOW.md` — operating model and role split |
| 4 | Read `ops/low-token-cheatsheet.md` — default prompt/output compression rules |
| 5 | Read `tasks/backlog.md` — canonical active task list |
| 6 | Read `tasks/verification.md` — latest evidence |
| 7 | Read `tasks/lessons.md` — rules from past corrections |

---

## Workflow Rules

### 1. Plan Mode Default
- Enter plan mode for any non-trivial task (3+ steps or architectural decisions)
- Use plan mode for verification steps, not just building
- Write scoped canonical task rows to `tasks/backlog.md` upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After any correction from the user: update `tasks/lessons.md` with the pattern
- Write rules that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start

### 4. Verification Before Done
- Never mark a task complete without proving it works
- For small iterative changes, do not require full QA/QC, `npm run ios`, full tests, or default `npm run typecheck`; run a focused check only if useful, or state that checks were skipped by design
- For medium/broad/risky changes, choose the verification budget in `AGENTS.md` / `tasks/test-harness.md`
- Ask: "Would a staff engineer approve this?"

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: implement the elegant solution instead
- Skip this for simple, obvious fixes — do not over-engineer

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it — no hand-holding
- Point at logs, errors, failing tests — then resolve them
- Go fix failing CI tests without being told how

### Task Management
- **Plan first** — update `tasks/backlog.md` with scoped rows
- **Verify plan** — check in before implementation
- **Track progress** — update canonical rows as you go
- **Explain changes** — high-level summary at each step
- **Document results** — record evidence in `tasks/verification.md`
- **Log execution** — append `tasks/session-log.md`
- **Capture lessons** — update `tasks/lessons.md` after corrections
- **Stay compressed** — default to low-token prompts, bounded reads, and delta-only outputs unless a broad narrative is explicitly needed

---

## Core Principles

| Principle | Rule |
|-----------|------|
| Simplicity first | Make every change as small as possible. Impact minimal code. |
| No laziness | Find root causes. No temporary fixes. Senior developer standards. |
| Minimal impact | Changes should only touch what is necessary. Avoid introducing bugs. |
| Protect working paths | Do not casually refactor: navigation wiring, session store, mock data, domain types, or theme tokens. Treat as protected unless explicitly asked. |
| Patch, do not churn | On protected paths, use the smallest viable fix. Keep existing behavior unless task explicitly requires change. |

---

## Harness Document Map

| Document | Read before |
|----------|------------|
| `tasks/environment.md` | Any code work |
| `WORKFLOW.md` | Any non-trivial planning or coordination work |
| `tasks/design-system.md` | Any UI or component work |
| `tasks/screens.md` | Any screen or navigation work |
| `tasks/data-contracts.md` | Any data, store, or mock work |
| `tasks/test-harness.md` | Any feature or bug-fix work |

---

## Session-End Checklist

```
Before ending any session that changed code:
  [ ] Verification budget selected — focused check run or intentionally skipped for small iterative change
  [ ] tasks/backlog.md — canonical rows updated
  [ ] tasks/verification.md — verification written when task/release work changed
  [ ] tasks/session-log.md — entry appended
  [ ] tasks/lessons.md — corrections recorded
  [ ] README.md — status updated if progress or decisions changed
```
Then read `AGENTS.md` and follow its workflow, including keeping `README.md` updated whenever task context, progress, decisions, or blockers change.

## Mandatory execution workflow for Hungry

1. Treat `tasks/backlog.md` as the shared active task contract between Claude and Codex.
2. For non-trivial work, write/update scoped rows in `tasks/backlog.md` before implementation.
3. Update canonical task status frequently (at least once per focused work block, and always before ending a session).
4. Do not mark tasks done without recording a verification step in `tasks/verification.md`.
5. Append a concise entry in `tasks/session-log.md` with date, actor, status, blockers, and next step.
6. Default to low-token mode: bounded scope, canonical docs first, and concise output.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
