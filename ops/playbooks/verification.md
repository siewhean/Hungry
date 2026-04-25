# Playbook: Verification

## Standard Hungry Verification Bundle

```bash
npm run typecheck
npm test -- --runInBand
NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor
```

## Rules

- If any step is skipped, state why.
- Record command outcome in `tasks/verification.md`.
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

