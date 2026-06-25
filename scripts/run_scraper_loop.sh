#!/bin/bash
# Loop script to run the GrabFood scraper until all stalls are processed

cd "/Users/Siew Hean/Documents/GitHub/Hungry"

MAX_RETRIES=20
count=0

while [ $count -lt $MAX_RETRIES ]; do
    echo "Starting scraper run $((count + 1))..."
    node scripts/enrich_full_menus.js --limit 1000
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        # Check if it was because it finished or because limit was reached
        # If the output said "No remaining stalls to enrich!", we should break.
        # But just running it again is safe; if 0 remaining, it exits with 0 very fast.
        echo "Run finished with exit code 0."
        count=$((count + 1))
    else
        echo "Run crashed or stopped with exit code $exit_code. Restarting..."
        count=$((count + 1))
        sleep 5
    fi
done

echo "Finished scraper loop."
