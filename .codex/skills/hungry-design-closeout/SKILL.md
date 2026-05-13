---
name: hungry-design-closeout
description: Check that a Hungry screen or component matches the approved design before marking it done. Use this when UI work looks finished and you want a final review for layout, styling, interaction details, accessibility, and backlog closeout.
---

# Hungry Design Closeout

Use this skill when a screen looks finished but still needs a proper final design check.

## Workflow

1. Read the governing design source first: Figma, `design/`, or approved audit spec.
2. Read the exact task rows in `tasks/backlog.md`.
3. Compare implementation against design source, not against old code.
4. Verify token usage, accessibility expectations, and interaction notes.
5. Update the canonical backlog row.
6. Record verification evidence if commands or structured QA were run.
7. Append a concise closeout note to `tasks/session-log.md`.

## Review Standard

Check:
- layout and hierarchy
- typography and token use
- color and contrast
- motion and interaction fit
- accessibility labels/states if applicable
- no stale placeholder or developer-facing copy

## Rules

- Missing design source means not ready for closeout.
- Do not improvise acceptance criteria from memory.
- If there is a visual mismatch, report only the exact delta.
- If the task is design-complete but runtime-untested, mark residual risk explicitly.

## References

- Read `references/design-closeout-checklist.md` when the task is screen-level.
