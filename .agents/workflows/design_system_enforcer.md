---
description: Design system enforcer — audit Hungry token, primitive, and component consistency
---

# Design System Enforcer Agent

Keep Hungry visually and behaviorally consistent without applying brittle “zero literal” rules that ignore geometry, platform constraints, or existing primitives.

## Source of truth

```text
src/theme/
src/components/ui/
tasks/design-system.md
docs/DESIGN_STANDARDS.md
PROJECT_INSTRUCTIONS.md
approved task-specific design source
```

Inspect the current exports before assuming token or hook names.

## Core rules

1. Use theme palette, semantic spacing, radii, typography, motion, shadow, and z-index tokens when an appropriate token exists.
2. Use shared primitives for repeated behavior and accessibility: text, buttons, inputs, chips, cards, images, empty states, dialogs, sheets, tabs, and headers.
3. Do not create a second component or token system for one screen.
4. Raw React Native primitives are allowed when the shared primitive cannot express required native behavior; document reusable patterns and extract them when repetition appears.
5. Named local constants are allowed for media ratios, geometry, safe-area calculations, animation interpolation, and platform-specific dimensions.
6. Hardcoded brand colours, arbitrary typography, duplicated shadows/radii, or unexplained spacing in product screens are violations.
7. Shared components must preserve accessible names, roles, states, text scaling, reduced motion, and dark-mode behavior.

## Audit checklist

### Tokens and colours

- no unapproved hex/rgb colour in product screens;
- contrast-sensitive semantic pairs use tested tokens;
- status colours are paired with labels/icons, not colour alone;
- light/dark mode paths do not embed one-mode assumptions.

### Typography

- user-facing text uses `AppText` or an approved equivalent;
- variants and weights follow hierarchy;
- price/code/unit typography is consistent;
- large-text behavior is intentional and tested.

### Spacing, radii, and layout

- repeated spacing/radius/elevation uses tokens;
- local geometry constants have descriptive names and a clear reason;
- screens use shared safe-area/screen shells where compatible;
- list/sheet/modal spacing is consistent without excessive blank space.

### Components

Search for repeated one-off implementations of:

- CTA buttons;
- icon buttons;
- filter chips and rails;
- inputs/search fields;
- cards/media shells;
- loading/empty/error states;
- modal/sheet headers and dismiss controls;
- bottom tabs and settings rows.

Prefer extending an existing primitive over copying styles into another screen, but do not make a shared component overly generic for a single use.

### Assets and media

- use canonical brand assets;
- production catalog cards use approved menu/stall imagery;
- no generic stock/Unsplash fallback;
- image treatment and unavailable states are consistent.

## Suggested searches

Use repository search and focused lint/contracts rather than assuming every numeric literal is wrong. Examples:

```bash
git grep -nE '#[0-9a-fA-F]{6,8}' -- 'src/**/*.ts' 'src/**/*.tsx'
git grep -nE '<(Text|TextInput)([ >])' -- 'src/app/**/*.tsx' 'src/components/**/*.tsx'
git grep -nE 'borderRadius: [0-9]|fontFamily:|shadowOpacity:' -- 'src/app/**/*.tsx'
```

Review each result in context. Exempt generated data, tests, documented native constraints, and canonical token definitions.

## Execution

1. Inventory the scoped screens and primitives.
2. Run existing design/accessibility contracts and focused searches.
3. Inspect rendered UI before proposing refactors.
4. Consolidate genuine duplication and remove newly orphaned styles/components/imports.
5. Re-run typecheck, lint, focused tests, and rendered QA.
6. Record findings in the current task audit and proof in `tasks/verification.md`; do not create a loose root `design_system_report.md`.

## Pass criteria

- No competing token/component system.
- No unexplained brand-colour, typography, radius, shadow, or repeated spacing drift.
- Shared primitives remain accessible and platform-correct.
- Any local exceptions are named, justified, and not duplicated.
- Visual regression evidence confirms the refactor did not damage the UI.
