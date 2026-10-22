# Review publication/provider integration QA — 20 October 2026

Scope: independent inspection of the integrator-authored Supabase review provider, mock provider parity and database publication/read contracts; follow-up page review by `fix_discovery_maps`. This is source/local behavioral evidence, not native, deployed storage or staging acceptance.

## Confirmed integration defects repaired

1. **Immutable retry discovery was unauthorized.** The client listed unpublished private media, while storage SELECT correctly permits published manifests only. Upload attempts now use `list_review_attempt_media_v2`, which returns metadata for the authenticated owner's exact review/version prefix. Lost upload acknowledgements re-check that exact attempt and reuse immutable objects without overwriting. Partial failures identify the failed photo and preserve prior uploads. No broad byte-read permission was added.
2. **URI-only attempt fingerprints reused changed bytes.** The same local URI can contain changed media. Attempts now fingerprint original media content digests together with the complete review payload; changed bytes create a new immutable version. Publication confirms the exact receipt ID and account generation after the RPC.
3. **Feed search filtered only text and could limit before catalog visibility.** `list_recent_reviews_v2` performs author/catalog visibility, dish/stall/text/tag query filtering and venue filtering before limiting. It supports deterministic rating/time/ID or time/ID boundaries. Missing metadata/read failures propagate, while genuine empty arrays remain empty. Review IDs/dates are never fabricated when response identity is invalid.
4. **JavaScript date normalization loses PostgreSQL microseconds.** Cursor strings retain their original precision; mock sorting/paging uses precise timestamp keys. Same-millisecond, distinct-microsecond tests prove the boundary remains intact.
5. **Mock review writes were fake receipts only.** The mock now stores actual review content with canonical author identity, exposes it through review reads/feed, supports idempotent retry and revision, and rejects another account reusing a review identity. It uses the same validated query/sort/cursor semantics as the provider. The mounted feed uses the asynchronous service in both modes.
6. **Native removal/picker account boundaries needed follow-up.** Both contribution editors use React Navigation `usePreventRemove` with Keep editing/Save draft/Discard actions. The bypass re-arms after dispatch, including a no-op pop. Venue selection uses bounded asynchronous location/query search. Dish-only routes resolve the canonical venue and explicitly reconcile an existing draft. Gallery responses captured before an account transition cannot mutate the new account's draft.
7. **Shared external handoff counted failures.** The shared messaging helper now returns false for failed/cancelled handoffs and records analytics only after a confirmed handoff. Actual post/stall consumers explicitly label their entity; review consumers remain Share dish. Per-recipient sends retain stable nonces and failed-only retry selection.

The database specialist implemented both exact RPC contracts and reported passing SQL fixture checks for composite ties, literal query handling, incomplete cursor denial and stranger attempt-metadata denial. Their canonical SQL evidence remains the authority for database behavior.

## Verification

- `publication-focused-tests.log`: **60 passed, 0 failed**. Includes mock service regressions, exact target publication, idempotency, immutable media recovery/partial failure, content fingerprints, query-before-limit, rating/time/ID ties and microsecond cursor precision.
- Focused ESLint of updated review/post screens and new publication/share/native-guard helpers: passed.
- `publication-qaqc-followup.log`: **14 passed, 0 failed**. Includes updated native guard/share source contracts, handoff outcomes and delayed account-callback negative behavior.
- `publication-full-tests.log`: requested full `npm test` run completed with **774 tests, 764 passed, 8 failed, 2 skipped**. Failures were reported to the integrator; they include stale native/composer, route/prefetch, onboarding/login, review-share and social-share contracts. This failed run is preserved; it is not reported as passing. Later integrated reruns are separate evidence.
- Initial earlier focused run without the mock provider failed; corrected runs use `HUNGRY_DATA_SOURCE=mock`. An intervening Node React Native import failure was corrected by the integrator's pure account-cleanup boundary; subsequent publication behavioral checks pass.

## Remaining proof

Fresh built iOS/Android native back gestures, gallery permission/cancellation, process recreation/media lifetime, keyboard/large text/focus/VoiceOver/TalkBack, actual WhatsApp/Telegram/system handoff, exact deployed storage/RPC permissions, migration clean/upgrade replay and full staged publication failure/retry acceptance require their corresponding native/staging evidence. No production deployment was performed. The integrator owns final typecheck/full suite and canonical closure ledger.
