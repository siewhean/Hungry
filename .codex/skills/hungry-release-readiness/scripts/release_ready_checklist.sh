#!/usr/bin/env bash
set -euo pipefail
cat <<'OUT'
Hungry release-readiness checklist:
- backlog critical-path rows reviewed
- verification bundle current
- staging smoke evidence present
- security actions checked
- deployment proof checked
- Apple App Review Guidelines checked against current official page
- Google Play Developer Program Policies checked against current official pages
- all relevant clauses mapped to actual app adherence or blocker notes
- residual blockers listed
OUT
