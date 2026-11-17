# Profile/settings remediation interaction specification

Governing sources: docs/audit/PROFILE_READS_SPEC.md, ACCESSIBILITY_SPEC.md and design/stitch/DESIGN.md; changes implement the approved 20 October remediation plan without changing visual direction.

- Identity: display name is editable and required; sign-in email is read-only, sourced from Auth. Avatar selection is a preview until Save succeeds. Save is single-flight; actual removal of a dirty editor asks to discard, while pushed password/quiz routes retain state.
- Relationships: only authoritative approved edges count as followers/following; UUID identifies a person. Suggestions and viewer-local flags never fabricate another user's graph. Public reviews come from author-scoped reviews, never comments inferred by name. Unavailable counts are omitted rather than fabricated.
- Contributions: optional hours start empty and every slot can be removed; source/reference field is optional. Failed upload/save preserves form. Status lists describe recent submissions unless a true total exists.
- Lists: loading, error/retry, empty and unresolved metadata are separate. Missing cached entities are fetched by exact ID; do not silently drop saved records. Large lists have one vertical scroll owner.
- Settings: Account, Discovery, Appearance/accessibility, Privacy/data and Support sections. Remove inert unsupported controls; personal hide-reviewed wording explicitly describes the user's recommendations. Theme uses explicit System/Light/Dark choices. Static values are not pressable. Switches have a single named checked target; busy actions are disabled and announced.
- Privacy saves show confirmed server outcome/error. Cache-only clear retains account/profile/location/drafts. Location reset honestly clears selection, then reacquires GPS if allowed with locating/failure feedback.
- Deletion: confirmed scheduled request is distinct from cleanup. Signing in alone does not cancel; only confirmed Keep my account does. Settings exposes scheduled status, retry and cancellation; cancellation false is never success. Successful request ends at Login with scheduled date/cancellation instructions.
- Export: produce temporary machine-readable JSON, disclose missing sections before share, permit retry, and clear temporary files on completion/cancel/account transition/expiry. No sensitive content in logs.
- Alerts: read loading/error/retry before editing; serialize saves and reject outdated reads. Permission denial offers OS Settings.
- Accessibility: headers, named buttons/switches, selected/busy state, minimum token-sized touch targets, non-drag photo reorder, keyboard accommodation, reduced motion and focus return. Final native visual/accessibility acceptance remains required.
