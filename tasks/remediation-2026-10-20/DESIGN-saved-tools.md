# Saved tools interaction states

Governing sources: `tasks/Roadmap/Gamification/hungry_checklist_portfolio_passport_plan.md`, `design/` saved-tool prototypes, `docs/handoff/SPRINT_FINAL_POLISH.md`, and the approved saved-tools audit. Preserve existing palette, typography and layout.

- Portfolio visibility is its immediate audience. Show Private, Followers or Public; omit Draft/Publish language. Owner/editor actions are explicit; private notes are visible only when authorized by the service. Scores accept 1–10 with one optional decimal. Clearing a field is deliberate. Remote refresh must retain dirty text, with an explicit conflict notice and retry.
- Private saved-tool state lives only in the active account. Loading failure remains an error with retry, never a fabricated empty success. Account transition invalidates pending results and clears local state.
- Collection saves show confirmed server state; disable repeated changes while pending and expose recoverable errors.
- Checklist dates are labelled Planned time, with no notification promise. Existing time can be edited or cleared. Tried status supports undo.
- Solo Wheel uses distinct venues and a centrally chosen integer winner. Animation presents that choice, resolves once even when interrupted, honors reduced motion, and permits another round. Empty or single-candidate states explain what is needed. Group transport remains explicitly a local demo.
- Interactive rows have named actions and selected/busy states, 44 point targets, safe-area/keyboard accommodation, readable scaling and alternatives to dragging. Native visual/accessibility verification remains required.
