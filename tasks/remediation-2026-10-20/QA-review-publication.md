# Independent review publication QA

Reviewer: merchant/Edge remediation worker, independently reading root/contribution/database work. Source and focused tests only; no deployment or production mutations.

Inspected `supabaseService.reviews.submitReview`, `uploadReviewPhotos`, `reviewAttemptPayload`, `buildReviewMediaManifest`, composer publishing, and migration `20261020132428_remediation_review_publication.sql` plus its isolated-database smoke assertions.

- Client retains stable review ID, fingerprints ordered photo bytes and payload, uploads to account/review/attempt namespace, checks account generation before publication and after acknowledgements, validates matching receipt. No destructive pre-publication media replacement.
- Manifest helper recovers lost acknowledgements by listing exact attempt metadata, preserves order, reports exact partial-photo failure, and aborts on account change. Existing assets remain available for retry.
- RPC authenticates owner, rejects target changes and mismatched dish/venue, serializes same review identity, validates private bucket/path/order/size/MIME, rejects duplicate media and nonce reuse with different payload, and swaps complete manifest in one transaction.
- Bucket is private; restrictive policies prevent client overwrite and nonpublished read. Direct review/manifest mutations are blocked; published/current and historical receipt media are protected from cleanup with shared advisory identity lock. Legacy published media is preserved.
- Composite review cursors include rating when sorting by rating, plus createdAt/id; ordinary reads remain security invoker and apply author/content boundaries.
- Composer requires explicit dish selection, retains retry identity, checks account generations, and does not write new-account local feed after a late receipt.

Verification: focused `reviewPublication.test.ts`, `reviewMediaManifest.test.ts`, `publishing.test.ts`: **13 passed, 0 failed**; evidence `qa-publication-tests.log`. These include changed bytes at same URI, acknowledgement loss, partial media failure, account transitions, explicit dish selection, post-step failure, and retry deduplication.

No new source blocker identified in this bounded inspection. SQL smoke definitions were inspected, not rerun by this reviewer; clean/upgrade RLS role proof belongs to the database worker evidence. Real signed-storage, hosted RPC/provider acknowledgement, native media, and device/network acceptance remain open until separately demonstrated.
