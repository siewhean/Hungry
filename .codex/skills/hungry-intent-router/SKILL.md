---
name: hungry-intent-router
description: Read a broad or unclear Hungry request, rewrite it into a clearer working brief, and choose the right next skill or tool automatically. Use this when the request is vague, multi-step, or does not clearly say what workflow should be used.
---

# Hungry Intent Router

Use this skill first when the request is not precise enough to act on directly.

This skill includes the `universal-prompt-expander` rewrite behavior, so prompt cleanup and skill routing happen in one place.

## What this skill does

It performs two automatic functions:

1. rewrite the user request into a concise but execution-ready working brief
2. choose the best next route:
   - Hungry-specific skill
   - generic skill
   - direct tool path

## Default behavior

Use this default unless the user explicitly asks to see the rewritten prompt.

- For ordinary Hungry tasks, silently translate the user's wording into an internal working brief, then execute from that brief.
- Default to low-token mode while doing so:
  - keep the rewritten brief compact
  - prefer bounded file or task scope
  - prefer one canonical source first
  - return only the delta unless the user explicitly asks for a broader summary
- If the user explicitly asks for a rewritten prompt, output the rewritten prompt directly instead of hiding it.
- If the user explicitly asks for a Claude-ready prompt, produce a Claude-optimized rewrite.
- If the user explicitly asks for a Codex-ready prompt, produce a Codex-optimized rewrite.
- If the user asks for both, produce two separate prompt variants.
- If the target is unspecified, default to a Codex-oriented working brief for execution.

## Workflow

1. Read the user request.
2. Extract the real ask:
   - concrete goal
   - target repo, files, platform, environment, or tools if mentioned
   - constraints, non-goals, or "do not change" rules
   - what finished-good looks like
   - missing facts that must remain assumptions rather than invented details
3. Infer:
   - scope
   - likely output
   - urgency
   - whether code, design, data, verification, policy, or copy work is needed
4. Rewrite the task into a compact working brief:
   - objective
   - context
   - inputs or files
   - constraints
   - desired output
   - files or systems likely involved
   - acceptance criteria
   - assumptions when needed
5. Apply target-specific style:
   - Claude style: shorter, crisper, minimal ceremony
   - Codex style: operational, execution-ready, explicit validation
6. Read `references/routing-matrix.md`.
7. Choose the best route:
   - Hungry skill
   - generic skill
   - direct tools only
8. Continue execution through that route without waiting for the user to name the skill.

## Output contract

When this skill is used internally, produce:
- rewritten working brief
- selected route
- why that route is correct
- next execution step

Do not produce a long planning essay unless the task truly needs planning.

## Routing rules

- Preserve intent. Improve structure, not meaning.
- Do not invent product requirements, APIs, file names, dependencies, or acceptance criteria.
- Keep expansion proportional. Do not over-expand a simple request.
- Label assumptions explicitly when they are necessary to proceed.
- Prefer low-token execution shapes over narrative ones.
- Prefer Hungry-specific skills over generic skills when both fit.
- Prefer direct execution when the task is trivial.
- Prefer a generic expert skill only when no Hungry-specific skill covers the task.
- If the request is already precise and names the right skill, do not rewrite more than necessary.
- If the user asks for "just the prompt", return only the rewritten prompt.

## Good automatic routes

- “Check if this is done” -> `hungry-backlog-keeper`
- “Run staging proof” -> `hungry-staging-smoke`
- “Polish this screen against design” -> `hungry-design-closeout`
- “Check OCR / claim / Supabase path” -> `hungry-supply-ops`
- “Are we ready to ship?” -> `hungry-release-readiness`
- “Collect stall/menu data” -> `hungry-market-data-harvest`
- “Write merchant CTA copy” -> `hungry-merchant-copy-pack`

## References

- Read `references/routing-matrix.md` for the routing table.
- Mirror the rewrite discipline from `/Users/Siew Hean/Documents/GitHub/global-skills/universal-prompt-expander/SKILL.md`.
