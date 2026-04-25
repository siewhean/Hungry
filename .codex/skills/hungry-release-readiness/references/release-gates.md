# Hungry Release Gates

Check these surfaces before calling a release candidate ready:

1. Canonical active backlog
2. Verification bundle evidence
3. Staging smoke completion
4. Security actions
5. Deployment proof
6. Apple App Review Guidelines compliance
7. Google Play Developer Program Policies compliance
8. Residual blocker list

## Minimum proof set

- `tasks/backlog.md` has no critical-path `Open` or `Blocked` rows for the release scope
- `tasks/verification.md` has current command evidence
- staging done gates are either complete or explicitly waived
- deployment target has a preview or production proof where relevant
- if shipping to Apple, audit against current App Review Guidelines:
  - https://developer.apple.com/appstore/resources/approval/guidelines.html
- if shipping to Google Play, audit against current Developer Program Policies:
  - https://support.google.com/googleplay/android-developer/answer/16313518?hl=en
  - and policy center / updates as needed:
    - https://support.google.com/googleplay/android-developer/answer/16070163?hl=en

## Store-policy check areas

### Apple

- final, non-placeholder submission state
- complete metadata and fully functional URLs
- reviewer/demo access if gated
- privacy handling and account functionality
- minimum functionality and stable UX
- no misleading or deceptive behavior

### Google Play

- accurate app information and metadata
- privacy policy and Data safety compliance
- account deletion requirement if in-app account creation exists
- stable, engaging, responsive UX
- SDK and third-party code compliance
- restricted-content / deceptive-behavior / abuse-policy alignment

## Adherence rule

Do not stop at “policy checked.”

The audit must state:
- relevant clause area
- evidence of adherence or missing proof
- blocker severity
- owner for remediation

## Output shape

- release scope
- go / no-go / conditional-go
- blockers
- waived risks
- next actions by owner
