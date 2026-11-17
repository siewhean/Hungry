# Hungry Skill Architecture Audit

## Executive Summary

Your skill pool is large enough that a flat audit is not useful. The right architecture for Hungry is a 3-layer model:

1. base platform skills
2. project-relevant specialist skills
3. Hungry-specific workflow skills

The main problem is not lack of skill coverage. It is overlap and routing ambiguity.

### Key findings

- You already have strong base coverage for Supabase, Figma, Mapbox, UI review, workflow design, product planning, accessibility, and code review.
- The highest-value redundancy cluster is around workflow/project-management/orchestration skills.
- The second redundancy cluster is around UI/design critique skills.
- The third redundancy cluster is around geospatial/Mapbox skills.
- You were missing project-specific skills for:
  - canonical backlog reconciliation
  - staging smoke execution
  - design closeout for Hungry
  - supply-side ops workflows

### New Hungry skills created

- `.codex/skills/hungry-backlog-keeper`
- `.codex/skills/hungry-staging-smoke`
- `.codex/skills/hungry-design-closeout`
- `.codex/skills/hungry-supply-ops`

A full inventory of installed skills is in `ops/skills/full-skill-inventory.tsv`.

## Existing Skill Audit

### Audit scope

Full inventory captured for all installed skills.

Detailed audit below focuses on the project-relevant subset for Hungry.

| Skill | Purpose | Inputs | Outputs | Strengths | Weaknesses | Dependencies | Improvement opportunity |
|---|---|---|---|---|---|---|---|
| `supabase` | Supabase build and ops work | schema, SQL, auth/storage tasks | migrations, checks, fixes | high project fit | too broad for staging done-gate operations | Supabase CLI/project access | pair with Hungry-specific supply/staging skills |
| `graphify` | knowledge graph generation | code/docs/images | graph + HTML + JSON | useful for large-repo context | not integrated into daily execution | graphify runtime/config | use as periodic rebuild, not default per task |
| `figma` | design-source fetch and translation | Figma URLs, nodes | design context/assets | essential for design-first flow | requires discipline to trigger consistently | Figma MCP | pair with design closeout skill |
| `sn-ui-checklist` | structured UI review | screen/component | checklist findings | good final review surface | generic, not Hungry-specific | none | use after `hungry-design-closeout` |
| `emil-design-eng` | UI polish heuristics | UI request | design refinement guidance | strong polish taste | can conflict with brand-specific rules | none | treat as secondary aesthetic layer |
| `ui-ux-pro-max` | broad UI/UX ideation | product/design ask | UI recommendations | high breadth | broad, can dilute concrete outputs | none | reserve for exploration, not closeout |
| `frontend-skill` | strong frontend implementation taste | UI build tasks | structure + styling guidance | useful for marketing/web | generic; not tailored to Hungry tokens | none | keep for web-specific or generic frontend work |
| `accessibility-auditor` | a11y specialist review | UI/screens | WCAG-oriented findings | strong for closeout | can be overkill for early iteration | none | use near release or after substantial UI changes |
| `evidence-collector` | proof-heavy QA | screenshots/flows | evidence-backed issues | good for regression review | slower | screenshot/runtime artifacts | use for release candidate checks |
| `reality-checker` | anti-fantasy QA | any “done” claim | pass/fail skepticism | excellent for closure discipline | can create overhead if used too often | none | use for release gates only |
| `code-reviewer` | code review | changed files | findings | useful for technical risk | generic | none | use on risky refactors, not every patch |
| `codebase-onboarding-engineer` | read unfamiliar codebase | codebase question | grounded explanation | useful for new contributors | low value once repo is familiar | none | use sparingly |
| `workflow-architect` | workflow trees/specs | process/system ask | detailed workflow maps | very aligned to Hungry operations | can be too detailed for simple work | none | use for merchant/OCR/order flows |
| `workflow-optimizer` | process optimization | current workflow | efficiency recommendations | aligned to your current need | generic outputs unless bounded | none | use at monthly ops review cadence |
| `agents-orchestrator` | multi-agent orchestration | complex multi-agent task | task split and orchestration | fits your agent-heavy setup | overlaps with PM/orchestration skills | none | keep as umbrella orchestrator only |
| `chief-of-staff` | executive coordination | noisy backlog or status | synthesized next steps | useful for prioritization | overlaps with PM/project skills | none | use for strategic weekly review, not implementation |
| `product-manager` | product strategy and prioritization | feature/roadmap questions | product framing | useful for roadmap decisions | overlaps with Claude role | none | route to Claude or Kimi first |
| `project-shepherd` | project coordination | execution plan | timeline/risk management | useful for active sprint management | overlaps with senior PM skills | none | merge mentally with chief-of-staff for one use case |
| `senior-project-manager` | spec-to-task conversion | vague project ask | task breakdown | useful for backlog shaping | overlaps with project-shepherd | none | use one PM-style skill, not both |
| `analytics-reporter` | KPI/reporting analysis | metrics/events | analysis/report | useful after instrumentation | not a build skill | analytics data | use after staging/production data exists |
| `api-tester` | API validation | endpoints | test findings | useful for Supabase Edge Functions | not needed for pure UI work | running endpoints | use for OCR/claim backend checks |
| `data-engineer` | data pipeline work | schemas/pipelines | pipeline design/fixes | relevant to supply priming | broad and infrastructure-heavy | data systems | use for OCR/extraction/data hygiene design |
| `security-engineer` | app security review | code/config | security findings | relevant to Supabase/Auth | not needed every sprint | code/config access | use for launch-readiness and auth/storage reviews |

