# Consumer safeguards — 25 October 2026

Scope: active `marketing/website/web-v2` website and the consumer mobile app, isolated from `origin/main` on `codex/privacy-consumer-safeguards`. Historical `marketing/web`, design exports, and data workbooks were not changed. This is source implementation and bounded local verification, not a legal certification, deployment, or confirmation of provider settings.

## Requested checklist

| # | Request | Implementation / evidence | Remaining acceptance |
|---|---|---|---|
| 1 | Privacy policy | `/privacy` covers chosen features, processors, permissions, retention, adult launch restriction, withdrawal, access/correction/deletion | Operator identity, DPO appointment, processor contracts/transfers and actual retention schedules need owner confirmation |
| 2 | Terms of service | `/terms`, linked from footer and app signup/settings | Owner/legal review before public release |
| 3 | Refund policy | `/refund`: distinguishes discovery from purchases made with third parties; no invented Hungry refund entitlement or waiver of statutory rights | Revisit before enabling Hungry payments or paid services |
| 4 | Cookie policy | `/cookies` describes merchant session/CSRF cookies, essential preference storage and optional analytics | Confirm deployed provider/browser storage inventory |
| 5 | Cookie consent banner | Equal accept/reject controls, default-off analytics, persistent preferences, withdrawal, GPC/DNT handling, 180-day website preference | Actual provider collection/retention and previously sent requests cannot be undone by the banner |
| 6 | Form consents | Explicit unchecked purpose/adult controls; server checks on waitlist/merchant signup; no silent merchant waitlist subscription; app signup attestation on both paths | Mobile adult check is self-attestation, not verified identity or a server parental-consent system |
| 7 | No unnecessary data | Waitlist drops user-agent/referrer capture; merchant business details optional for interest list; no DOB; mobile optional analytics off; telemetry minimization | Review provider hosting/security logs and existing records operationally |
| 8 | Third-party SDK audit | Inventory below; mobile PostHog consent and queue gates; Sentry default PII/performance disabled; Mapbox optional telemetry disabled before map mount | Native device/network evidence, store declarations, vendor DPAs/regions/retention not verified |
| 9 | Remove dark patterns | Equal cookie choices, accessible reopen, no preselected consent, honest form success, no auto-enrollment from merchant signup | Complete device assistive-technology testing |
| 10 | Remove hidden fees | Reviewed public flows contain no payment/checkout; refund/terms explain external charges must be checked with merchant/provider | No audit claim for external merchants’ checkouts |
| 11 | Remove fake reviews | Invented named review, rating, and engagement UI removed from website phone preview; remaining sample product data visibly labelled | Existing app mock fixtures remain for development; no live review database mutations |
| 12 | Remove unsupported claims | Removed exclusivity, guaranteed live-hours and identity-prevention claims; preview imagery not presented as verified stall photography | Catalogue accuracy and live-provider audit remain separate |
| 13 | Accessibility alt text | Existing semantic image contract retained; public marketing photo alt text/source checks | VoiceOver/TalkBack acceptance on actual device |
| 14 | Colour contrast | Darker website text/primary tokens and source contrast checks | Image overlays and all interactive states still need broad manual visual coverage |
| 15 | Keyboard navigation | Visible focus, native controls, skip link, culture carousel keyboard controls and reduced-motion handling | Local browser coverage only; no full assistive-technology certification |
| 16 | Business details | `/business` publishes product/market/support facts only | No verified registered operator name, UEN, address or DPO appointment supplied; never fabricated |
| 17 | Kids’ data | Current signup/personal-data submissions restricted to 18+, without DOB collection; child-data removal contact | Product choice, not Singapore’s legal consent age. Do not onboard children until a separately designed and verified guardian workflow exists |
| 18 | Email unsubscribe | Visible manual `mailto:` unsubscribe request on contact/privacy surfaces | Existing sender only sends transactional authentication messages. No marketing email sender or durable suppression system exists here; campaigns must not launch until provider unsubscribe, suppression and end-to-end tests exist |
| 19 | Font/image licences | Full OFL texts for Nunito/DM Mono/Fraunces; public `/credits` lists existing three CC BY-SA photos with creator/source/licence links and crop notice | Other brand/generated/food asset ownership and provenance need evidence; notices alone do not acquire rights |
| 20 | Data deletion request | Existing in-app export/deletion/cancellation controls retained; `/account/delete` covers account and other submitted data with manual request link | Actual scheduled worker operation and complete remote/storage purge require production/staging receipts; no completion guarantee from UI |

## SDK and processing inventory

Versions below are resolved from this worktree’s lockfiles, not assertions about a shipped binary.

