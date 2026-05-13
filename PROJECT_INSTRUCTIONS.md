# Project Instructions

## Working Style

- Keep changes scoped to the problem being asked about.
- Avoid editing unrelated sections when fixing an issue.
- Prefer simple, direct solutions over broad rewrites.
- Record recurring guidance as explicit project instructions when it becomes a stable rule.
- After every implementation batch, or whenever a task is completed, update `tasks/todo.md` so progress, status, and follow-up notes stay current.

## Design Workflow

- Before implementing any UI, identify the governing design source first: Figma, `design/` prototype, or an approved design file in `Research/`.
- Do not implement or restyle a screen from memory, guesswork, or code-only intuition when a design file exists.
- If no design file exists for the requested UI, stop and create or confirm the design direction before implementation.
- Every shipped UI change should be traceable back to a concrete design artifact.
- Run a design review against the approved design source before considering UI work complete.

## Design Philosophy

- Avoid vibe-coded website patterns.
- Create a design system first. Inconsistency is a stronger negative signal than any single visual decision.
- Keep interfaces simple when simplicity is appropriate.
- Prefer polished, intentional UI over generic SaaS-looking layouts.
- Use subtle, purposeful visual treatment rather than flashy effects.

## Colors And Visuals

- Do not use default purple gradients unless they are genuinely brand-appropriate.
- Remove sparkles and emojis from hero headings.
- Eliminate generic glowing hover effects.
- Keep icon sizing proportional to surrounding text.
- Remove non-functional social icons.

## Typography

- Maintain a consistent weight hierarchy.
- Avoid oversized headings paired with ultra-thin body text.
- Use uniform line-height and paragraph spacing.
- Define a type scale and stick to it.

## Layout And Components

- Keep component placement consistent across pages.
- Use a small, consistent set of border radius values.
- Keep hover states subtle, with only small lift when needed.
- Avoid arbitrary layout shifts between pages.
- Make page structure feel systematic rather than improvised.

## Animations And Interactions

- Use easing curves intentionally.
- Stagger timing only when it adds clarity.
- Every animation should serve a purpose.
- Avoid decorative motion that does not improve clarity, feedback, or usability.

## UX Behavior

- Use loading feedback based on expected wait and known layout:
  - If the wait is more than 300ms and the shape of the page/content is known, use skeletons that match the eventual structure and reserve the exact space of the real button, card, row, list, feed, or article.
  - If the wait is less than 300ms and the duration is unknown, use a spinner.
  - If the change or update completes in less than 300ms, show no loading UI.
  - If the user is uploading something with a known percentage and the upload takes more than 3 seconds, use a progress bar.
  - Use optimistic UI with rollback on failure only for interactions that are expected to succeed at least 99% of the time, such as likes, saves, and bookmarks.
- Add loading states for async actions according to the above thresholds.
- Add progress indicators on buttons only when they clarify an action in progress.
- Make toggles, carousels, and interactions functional, not decorative.
- Use skeleton screens for data-heavy sections only when the wait threshold and known-shape rules apply; the skeleton must take up the same width, height, padding, and spacing as the final component it replaces.
- Keep admin and protected routes properly gated and not accessible by URL alone.

## Copywriting

- Keep website copy concise and to the point.
- Remove unnecessary sections instead of filling space.
- Avoid vague startup phrases such as:
  - "Launch faster"
  - "Build your dreams"
  - "Create without limits"
- Avoid fake testimonials.
- Avoid placeholder personas or generic AI-marketing names.
- Avoid spammy lifecycle messaging. Communication should be restrained and useful.

## Product Presentation

- Show real product behavior rather than abstract marketing.
- Prefer live walkthroughs, actual usage flows, and believable demonstrations.
- Keep public-facing messaging professional and deliberate.

## Operational Preferences

- Use Singapore time for admin and dashboard date-time presentation.
