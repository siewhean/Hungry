# Security Audit Report — Hungry Mobile

Date: 2026-04-22  
Scope references: `SECURITY.md`, `.agents/workflows/security_auditor.md`, `security-engineer` skill

## Summary

- Status: hardening pass applied for auth validation, input sanitization, trusted external links, and CI security gates.
- High-level result: no direct `0.85` dependency leakage, no `npm audit` vulnerabilities at `moderate+`, and no obvious token logging in app source.

## Findings & Remediation

1. Medium — Weak client password policy (8-char minimum, low complexity)
- Evidence:
  - `src/features/auth/validation.ts` previously allowed minimal password quality.
- Remediation applied:
  - Enforced minimum length 12.
  - Enforced uppercase/lowercase/digit/special-character requirements.
  - Updated auth screens to use new policy for sign-up/reset flows.
  - Updated unit tests for password policy.

2. Medium — Missing centralized user-input sanitization for free-text/search
- Evidence:
  - Search and review text previously accepted unsanitized content beyond whitespace trim.
- Remediation applied:
  - Added `src/lib/security/inputSanitization.ts`.
  - Search query sanitization + normalization in `src/store/useSearchStore.ts`.
  - Review text sanitization + max 500 chars in `src/store/useReviewDraftStore.ts`.
  - Post caption sanitization + max 280 chars in `src/app/screens/post/PostComposerScreen.tsx`.
  - Review input max length enforcement in `src/app/screens/review/ReviewScreen.tsx`.

3. Low — Unrestricted external URL opening in legal/support entry points
- Evidence:
  - Direct `Linking.openURL` usage in auth/settings.
- Remediation applied:
  - Added allowlisted URL opener `src/lib/security/safeLinking.ts` (HTTPS + `hungry.sg` hosts).
  - Migrated Sign Up legal links and Settings support links to safe opener.

4. Medium — Security workflow gates incomplete in CI
- Evidence:
  - Existing CI lacked dedicated secrets + dependency security job.
- Remediation applied:
  - Added `.github/workflows/security.yml` with:
    - `npm audit --audit-level=moderate`
    - `gitleaks`
    - `trufflehog`

5. Informational — Secret-pattern hygiene
- Evidence:
  - `.gitignore` did not explicitly include `secrets*`.
- Remediation applied:
  - Added `secrets*` to `.gitignore`.

## Security Auditor Checklist Status

1. Auth token handling
- No tokens in plaintext AsyncStorage path for Supabase auth: Pass (`src/lib/services/supabase/authStorage.ts`).
- No obvious token/password console logs in `src/`: Pass (source scan).
- Logout clears critical stores: Partial pass (`SettingsScreen` purge + session/profile/search/review/location reset; discovery/UI stores are session-reset-driven).

2. Navigation auth guards
- Protected-route redirect to login exists in root navigation: Pass (`src/app/navigation/RootNavigator.tsx`).
- GuestSoftGateSheet behavior: Not applicable in current auth-first runtime (documented divergence from older checklist).

3. Input sanitization
- Search sanitization: Pass.
- Review text cap + sanitization: Pass (500).
- Post caption cap + sanitization: Pass (280).
- Raw HTML rendering in text components: No direct `dangerouslySetInnerHTML` pattern in RN surface.

4. API surface
- HTTPS usage for key external links: Pass in migrated legal/support flows.
- Signed upload flow for Supabase media: Present in code (`mediaUpload.ts`).

5. Data exposure
- Developer launcher gated with `__DEV__`: Pass (`RootNavigator.tsx`).
- API keys in source: no obvious hardcoded server secrets found in scan.
- `.env` ignored: Pass.

6. Dependency audit
- `npm audit --audit-level=moderate`: Pass (0 vulnerabilities).

## Verification Run

- `npm audit --audit-level=moderate`: pass (`found 0 vulnerabilities`).
- `npm run typecheck`: pass after patch.
- `npm run test`: environment-related failures remain (Node/esbuild transform on RN package); unrelated to this security patch set.

## Residual Risks / Follow-ups

1. Add Have-I-Been-Pwned k-anonymity password breach check for sign-up/reset with graceful offline fallback.
2. Expand safe-linking allowlist enforcement to all `Linking.openURL` call sites.
3. Add automated tests for input sanitization utility (`sanitizeSearchQuery`, `sanitizeFreeText`).
