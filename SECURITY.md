# Security Policy

## Reporting a Vulnerability

- Report vulnerabilities privately to `tohsh17@gmail.com`.
- Until dedicated domain inboxes are provisioned in production, use `tohsh17@gmail.com` as the disclosure channel.
- Include the affected feature, reproduction steps, impact, and supporting artifacts.
- Do not publish exploit details until the CmdTab team confirms the issue is resolved.

## Current Public Scope

- `website/` marketing site
- `website/src/app/api/waitlist/route.ts` waitlist submission endpoint
- CmdTab private beta macOS app bundle and settings surface

## Security Baseline

- Waitlist submissions use strict JSON validation, same-origin enforcement, honeypot handling, duplicate suppression, and request throttling.
- The website ships CSP, HSTS in production, clickjacking protection, and cross-origin isolation headers.
- Waitlist submissions are delivered server-side through Resend. Secrets are environment-driven and are not checked into the repo.
- The production CSP still allows inline scripts because of the current Next.js / analytics bootstrap path. Keep the site surface minimal and move to nonce- or hash-based CSP if the surface grows.
- Production should still enable Vercel WAF / rate limiting and verified sending domains before launch.

## Secret Handling

- Keep production secrets only in Vercel environment variables. Do not commit live values to the repo, screenshots, or local dotfiles that are shared publicly.
- Use separate secrets for preview and production environments.
- Rotate `RESEND_API_KEY` immediately if a leak is suspected, then redeploy the site and verify email delivery again.

## Incident Response

- If the waitlist endpoint is abused or compromised, first disable public traffic or tighten WAF rules, then rotate affected secrets and inspect Vercel / Resend logs.
- If a vulnerability could have exposed user data, preserve logs, identify impacted submissions, and prepare a user-facing communication plan before re-enabling traffic.
- After containment, ship the fix, redeploy, re-run `npm run security:check`, and document the root cause plus the permanent prevention step.

## Owner Responsibilities Before Public Launch

- Replace `tohsh17@gmail.com` with dedicated domain inboxes before public launch scale.
- Enable Vercel Firewall / bot protection and review request logs for the waitlist endpoint.
- Verify the Resend sender domain and keep secrets only in deployment environment variables.
- Code-sign, notarize, and staple the macOS app before public distribution.
- Run a clean-machine install test and a browser-level verification pass before turning on paid traffic.
