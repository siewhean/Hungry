---
name: hungry-market-data-harvest
description: Gather and clean Hungry's venue, stall, menu, and business data so it can be used safely in the product. Use this when collecting new source data, cleaning messy records, removing duplicates, or preparing data for maps, search, OCR, or merchant workflows.
---

# Hungry Market Data Harvest

Use this skill when you need to collect new food-place data or clean the data you already have.

## Workflow

1. Read `references/data-harvest-scope.md`.
2. Define the target geography, mall, source, or dataset slice.
3. Collect raw data from the bounded source set.
4. Normalize fields to Hungry-compatible structures.
5. Deduplicate records and note confidence or residual issues.
6. Prepare the output for the next pipeline stage: fixture update, OCR enrichment, or supply review.

## Rules

- Keep raw collection separate from normalized output.
- Distinguish source-confirmed facts from inferred values.
- Prefer explicit confidence notes when fields are incomplete.
- Do not mix consumer-curated data with draft or OCR-derived supply records unless the task explicitly requires it.

## Output

- source set used
- normalized records or transformation plan
- confidence notes
- dedupe notes
- next integration step

## References and Scripts

- Read `references/data-harvest-scope.md` first.
- Use `scripts/data_harvest_focus.sh` as a compact reminder of the harvest pipeline.
