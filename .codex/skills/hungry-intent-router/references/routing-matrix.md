# Hungry Routing Matrix

## Rewrite engine defaults

- Always normalize vague Hungry requests through the universal prompt expansion pattern before routing.
- Default to silent internal expansion for execution work.
- If the user explicitly asks to see the rewritten prompt, output the rewrite directly.
- If the target model is unspecified, default to a Codex-oriented working brief.
- If the user explicitly asks for Claude or Codex variants, produce the requested prompt shape before routing or execution.

## Default job types

| Task shape | Route to |
|---|---|
| vague or underspecified request | `hungry-intent-router` first |
| status reconciliation / “is this done?” | `hungry-backlog-keeper` |
| staging proof / done gates | `hungry-staging-smoke` |
| UI closeout / visual QA | `hungry-design-closeout` |
| OCR / supply / claim / Supabase ops | `hungry-supply-ops` |
| release or launch readiness | `hungry-release-readiness` |
| venue / stall / menu data collection | `hungry-market-data-harvest` |
| merchant-facing copy | `hungry-merchant-copy-pack` |

## Generic skill routes

| Need | Route to |
|---|---|
| Figma design source | `figma` |
| Supabase-specific build or ops work | `supabase` |
| accessibility review | `accessibility-auditor` |
| structured UI critique | `sn-ui-checklist` |
| proof-heavy runtime QA | `evidence-collector` |
| anti-fantasy release check | `reality-checker` |

## Tool routing

| Task shape | Preferred action |
|---|---|
| code changes | shell/apply_patch + verification bundle |
| local repo verification | `rg`, `sed`, `git diff`, tests |
| current internet policy/product facts | browse official source |
| screenshots or design references | use image/design-capable tools or referenced artifacts |
