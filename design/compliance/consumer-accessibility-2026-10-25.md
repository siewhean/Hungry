# Consumer transparency and accessibility delta

Governing source: `marketing/website/website v2/website_redesign_master_brief.md`, especially sample UI without fake testimonials, semantic food imagery, reduced motion and existing warm-paper/navy/orange system; `docs/accessibility-style-guide.md`.

- Keep the existing layout and typography. Place an ordinary visible preview disclosure in hero/showcase copy, beside each phone-preview group. Sample prices, ratings and open statuses are illustrative, not current merchant facts.
- Replace invented named customer quotes and engagement counts with a truthful empty review state. No testimonials, star ratings or social proof without a source.
- Retain brand orange as a separate decorative token. Use a darker orange for functional controls/text and a darker muted foreground, meeting 4.5:1 on documented warm/light surfaces. Keep a navy focus ring with a white separation halo.
- Preserve meaningful image alternatives; decorative duplicate food images retain empty alt. Scroll rails are labelled keyboard-focusable regions with Left/Right and Home/End support. Explicit controls remain native buttons; respect reduced motion.
- At widths below 700px, keep the product phone preview in normal flow: visual review found the existing single-column sticky phone covered step headings and body copy. Tablet/desktop retain the approved two-column sticky treatment.
- Product-story steps remain ordinary reading content. Increase progress-control target height to 24px while retaining the slim visual indicator.

Review: compare these bounded deltas with the governing brief; run computed contrast tests, existing accessibility source contracts, and browser keyboard/visual smoke when the parent server is available. Native screen-reader acceptance remains separate.
