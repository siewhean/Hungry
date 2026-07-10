#!/bin/bash
set -e

echo "=== 1. Removing old fallback results ==="
rm -f data/fallback_enrichment_results.json

echo "=== 2. Running GrabFood Loop ==="
./scripts/run_scraper_loop.sh

echo "=== 3. Running Fallback Loop ==="
./scripts/run_fallback_loop.sh

echo "=== 4. Syncing to Supabase ==="
export HUNGRY_ALLOW_SERVICE_ROLE_IMPORT=1
python3 scripts/import_excel_to_supabase.py --apply-supabase

echo "=== All operations completed successfully! ==="
