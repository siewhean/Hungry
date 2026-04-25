---
name: hungry-supply-ops
description: Work on Hungry's supply-side systems such as menu OCR, merchant claims, Supabase checks, and ops review flows. Use this when the task is about getting business data into Hungry correctly and verifying the supply pipeline works as expected.
---

# Hungry Supply Ops

Use this skill for business-data and merchant-operation work, not normal consumer app features.

## Core Capabilities

### 1. Menu OCR pipeline
- inspect menu-photo submission path
- verify OCR/extraction output
- check `dishes_draft` creation and review flow

### 2. Merchant claim flow
- verify CTA behavior
- verify insert path to `merchant_claim_interests`
- check copy, gating, and feature-flag behavior

### 3. Supabase operational checks
- verify migrations, flags, and expected rows
- check staging/prod behavior without changing scope

### 4. Ops review surfaces
- review `/ops/dishes-draft`
- confirm consumer-facing surfaces stay curated-only when required

## Workflow

1. Read the supply-related rows in `tasks/backlog.md`.
2. Read `references/supply-scope.md`.
3. Inspect the relevant Supabase or app flow.
4. Prefer bounded checks: one pipeline, one done gate, one table, or one screen at a time.
5. Record proof in `tasks/verification.md`.
6. Update canonical status in `tasks/backlog.md`.

## Rules

- Keep consumer and merchant flows separate in analysis.
- Do not expose `dishes_draft` to consumer surfaces unless a task explicitly changes that rule.
- Treat Supabase evidence and app evidence separately.
- If a staging proof is missing, leave the row open or blocked.

## References and Scripts

- Read `references/supply-scope.md` first.
- Use `scripts/supply_focus.sh` as a quick reminder of the supply-side checklist.
