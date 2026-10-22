# Independent QA: home/social and merchant

Reviewer: saved-tools implementation agent; reviewing other owners' changes. Evidence is local source and focused behavioral tests, not native/staging certification.

## Confirmed causes and corrections

1. **Chat scope leak (corrected by reviewer).** `ChatDetailScreen` retained old messages while a different account/conversation history merged into them. Rows now carry the loaded account/conversation scope, hide immediately when the active scope differs, clear before the next subscription/history starts, and merge only concurrent messages from that scope. Sending settlements capture account/conversation generation; stale success/error/finally cannot clear a new draft or change new sending state. Late realtime error callbacks reject inactive effects.
2. **Direct-message account/safety leak (corrected by reviewer).** Focus loading omitted the account dependency and blocked participants remained visible. Reload now follows account identity, clears prior rows, hides any rows tagged to the old account immediately, and reacts to safety revisions with canonical participant-ID filtering.
3. **Activity Inbox account/safety leak (owner followup requested).** Its conversation request/focus callbacks omitted account identity; old rows and unread counts used the unfiltered conversation list. Home/social owner has the precise cause and requested correction. Closure requires owner response and reviewer reinspection.
4. **Merchant mutation outlet/account race (owner followup requested).** OCR accept/reject/batch and DishEditor save guarded loads but not asynchronous mutation settlements. An old-outlet completion could clear a new outlet's edit and show success on the wrong context; batch could continue writes after a switch. Reinspection confirms `useMerchantOperationScope` subscribes to account/outlet changes, increments generation across switch-away-and-back and unmount, and guards mutation settlements in OCR/DishEditor/reply paths. OCR batch receives the captured continuation predicate, so subsequent writes stop after the scope changes. Reply drafts write using the captured account owner. Two operation-scope regressions and one reply-draft regression passed. Live/native mutation switching remains open.
5. **Mock review query parity (owner followup requested).** `getReviewsForVenue` used only venue filtering and limit, ignoring query, sort and composite cursor. Contributions owner notified to make the mock honor the service contract; timestamp-only legacy recent feed separately flagged.

## Checks

- `HUNGRY_DATA_SOURCE=mock HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/features/home/socialState.test.ts src/features/home/chatDelivery.test.ts src/store/useChatDraftStore.test.ts`: **8 passed, 0 failed**. Covers history/realtime merge, stable nonce/idempotent delivery, draft preservation and account key partitioning, activity filtering and canonical identity.
- Same environment, `node --import tsx --test src/features/merchant/workflowSafety.test.ts src/features/merchant/profileValidation.test.ts src/features/merchant/promotionValidation.test.ts src/features/merchant/verificationStateMachine.test.ts`: **14 passed, 0 failed**. Covers price rejection, retained flags, Singapore dates, batch partial outcomes, OCR corrections/idempotency and verification history.
- `node scripts/run-eslint.cjs src/app/screens/home/ChatDetailScreen.tsx src/app/screens/home/DirectMessagesScreen.tsx`: passed.
- Terminal emitted the existing Node `DEP0205 module.register()` deprecation warning. No test failures in these runs.

## Outstanding proof

No identifiable simulator/device build was run by this reviewer. Account-switch navigation, realtime disconnect/reconnect, native keyboard/large-text/accessibility, live merchant authorization, partial storage upload and production migration behavior remain outside this source/unit evidence. The merchant operation-scope model was behaviorally tested and screen guards reinspected; simulator interaction and real network/storage completion timing remain unverified.

## Followup check

- `node --import tsx --test src/store/saved-tools-remediation.test.ts src/features/merchant/operationScope.test.ts src/features/merchant/replyDraftModel.test.ts` (same mock environment): **11 passed, 0 failed**. Merchant mutation scope and captured-owner draft guards were independently reinspected.
