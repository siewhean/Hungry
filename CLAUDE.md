# Claude Entrypoint — Hungry

---

## Startup Sequence

| Step | Action |
|------|--------|
| 1 | Read `README.md` — project state and quick reference map |
| 2 | Read `AGENTS.md` — master harness dictionary and document TOC |
| 3 | Read `tasks/todo.md` — current task list |
| 4 | Read `tasks/lessons.md` — rules from past corrections |

---

## Workflow Rules

### 1. Plan Mode Default
- Enter plan mode for any non-trivial task (3+ steps or architectural decisions)
- Use plan mode for verification steps, not just building
- Write detailed specs to `tasks/todo.md` upfront to reduce ambiguity

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
- Run `npm run typecheck` — must pass
- Run `npm run test` — must pass
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
- **Plan first** — write `tasks/todo.md` with checkable items
- **Verify plan** — check in before implementation
- **Track progress** — mark items complete as you go
- **Explain changes** — high-level summary at each step
- **Document results** — add review section to `tasks/todo.md`
- **Capture lessons** — update `tasks/lessons.md` after corrections

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
| `tasks/design-system.md` | Any UI or component work |
| `tasks/screens.md` | Any screen or navigation work |
| `tasks/data-contracts.md` | Any data, store, or mock work |
| `tasks/test-harness.md` | Any feature or bug-fix work |

---

## Session-End Checklist

```
Before ending any session that changed code:
  [ ] npm run typecheck — passes
  [ ] tasks/todo.md — all done items marked [x]
  [ ] tasks/todo.md — review section written
  [ ] tasks/lessons.md — corrections recorded
  [ ] README.md — status updated if progress or decisions changed
```
Then read `AGENT.md` and follow its workflow, including keeping `README.md` updated whenever task context, progress, decisions, or blockers change.

## Mandatory execution workflow for Hungry

1. Treat `tasks/todo.md` as the shared task contract between Claude and Codex.
2. For non-trivial work, write/update a scoped plan in `tasks/todo.md` before implementation.
3. Update checklist status frequently (at least once per focused work block, and always before ending a session).
4. Do not mark tasks done without recording a verification step.
5. Append a concise entry in the shared session log section of `tasks/todo.md` with date, actor, status, blockers, and next step.