| Integration | Locked version | Purpose/data boundary | Source controls / action |
|---|---|---|---|
| `posthog-react-native` | 4.42.0 | Optional product events and experiment assignment; pseudonymous IDs are still personal data | App Settings opt-in defaults off; initialize only after consent; no replay/lifecycle auto-capture; in-memory SDK queue; disabled geoip; withdrawal drops pending queue and gates SDK fetch/retries. `src/lib/analytics/posthogSink.ts`, `src/store/useAnalyticsConsentStore.ts` |
| `@vercel/analytics` (website) | 1.6.1 | Optional website page/custom events | Consent-gated mount and send-time gate, omit URL query/hash and exclude private merchant/console routes. `src/components/privacy/`, `src/lib/privacy/consent.ts` under website |
| `@sentry/react-native` | 7.11.0 | Error diagnostics when configured; minimized diagnostics remain separate from optional product analytics | `App.tsx` explicitly sets `sendDefaultPii: false`, `enableAutoPerformanceTracing: false`, `tracesSampleRate: 0`; existing event/breadcrumb scrubbing retained. Native crash payload/network retention needs device/provider verification |
| `@rnmapbox/maps` | 10.3.8 | Requested map rendering; map/tile provider necessarily observes requests | Disable optional telemetry before MapView mount; keep required logo/attribution. Foreground location chosen by user; manual location fallback preserved. Native initialization/provider behaviour needs device smoke |
| `@supabase/supabase-js` | 2.108.2 | Necessary auth/data/storage/realtime for selected features | Existing session isolation, secure storage, deletion worker and RLS remain. No production data or configuration mutation in this task |
| `expo-location` | 57.0.22 | Foreground nearby lookup after permission | Existing balanced foreground permission and manual area fallback; no background-location expansion |
| `expo-image-picker` | 57.0.20 | User-selected media uploads | Existing picker permission and media validation; no new microphone/background permission |
| `expo-updates` | 57.0.26 | App update delivery | Necessary operational requests; review Expo/EAS release configuration and store disclosures before publishing |
| Resend through `send-email` Edge Function | HTTP service | Authentication OTP/recovery/invitation messages | Existing authenticated webhook/action allowlist; no campaign sender added. External template contents were not edited or verified |
| Google OCR/AI / Places integrations | Configuration dependent | Images/extracted content or places requests when enabled | Privacy notice describes potential processors; no new integration enabled. Retention/training and provider agreements need owner review |
| Vercel hosting / optional Redis rate-limit service | Deployment dependent | Hosting/security request metadata; existing IP-based rate limiting | Essential security processing is separate from analytics; do not claim zero logs or cookie refusal disables server security logs |

## Asset rights evidence

- Fraunces additionally preserves the 2020 copyright embedded in the bundled font alongside the upstream 2018 notice.
- `licenses/fonts/{Nunito,DMMono,Fraunces}-OFL.txt` and public copies preserve upstream copyright and full SIL OFL 1.1 terms. Source: Google Fonts `ofl/nunito`, `ofl/dmmono`, `ofl/fraunces` `OFL.txt` files, fetched over verified HTTPS on 2026-10-25.
- The existing `public/images/ATTRIBUTION.md` identifies three Wikimedia photos. `/credits` now exposes their creator, source, CC BY-SA version and responsive crop disclosure to website/app users.
- Existing catalogue provenance/display guardrails are not proof of permission for every repository asset. Do not promote scraped marketplace photos/logos or unverified catalogue assets based only on a URL or this report.
- Public licence notices are accessible from app Settings. Packaging and offline access to licence notices in store-distributed binaries remains a release check.

## Owner and operational follow-up

The user asked whether a business is necessary just to create an app. Building an app does not itself require company incorporation; developer enrolment and conducting business have different requirements. No company identity, UEN, home address, DPO appointment or service-level promise was invented. Confirm the responsible operator and privacy contact before accepting public personal-data submissions. ACRA registration and store-specific public disclosure requirements must be assessed for the actual launch model.

The manual unsubscribe/deletion links open an email draft; they do not send mail, register a server request, prove suppression, or prove deletion. Existing authentication messages remain transactional. No marketing campaign was sent or enabled.

## Design references

- `design/consumer-safeguards-mobile.md`
- `design/compliance/consumer-accessibility-2026-10-25.md`
- `marketing/website/website v2/consumer-policy-design.md`
- `design/compliance/website-consent.md`

## Official reference review

These guided scope/copy, not a claim of legal approval:

- [PDPA — duties and public DPO business contact](https://sso.agc.gov.sg/Act/PDPA2012?ProvIds=pr11-.)
- [PDPC guidance on children’s data](https://www.pdpc.gov.sg/-/media/files/pdpc/pdf-files/advisory-guidelines/advisory-guidelines-on-the-pdpa-for-children%27s-personal-data-in-the-digital-environment_mar24.pdf)
- [CCS price transparency](https://www.ccs.gov.sg/consumer-protection/legislation-and-guidelines/guidelines-on-price-transparency/)
- [IMDA unsolicited communications](https://www.imda.gov.sg/infocomm-regulation-and-guides/unsolicited-communications/guides-for-consumers)
- [ACRA registration requirements](https://www.acra.gov.sg/register/business/requirements-eligibility/)
- [Apple developer enrolment](https://developer.apple.com/help/account/membership/program-enrollment)

Verification: full source suite 2,107 pass, 2 existing skips, 0 failures; website TypeScript and focused legal/security/accessibility/consent tests pass. The browser manifest at `docs/audit/consumer-safeguards-browser/results.json` records 16 desktop/mobile route checks and zero console/page errors; screenshot review and a measured bounds regression verify the mobile story preview no longer overlaps text. Independent final QA found no remaining actionable source issues. Root app typecheck, render tests and lint remain blocked by the existing dependencies/type issues recorded in `tasks/verification.md`.

Verification commands, results and known limitations are recorded in `tasks/verification.md`. Native builds are deferred while the host has roughly 4–5 GiB free.
