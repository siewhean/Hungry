#!/usr/bin/env bash
set -euo pipefail
cat <<'OUT'
Hungry staging smoke checklist:
- OCR-DG-01: upload -> OCR -> dishes_draft proof
- OCR-DG-02: claim CTA -> analytics/row insert proof
- OCR-DG-04: staging/prod merchantClaimCtaEnabled proof
- WEB-11: preview/production deploy proof
Update tasks/verification.md before marking backlog rows done.
OUT
