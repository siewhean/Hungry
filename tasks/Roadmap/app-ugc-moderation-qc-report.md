# App UGC Moderation QC Report

Updated: 2026-06-21
Status: **No-Go for full-platform release until live UGC moderation smoke passes.**

## UGC Surfaces

| Surface | Production default | Required moderation proof |
|---|---:|---|
| reviews | enabled if MVP review flow is submitted | report review, hide moderated content, admin queue |
| posts/media | enabled only with social safety proof | report post, delete own post, media validation |
| comments | off | report/block/comment moderation |
| direct messages | off | report/block/realtime abuse controls |
| stories | off | report/delete/moderation |
| profiles/avatars | enabled with account controls | report user/profile, block where interactions exist |

## Source Evidence

- `src/lib/security/communitySafety.ts`
- Review/report/block entry points in review feed/profile surfaces.
- Supabase social governance migrations/tests.

## Blockers

- Live multi-user UGC smoke not attached.
- Admin moderation queue live proof not attached.
- App Store/Play review notes for UGC moderation not finalized.
