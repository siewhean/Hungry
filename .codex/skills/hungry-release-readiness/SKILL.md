---
name: hungry-release-readiness
description: Decide whether Hungry is ready to ship. Use this when you need a clear go or no-go answer based on backlog status, testing evidence, staging checks, security work, deployment proof, and store-policy compliance for Apple and Google Play.
---

# Hungry Release Readiness

Use this skill when you need a practical release decision, not just a code review.

## Workflow

1. Read `tasks/backlog.md` for release-scope rows.
2. Read `tasks/verification.md` for current command evidence.
3. Read `references/release-gates.md`.
4. Check staging-smoke and deployment proof if the scope includes them.
5. Check current Apple App Review Guidelines and current Google Play Developer Program Policies if the release is intended for store submission or public launch.
6. Verify that all relevant clauses are adhered to, not just acknowledged.
7. Classify the release as `Go`, `Conditional Go`, or `No-Go`.
8. Return blockers and next actions by owner.

## Rules

- Do not call a release ready from code inspection alone.
- Treat missing staging proof as a blocker when the release depends on staging-only flows.
- Keep the decision scoped to the named release or sprint.
- Separate “ship blocker” from “optional polish.”
- For app-store submissions, treat current official Apple and Google policy pages as authoritative.
- Check actual adherence to relevant clauses:
  - metadata accuracy
  - privacy policy/data handling
  - account deletion requirements if applicable
  - demo/test account or reviewer access where needed
  - stable, non-placeholder, production-ready user experience
  - restricted-content / deceptive-behavior / user-generated-content risk where relevant
- If a clause is not applicable, say why.
- If policy wording may have changed, cite the current official source URL used in the audit.

## Output

- release scope
- readiness verdict
- blockers
- waived risks
- Apple policy findings
- Google Play policy findings
- owner-by-owner next steps

## References and Scripts

- Read `references/release-gates.md` first.
- Use `scripts/release_ready_checklist.sh` as a compact gate reminder.