## Redundancy / Merge Plan

### Cluster 1: workflow and PM skills

Overlapping skills:
- `agents-orchestrator`
- `chief-of-staff`
- `project-shepherd`
- `senior-project-manager`
- `workflow-optimizer`
- `workflow-architect`
- `product-manager`

Recommendation:
- Keep separate:
  - `workflow-architect` for system/workflow trees
  - `agents-orchestrator` for multi-agent routing
  - `chief-of-staff` for executive synthesis
- Treat as functionally merged in usage:
  - `project-shepherd` + `senior-project-manager`
- Route most tactical Hungry planning to:
  - Claude or Kimi for planning
  - `hungry-backlog-keeper` for operational status hygiene

### Cluster 2: UI/design review skills

Overlapping skills:
- `figma`
- `sn-ui-checklist`
- `emil-design-eng`
- `ui-ux-pro-max`
- `frontend-skill`
- `accessibility-auditor`
- `evidence-collector`

Recommendation:
- Keep separate:
  - `figma` for source-of-truth design access
  - `accessibility-auditor` for a11y
  - `evidence-collector` for proof-heavy QA
- Merge in practice through one route:
  - `hungry-design-closeout` -> `figma` -> `sn-ui-checklist` -> optional `accessibility-auditor`
- Do not use `ui-ux-pro-max` and `emil-design-eng` together by default.

### Cluster 3: Mapbox skills

Overlapping skills:
- all `mapbox-*` pattern skills

Recommendation:
- Keep separate physically
- Use one routing rule:
  - cartography/style/quality questions -> style/cartography/quality skills
  - implementation questions -> platform-specific Mapbox skill
  - store-locator patterns -> `mapbox-store-locator-patterns`
- Add one internal note: Hungry should prefer `mapbox-store-locator-patterns` first for product-facing map features.

## Optimization Plan

### Global improvements

1. Use a routing layer instead of directly picking from overlapping generic skills.
2. Favor project-specific skills for repetitive workflows.
3. Reserve proof-heavy QA skills for release/closeout, not everyday tasks.
4. Stop using broad PM skills for simple backlog maintenance.

### Prompt improvements

- Replace broad prompts like “audit everything” with bounded project prompts.
- Always include task IDs or workflow stage.
- Ask for exact evidence fields, not free-form summaries.

