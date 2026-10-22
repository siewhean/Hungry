# Page expert audit brief — 20 October 2026

User requested thorough, honest page reviews by specialist agents with independent cross-checks. This is an audit, not an implementation or release authorization. Base HEAD: `50b2223e3ee058618bc23db48a97fb9fafac41ee`; current working tree is dirty, including auth/navigation/service changes. Audit actual current source; do not revert or edit app code. Never read/print secrets or .env values.

Read shared defaults `/Users/Siew Hean/Documents/GitHub/LLM_DEFAULTS.md`; apply AGENTS.md startup pointers, using bounded sections and current source over stale documentation. Root has read startup docs and found production flags differ from the user-provided historical registry. `src/constants/featureFlags.ts` and actual route registration are authoritative for reachability. Do not call gated beta/developer surfaces production blockers unless their path is reachable in production.

Your assignment gives a group key from `coverage-manifest.json`. Inspect EVERY assigned TSX, follow important shared components, feature/store/service/repository/SQL paths where needed, and account for each in a per-file coverage table. Inspect governing design first (`docs/audit/*_SPEC.md`, `design/figma-v2/*.html`, design/stitch or relevant approved research). Missing design is a documented audit gap; do not invent design fidelity proof. No UI edits.

Apply all lenses: product/task fit and Singapore dish-first discovery; information hierarchy/interaction/copy; accessibility (labels, focus, target size, contrast/font scaling/motion); behavior/navigation/auth; loading/empty/error/offline/retry; async/races/state persistence/draft loss; performance; data/provenance; backend permissions/security/privacy/abuse; test coverage. Clearly distinguish confirmed source defect, reasoned UX critique, runtime-only concern, missing external proof, and optional polish. Tests that regex source text are not runtime behavior proof.

Competitor comparison: choose 2–3 relevant real apps for your area (e.g. Google Maps, Burpple, Grab, Instagram, Notion, Spotify, Google Business Profile). Browse CURRENT FIRST-PARTY product/help pages for claims and include URLs; no unsupported claims of having used those apps. Compare user outcomes/patterns, not aesthetics by assertion. Rate Hungry honestly without copying unrelated product scope. Provide concrete 'keep/change' recommendations and tradeoffs. Use current official Apple/Google policy sources if making policy compliance claims, or defer to root policy review.

Output ONLY your own `docs/audit/page-review-2026-10-20/<group-key>.md`. Include:
- identity/role, exact scope and design sources, checked evidence and limitations;
- per-file page/support table: user purpose, release reachability, design source, what was inspected, finding IDs or no confirmed issue, runtime unverified items;
- findings ordered P0/P1/P2/P3 (P0 catastrophic, P1 core broken/security/data loss, P2 substantive usability/functional issue, P3 polish). Each needs stable group ID, class, exact file:line, trigger, consequence, evidence, recommendation, owner, verification to close. Do not inflate severity;
- explicit states/edge cases and backend/data path coverage; explain what actually passed and what remains unverified;
- first-party competitor comparisons and honest strengths/weaknesses;
- prioritized top recommendations, production vs gated-beta readiness implications.

No broad test suite, build, npm install, environment mutations, live writes, shared simulator navigation, or external messages. Root owns terminal/runtime checks. Focused read-only repro/test is fine if you record exact command/result and avoid interference. You may see root runtime artifacts later, but never claim inspection of screenshots you did not open. Root will arrange independent cross-review and final QA. Return concise top findings plus your report path and manifest file count. Do not spawn further agents (root schedules the finite slots).
