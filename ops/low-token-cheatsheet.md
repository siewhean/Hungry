# Hungry Low-Token Operating Cheatsheet

> Default operating mode for Codex, Claude, Gemini, Kimi, and any other LLM working inside Hungry.
> Goal: reduce token waste without reducing execution quality.

---

## 1. Default Rule

Work in low-token mode by default.

This means:
- prefer bounded tasks over broad summaries
- prefer one canonical source over repeated narrative
- prefer exact file or task IDs over general project discussion
- prefer execution over explanation
- return only the delta unless the user explicitly asks for a full summary

---

## 2. Default Prompt Shape

Use this shape whenever possible:

1. exact task ID or file
2. exact action
3. whether verification is required
4. whether docs should be updated
5. output limit

Example:

```text
Verify `OCR-DG-01` only. Update `tasks/backlog.md` and `tasks/verification.md` only if stale. Return only status, evidence, and blockers.
```

---

## 3. Good vs Bad Requests

### Good

- "Implement `SEC-02` only."
- "Verify `P2-08` and patch only stale canonical rows."
- "Return only mismatches."
- "Audit these 3 files only."
- "List only blockers."

### Bad

- "Summarize the whole repo."
- "Check if everything is done."
- "Tell me everything we have done so far."
- "What should we do next?" without task scope

---

## 4. Default Output Rules

- Return only what changed, what was verified, and what remains open.
- Do not restate the whole project unless explicitly requested.
- Do not echo large file contents unless necessary.
- Do not explain the workflow if the skill already defines it.
- Prefer bullets over long prose.

---

## 5. Default Tooling Pattern

### Prefer

- `rg` for search
- `sed` for bounded reads
- `git diff` for changes only
- targeted test or verification commands
- `multi_tool_use.parallel` for parallel reads
- Hungry-specific skills for repeated workflows

### Avoid

- broad repo scans without a task ID
- repeated full-document reads
- repeated roadmap summaries
- open-ended status narration

---

## 6. Default Skill Routing

### Use first

- `hungry-intent-router`
  - when the request is vague, broad, or multi-step

### Use next

- `hungry-backlog-keeper`
  - for status checks and doc sync
- `hungry-staging-smoke`
  - for staging proof
- `hungry-design-closeout`
  - for UI final review
- `hungry-supply-ops`
  - for OCR / merchant / Supabase work
- `hungry-release-readiness`
  - for ship/no-ship decisions
- `hungry-market-data-harvest`
  - for data collection and cleanup
- `hungry-merchant-copy-pack`
  - for merchant-facing copy

---

## 7. Per-Model Defaults

### Codex

- implement directly
- inspect only the files needed
- run only the relevant verification
- update canonical docs only
- return concise execution results

### Claude

- define scope, acceptance criteria, and residual risk
- avoid implementation detail unless needed
- avoid rewriting project history

### Gemini

- return only the visual delta, not a full screen essay
- focus on concrete UI issues, token rules, and copy changes

### Kimi

- use for long-context synthesis only when multiple source docs truly need merging
- output an execution brief, not a narrative report

---

## 8. Default Documentation Rule

Use these as the only active surfaces:

- `tasks/backlog.md`
- `tasks/verification.md`
- `tasks/session-log.md`

Treat these as non-default:

- `tasks/todo.md`
- historical summaries
- old sprint narration

---

## 9. Compression Rules

- Ask for one thing at a time.
- Name task IDs whenever possible.
- Ask for "only blockers", "only mismatches", or "only changed files" by default.
- If you need a summary, ask for the smallest useful summary.
- If implementation is intended, say so directly.

---

## 10. Recommended Default Prompts

### Codex

```text
Implement `<TASK_ID>` only. Update canonical docs only if needed. Run only the relevant verification. Return only what changed, evidence, and residual risk.
```

### Claude

```text
Define acceptance criteria and blockers for `<TASK_ID_LIST>` only. Return only scoped next steps and residual risk.
```

### Gemini

```text
Review `<TASK_ID_LIST>` against the design source. Return only visual mismatches, copy fixes, and interaction deltas.
```

### Kimi

```text
Read these specified Hungry docs only and produce a short execution brief with owner, blockers, and exact next actions. Do not write a full narrative summary.
```

---

## 11. Hard Rule

If the request can be answered by:
- a task row
- a diff
- a verification log
- a bounded file read

then do not answer it with a broad project summary.
