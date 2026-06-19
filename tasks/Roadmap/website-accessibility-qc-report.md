# Website Accessibility QC Report

Date: 2026-06-18
Target: WCAG 2.2 AA where applicable.

## Fixed

- Waitlist email validation now reports field-level errors before submit.
- Merchant waitlist required fields expose `aria-invalid` and `aria-describedby`.
- Waitlist success message uses `role="status"`.
- Contact page uses semantic sections, descriptive links, and visible focus states.
- Console waitlist filters have accessible labels.
- Console compact Exit button has an accessible name.
- Console table header contrast passes Lighthouse after switching to the stronger secondary text token.
- Local authenticated console Lighthouse accessibility score is 100 on `/console/waitlist`.
- Added shared Skip to main content link with focus-visible styling.
- Public pages, merchant auth pages, console layout, and merchant private shell now expose a `main-content` focus target.
- Static accessibility contract enforces the skip link and focus targets.
- Rendered production smoke confirms `/`, `/join-waitlist`, `/merchant/login`, `/merchant/signup`, and `/merchant/forgot-password` include the skip link and target; unauthenticated `/merchant` and `/console` still redirect before rendering.
- Automated keyboard smoke confirms first-Tab skip-link visibility, Enter-to-main focus, and unauthenticated private redirects across 12 public/auth pages and 2 private redirects.
- Local token-authenticated console keyboard smoke confirms `/console` and `/console/waitlist` expose the skip link and focus `main-content`.
- Merchant and console modal/drawer panels now expose `role="dialog"`, `aria-modal="true"`, and an accessible label. `npm run a11y:contracts` enforces this across the audited merchant/console modal files.
- Authenticated merchant keyboard smoke is now wired behind `HUNGRY_MERCHANT_ACCESS_TOKEN`; without that token the smoke logs a skip instead of falsely passing private merchant pages.

## Existing Strengths

- Public layout already has semantic nav labels.
- SEO/content images have descriptive alt text in the content registry.
- Reduced-motion handling exists in motion-heavy website components.

## Remaining Accessibility Blockers

- Staging authenticated private keyboard pass still requires a real merchant access token and console admin/non-admin role proof.
- Screen-reader smoke still required for waitlist error flow, private-route fallback, and console tables.
- Authenticated merchant Lighthouse/a11y scan still requires valid merchant staging credentials.
- Full manual screen-reader traversal still requires a human VoiceOver/TalkBack pass; source semantics are now covered by automated contracts where practical.