### Reliability improvements

- route status reconciliation through `hungry-backlog-keeper`
- route staging proof through `hungry-staging-smoke`
- route UI finalization through `hungry-design-closeout`
- route OCR/claim/Supabase supply work through `hungry-supply-ops`

## New Skill Recommendations

### Created now

#### `hungry-backlog-keeper`
- Purpose: reconcile canonical backlog, verification evidence, and session log
- Inputs: task IDs, repo state, docs
- Outputs: corrected rows, evidence, residual risk
- Example prompt: “Use `hungry-backlog-keeper` to verify `SEC-02` and `OCR-DG-04` and patch only stale canonical rows.”
- Integration: default closeout skill for Codex

#### `hungry-staging-smoke`
- Purpose: run done-gate staging smokes and record proof
- Inputs: staging targets, task IDs, environment
- Outputs: smoke proof, verification row updates, blocker notes
- Example prompt: “Use `hungry-staging-smoke` to close `OCR-DG-01` and `OCR-DG-02`.”
- Integration: primary Codex staging proof skill

#### `hungry-design-closeout`
- Purpose: close UI tasks against design source and acceptance criteria
- Inputs: screen/component, design source, task IDs
- Outputs: exact mismatch list or closure evidence
- Example prompt: “Use `hungry-design-closeout` for `C7` after implementation.”
- Integration: Gemini/Codex final UI pass

#### `hungry-supply-ops`
- Purpose: operate supply-side workflows around OCR, claims, Supabase, and ops review
- Inputs: supply task IDs, environment, target flow
- Outputs: bounded checks and operational evidence
- Example prompt: “Use `hungry-supply-ops` to verify the claim CTA path and the `dishes_draft` review surface.”
- Integration: Codex supply-side specialist skill

### Recommended next new skills

#### `hungry-release-readiness`
- Purpose: one-shot release candidate audit across backlog, verification, security, and deployment
- Inputs: sprint/release scope
- Outputs: go/no-go checklist
- Integration: Claude/Kimi release gating

#### `hungry-market-data-harvest`
- Purpose: unify venue/business/menu data collection across sitemap scraping, OCR, and structured enrichment
- Inputs: target mall/area/source
- Outputs: normalized supply dataset and ingest checklist
- Integration: supply expansion pipeline

#### `hungry-merchant-copy-pack`
- Purpose: consistent merchant-facing copy and verification messaging
- Inputs: claim surface, verification step, audience
- Outputs: CTA copy, explainer copy, FAQ copy
- Integration: Gemini/Kimi copy workflow

## Workflow Architecture

### Recommended pipelines

#### 1. Feature shipping
Claude or Kimi planning -> Gemini design direction -> Codex implementation -> `hungry-design-closeout` -> `hungry-backlog-keeper`

#### 2. Staging done-gate closure
Codex implementation -> `hungry-staging-smoke` -> `hungry-backlog-keeper` -> optional `reality-checker`

#### 3. Supply-side operations
`hungry-supply-ops` -> `supabase` -> `api-tester` -> `hungry-backlog-keeper`

#### 4. Release audit
`hungry-backlog-keeper` -> `hungry-staging-smoke` -> `security-engineer` -> `evidence-collector` -> optional `reality-checker`

## Priority Roadmap

### Highest impact
1. Route all active Hungry execution through the four new Hungry skills.
2. Stop using duplicate generic PM/orchestration skills for tactical backlog maintenance.
3. Standardize closeout through canonical evidence, not summary narration.

### Easiest to implement
1. Use `hungry-backlog-keeper` for every status reconciliation.
2. Use `hungry-staging-smoke` for Sprint 10 done-gate closure.
3. Use `hungry-design-closeout` for Gemini/Codex UI finish work.

### Best ROI
1. Create `hungry-release-readiness` next.
2. Create `hungry-market-data-harvest` next.
3. Narrow the active skill set per workstream instead of treating the entire skill pool as equally available.
