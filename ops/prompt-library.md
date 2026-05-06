# Hungry Prompt Library

Default rule for every prompt below:
- keep scope bounded
- name exact task IDs or files
- ask for only the delta unless broader narration is required

## Codex — Implementation

“Implement `<TASK_ID>` only. Use `tasks/backlog.md` as the canonical task surface. Update the task row, run the smallest relevant verification for the change, record evidence in `tasks/verification.md` when task/release work changed, and append a concise note to `tasks/session-log.md`.”

## Codex — Verification

“Verify `<TASK_ID_LIST>` against current code. Return only status, evidence, and required doc updates. If rows are stale, patch `tasks/backlog.md` and `tasks/verification.md`.”

## Codex — Low-Token Default

“Work in low-token mode. Inspect only the files needed, run only the relevant verification, update only canonical docs, and return only what changed, evidence, and blockers.”

## Codex — Closeout Mode

“Run closeout mode for `<TASK_ID_LIST>`. Verify code first, then state what changed, what was verified, what remains open, and exactly which docs you updated.”

## Claude — Planning

“Define acceptance criteria, owner, and priority for `<TASK_ID_LIST>`. Update only planning-level docs and the canonical task rows. Do not implement code.”

## Claude — Audit

“Audit `<TASK_ID_LIST>` against product intent and current implementation. Focus on residual risk, missing acceptance criteria, or reopened issues.”

## Claude — Low-Token Default

“Use low-token mode. Read only the named docs, avoid project-wide narration, and return only scoped next steps, blockers, and residual risk.”

## Gemini — Design Direction

“Produce screen-level visual and UX direction for `<TASK_ID_LIST>`. Include token rules, copy changes, interaction notes, and acceptance criteria for Codex.”

## Gemini — Design QA

“Review the implementation of `<TASK_ID_LIST>` against the governing design source. Return only mismatches and exact visual deltas.”

## Gemini — Low-Token Default

“Use low-token mode. Return only visual mismatches, token issues, copy fixes, and interaction deltas. Do not write a full design essay.”
