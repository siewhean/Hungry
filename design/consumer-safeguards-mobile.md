# Mobile consumer safeguards — 25 October 2026

Governing sources: `design/stitch/STITCH_BRIEFS.md` section 03 (compact signup, fields, terms note) and `design/stitch/iterations-11940609752387078506/settings/index.html` (grouped settings). This additive design defines missing controls before implementation.

Both signup forms: two unchecked, focusable checkbox rows before the primary action: “I am 18 or older.” and “I agree to the Terms of service and have read the Privacy policy.” Retain separate policy links. No bundled marketing or analytics permission. Missing confirmation gives an inline accessible error before email/provider auth. No birth date or guardian identity. Email login is unaffected. Provider login can create accounts, so the same confirmations and policy links appear before Google/Apple on Login and on the onboarding login tab when providers are enabled. Self-attestation is not verified age assurance; server enforcement remains launch acceptance.

Settings / Data & privacy: existing toggle row “Optional usage analytics”, off by default, explains PostHog and withdrawal. Block SDK initialization/flags absent opt-in. Disable automatic lifecycle/session recording. Remove queued events on withdrawal.

Settings / Support: Refund policy, Cookie policy, Credits and licences links use existing rows and tokens. Preserve export/deletion controls.

Review: 44pt targets, checkbox role/checked state, separate links, theme tokens, linear focus order. Native keyboard/screen-reader acceptance requires runtime proof.
