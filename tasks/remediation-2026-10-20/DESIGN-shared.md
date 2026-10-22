# Shared interaction states

Governing sources: PROJECT_INSTRUCTIONS.md, tasks/design-system.md, existing design prototypes; preserve current palette, type, spacing and components.

- Offline notice occupies measured layout space above navigation and below the system safe area. It never covers header controls, resets navigation, or discards drafts. Text wraps at large sizes; Retry has a 44-point target, busy state, and a truthful failure notice.
- Venue visit action reads **Visited this stall**. It needs no dish review. A pending change disables duplicate submission; failure retains the last confirmed state and presents retry guidance. No speculative rewards.
- Authentication forms remain scrollable with keyboard tap handling. Authoritative email is read-only; privacy changes display only confirmed values.
- Haptic preference gates every native vibration call; unsupported devices fail silently without changing the action result.

Native screenshot, screen reader, keyboard and offline closeout require a rebuilt candidate and remain separate evidence.
