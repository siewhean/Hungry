# Hungry Release 0.1 — Soft-Launch Rollout and Rollback Checklist

## Before launch

- [ ] Final Go/No-Go signed.
- [ ] Implementation, evidence, artifact and catalog IDs agree.
- [ ] CI/Security/protected release workflow green.
- [ ] Supabase capacity, migrations, Advisor and RLS pass.
- [ ] iOS and Android store artifacts approved.
- [ ] Privacy, support and account-deletion URLs live.
- [ ] Store privacy/data declarations match released config.
- [ ] Sentry, source maps, analytics and alerts verified.
- [ ] Support and incident owners on call.
- [ ] Last-known-good native, OTA and catalog rollback targets recorded.
- [ ] Pilot catalog and initial Discover images sampled.

## Launch

- [ ] Release to smallest approved cohort/percentage.
- [ ] Verify install/upgrade on iOS and Android.
- [ ] Verify fresh auth and returning session.
- [ ] Verify Supabase catalog and one controlled fallback test in production-safe form.
- [ ] Verify search, details, directions, settings and deletion entry point.
- [ ] Confirm monitoring receives current build/release identities.
- [ ] Publish internal launch status and next review time.

## Expansion gate

Before each expansion:

- [ ] Previous cohort has sufficient sessions.
- [ ] Startup/crash/auth/catalog thresholds pass.
- [ ] No P0; no unowned P1.
- [ ] Catalog trust sample passes.
- [ ] Support backlog is manageable.
- [ ] Rollback target still available.
- [ ] Release owner approves expansion.

## Pause gate

Pause immediately for:

- security/privacy/auth bypass;
- crash loop or startup collapse;
- catalog outage with fallback failure;
- unsafe/wrong content affecting trust;
- account-deletion failure;
- monitoring or rollback uncertainty;
- artifact/source identity mismatch.

## Rollback decision tree

### JavaScript/UI-only regression compatible with runtime

1. Pause rollout.
2. Republish last-known-good EAS Update.
3. Verify primary journey and monitoring.
4. Record old/new update IDs.

### Native code/config/permission regression

1. Pause/remove affected build where possible.
2. Prepare replacement native binary.
3. Do not attempt an incompatible OTA workaround.
4. Re-run store review/track process.

### Catalog regression

1. Repoint to last-known-good catalog release.
2. Keep bad release immutable and quarantined.
3. Verify exact pilot, paging, details and images.
4. Publish corrected release only after quality gate passes.

### Database/auth incident

1. Stop rollout and writes as needed.
2. Follow incident commander/database owner decision.
3. Rotate/revoke credentials or sessions if required.
4. Restore or forward-fix through reviewed migration procedure.
5. Rerun security and RLS smokes.

## After rollback

- [ ] Monitoring confirms recovery.
- [ ] User-facing impact communicated appropriately.
- [ ] Incident issue updated.
- [ ] Root cause and regression test created.
- [ ] Replacement evidence tied to new SHA/artifacts.
- [ ] Expansion remains paused until a new Go decision.
