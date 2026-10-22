# Home/social correction states

Governing references: design/figma-v2/home-feed.html (food decision remains primary), docs/audit/ACCESSIBILITY_SPEC.md, docs/audit/OFFLINE_SPEC.md. Preserve existing orange/navy tokens and card geometry.

- Every social card exposes an explicit accessible dish/stall action. Its media retains double-tap liking; caption expansion is independent from comments visibility. Save means save post only. Copy uses canonical post URL; share counts exclude cancellation/failure.
- Feed refresh retains content and shows retry/error status. Activity uses one account-filtered set for badge/list, a loading/empty/error distinction, typed target navigation and recoverable read acknowledgement. Do not fabricate actor-owned live activity.
- Contextual report/block requires canonical identity; hidden/blocked content disappears reactively. Unknown identity permits content reporting but cannot pretend to block an account.
- Messages refresh on focus; query filters displayed conversations. Chat merges history and realtime by stable identity, retains retry nonce and account-scoped draft, and reports read/send failure without losing text. Header safety actions are named controls with >=44point targets.
- Stories are clearly local mock demos only; Supabase mode shows unavailable with Back, never fake publishing. Mock video uses the installed video renderer. Reduce Motion makes story progression manual; gallery preview/selection comes from filtered assets and identity uses author ID.
- All async controls expose busy/disabled state; errors preserve input and Retry. Native keyboard/large text, assistive focus, gesture targets and live multi-user enforcement remain separate acceptance evidence.
