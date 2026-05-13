# Playbook: Verification

## Verification Budget

Small iterative changes do not require full QA/QC, `npm run ios`, the full test suite, or default `npm run typecheck`. Run a focused check only when it directly covers the change, or state that verification was intentionally skipped because the change is small.

## Broad Hungry Verification Bundle

```bash
npm run typecheck
npm test -- --runInBand
NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor
```

## Rules

- If any step is skipped, state why.
- Record command outcome in `tasks/verification.md` for tracked task, release, security, or broad verification work.
- Do not mark a task done without evidence.

## Runtime QA

Use for:
- staging smoke tests
- device walkthrough
- simulator sanity pass

Record:
- environment
- scope
- outcome
- blocker, if any
