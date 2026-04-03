# CmdTab Agent Instructions

## Startup Sequence (required for every session)

1. Read `README.md` — canonical shared context for the current task, constraints, decisions, and progress.
2. Read the matching entrypoint file (`CLAUDE.md` or `CODEX.md`) and apply its workflow rules.
3. Treat `README.md` as ground truth; override only when the user's current prompt explicitly contradicts it.
4. Update `README.md` before ending any session that changes code, plans, decisions, or blockers.

---

## Workflow Rules (from CLAUDE.md)

### Planning
- Enter plan mode for any non-trivial task (3+ steps or architectural decisions).
- Write a detailed spec / checklist to `tasks/todo.md` before implementing.
- Check in with the user to confirm the plan before starting.

### Subagent Strategy
- Use subagents liberally to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- One focused task per subagent.

### Self-Improvement
- After any correction: record the lesson in `tasks/lessons.md` with a concrete rule.
- Review `tasks/lessons.md` at the start of sessions on this project.

### Verification Before "Done"
- Never mark a task complete without proving it works (build, test, or observable behaviour).
- Ask: "Would a staff engineer approve this?"

### Elegance Check
- For non-trivial changes pause and ask: "Is there a more elegant way?"
- Skip for simple, obvious fixes — do not over-engineer.

### Autonomous Bug Fixing
- Given a bug report: fix it. Do not ask for hand-holding.
- Point at logs / errors / failing tests, then resolve them.

### Task Tracking
- **Plan first** — write `tasks/todo.md` with checkable items.
- **Verify plan** — check in before implementation.
- **Track progress** — mark items complete as you go.
- **Explain changes** — high-level summary at each step.
- **Document results** — add a review section to `tasks/todo.md`.
- **Capture lessons** — update `tasks/lessons.md` after any correction.

### Repo Commands
- Use SwiftPM for day-to-day verification: `swift build` and `swift test`.
- Prefer a dedicated scratch path when running tests locally: `swift test --scratch-path /tmp/CmdTab-test`.
- Use `./build.sh` to package the release `.app` bundle at `CmdTab.app`.
- Launch the packaged app with `open "CmdTab.app"` for manual validation.

---

## Core Principles

- **Simplicity first** — make every change as small as possible; impact minimal code.
- **No laziness** — find root causes; no temporary fixes; senior-developer standards.
- **Minimal impact** — changes should only touch what is necessary; avoid introducing new bugs.
- **Protect working core paths** — do not casually refactor working switcher internals. Treat hotkey routing, modifier-release quick switch, MRU/history ordering, frontmost resolution, activation confirmation, quick actions, and removal animations as protected unless the user explicitly requests a redesign or a reproducible bug requires a targeted fix.
- **Patch, do not churn** — when changing protected core paths, use the smallest viable fix and keep existing behavior unless the task explicitly calls for behavior change.
