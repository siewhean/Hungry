# Dirty-WIP Reconciliation Inventory — 2026-07-15

## Scope and preservation

- Snapshot: `2026-07-15T09:54:01.326Z`.
- Original checkout (read-only): `/Users/Siew Hean/Documents/GitHub/Hungry`, branch `codex/data-enrichment-roadmap-r5-r14`, HEAD `29b78f198af8aa2ea4f8ba7114e577b210388f9b`.
- Audit worktree: `/Users/Siew Hean/Documents/GitHub/Hungry-order-integrity-hardening`, branch `codex/order-integrity-hardening`, HEAD `0632bfd6b56784a3c49deb7ed7fc9a091f4de48e`.
- Comparison baseline: `origin/main` at `5970041599838a7341338894fee2083ad756ad4a`.
- Inventory: **934 paths** from `git status --porcelain=v1 -z --untracked-files=all`. Rename/copy source paths are retained in the CSV.
- No reset, clean, restore, checkout, stash, WIP deletion, port, or staging was performed. The original WIP snapshot contains 934 paths (the initial read-only observation was 925 before concurrent activity). During report placement, these two new report files were briefly created at the tool's default checkout path, then immediately removed with `apply_patch` and re-added only to the audit worktree; no pre-existing original-checkout path or content was changed by this inventory task.

## Classification

| Category | Paths |
| --- | ---: |
| unique/valid candidate | 582 |
| generated/cache/temp | 187 |
| binary data/workbook | 108 |
| stale/conflicting | 41 |
| already merged | 14 |
| local secret/config | 2 |

| Decision | Paths |
| --- | ---: |
| needs-review | 681 |
| preserve | 184 |
| delete | 69 |

| Audit comparison | Paths |
| --- | ---: |
| original-only-untracked | 782 |
| original-only-delta | 96 |
| diverged-from-audit-and-main | 42 |
| matches-audit | 14 |

| Original status | Paths |
| --- | ---: |
| ?? | 803 |
| M  | 102 |
| MM | 18 |
| D  | 7 |
|  M | 4 |

| Porting status | Paths |
| --- | ---: |
| not-ported | 918 |
| already-present-in-audit | 14 |
| excluded-from-port | 2 |

## Method

Each current original-checkout path was hashed as a Git blob and compared with the current audit-worktree file and the `origin/main` tree. Classification precedence was: local secret/config, binary data/workbook, generated/cache/temp, exact audit match, three-way divergence, then content-unique candidate. `unique/valid candidate` means content-unique only; functional validity is not claimed until tests and provenance review pass.

Decisions are intentionally conservative: `preserve` keeps original/evidence state, `delete` is a later recommendation only for definite scratch/cache paths, and `needs-review` prohibits automatic porting or removal. The machine-readable manifest records every path, comparison, decision, recommended action, and porting status.

## Secret and configuration outcome

- Path classification found **2** local configuration paths. No values were printed or copied.
- A value-redacted heuristic scan covered status text files smaller than 2 MB and flagged **6 path(s)** for manual secret triage, including the local development environment file. Flags can include test fixtures; they are not proof of a live credential.
- A full TruffleHog verified-only filesystem scan was attempted but exceeded the 180-second bound because of the large dirty archive/workbook set. It produced no completed clean result. Therefore this snapshot is **not secret-cleared**: never port environment values, and rotate any credential confirmed live before reconciliation.

## Binary/data risks

- **108** binary/workbook paths require provenance, rights, reference, and canonical-workbook parity review.
- The canonical `data/Hungry F&B Database.xlsx` and all archive/repair/backup workbooks are marked `preserve`; none was accepted as authoritative or deleted by this inventory.
- Discover PNG changes are not considered valid solely because they exist; source rights and production references must be verified before selective porting.

## Reconciliation decision

- Paths marked `already-present-in-audit` require no re-port, but the original checkout remains preserved until final parity approval.
- `stale/conflicting` paths require explicit three-way review.
- `unique/valid candidate` paths require code/data review and targeted verification before any selective port.
- Definite scratch/cache rows marked `delete` are recommendations only. No deletion occurred.
- Reviewed porting performed in this phase: **none**.

Machine-readable manifest: `tasks/Roadmap/dirty-wip-reconciliation-2026-07-15.csv`.
