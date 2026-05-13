---
name: hungry-staging-smoke
description: Run quick staging checks to prove a Hungry flow really works end to end, then record the evidence. Use this when a task is implemented but still needs staging proof for OCR, merchant claim flows, flags, deploys, or other done gates.
---

# Hungry Staging Smoke

Use this skill when you need proof from staging, not more local coding.

## Workflow

1. Read the relevant open rows in `tasks/backlog.md`.
2. Read `tasks/verification.md` to avoid rerunning already-proven checks.
3. Read `references/staging-done-gates.md` for the required evidence.
4. Execute the smallest set of commands needed to prove the flow.
5. Update `tasks/verification.md` with exact command or runtime evidence.
6. Mark the canonical task row only after the evidence is recorded.
7. Append a concise line to `tasks/session-log.md`.

## Priority Smokes

- `OCR-DG-01`: menu photo upload -> OCR -> extraction -> `dishes_draft`
- `OCR-DG-02`: merchant claim CTA telemetry + row insert
- `OCR-DG-04`: staging/prod flag verification
- `WEB-11`: preview/production deploy proof

## Rules

- Prefer exact evidence over narrative.
- Record environment, command, and result.
- If a smoke test is blocked, state the blocker and stop.
- Do not mark a done gate complete based on code inspection alone.

## References and Scripts

- Read `references/staging-done-gates.md` first.
- Use `scripts/staging_smoke_checklist.sh` as a quick reminder of the required gates.
