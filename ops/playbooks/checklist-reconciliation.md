# Playbook: Checklist Reconciliation

## Goal

Synchronize code, canonical task status, and verification evidence without re-summarizing the whole project.

## Steps

1. Query only the relevant task IDs.
2. Verify the code first.
3. Update `tasks/backlog.md`.
4. Update `tasks/verification.md` if command evidence changed.
5. Append `tasks/session-log.md` only after the canonical row is correct.

## Do not

- update multiple status surfaces first and code later
- restate status in several places
- use batch summaries as the canonical truth

## Good prompt

“Verify `SEC-02`, `OCR-DG-01`, and `WEB-11` against current code and docs. Patch only the canonical rows and verification evidence.”

