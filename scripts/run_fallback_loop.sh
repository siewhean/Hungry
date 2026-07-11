#!/bin/bash
set -e

echo "=== Filtering missing menus ==="
python3 scripts/filter_missing_menus.py

echo "=== Running fallback enrichment (Foodpanda/Deliveroo) ==="
node scripts/enrich_fallback_menus.js

echo "=== Applying fallback menus ==="
# We need to make a script to apply the fallback menus
python3 scripts/apply_fallback_menus.py

echo "=== Propagating chain menus ==="
python3 scripts/propagate_chain_menus.py

echo "=== Fallback loop complete ==="
