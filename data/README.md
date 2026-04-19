# Singapore Food Business Workbook

The workbook at [singapore_food_stalls.xlsx](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_food_stalls.xlsx) is the working Excel artifact for the Singapore food-business database.

## Refresh command

```bash
python3 -m pip install openpyxl
npm run data:enrich
```

## Supabase import (real-world data, free-tier safe)

Use the batch importer to upsert lean real-world records into Supabase core tables (`buildings`, `venues`) while keeping storage headroom:

```bash
python3 scripts/import_real_world_data_to_supabase.py --dry-run
python3 scripts/import_real_world_data_to_supabase.py --batch-size 500 --max-business-rows 32253 --sleep-ms 20
```

Guardrails built into the importer:

- imports only lean columns (no menu/raw blob payloads)
- caps import volume with `--max-business-rows` (hard stop above 35000)
- batches writes to reduce lock pressure and API burst risk

## What the pipeline does

- preserves the workbook path and regenerates the three sheets in place
- merges the checked-in curated seed snapshot with any current workbook edits on the same `Stall ID`
- merges in official SFA eating-establishment and grading data from data.gov.sg
- enriches existing rows and adds net-new hawker stall candidates from the public [WhyQ Corporate Catering](https://www.whyq.sg/corporate-catering) catalogue when a usable location anchor can be inferred
- enriches existing rows and adds net-new food-court stall candidates from the official [Food Republic outlet pages](https://foodrepublic.com.sg/food-republic-outlets/)
- refreshes the hawker-centre reference sheet from the official NEA dataset
- exports a canonical CSV at [singapore_food_businesses_canonical.csv](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_food_businesses_canonical.csv)
- preserves the original curated menu, price, and opening-hours fields via
  [singapore_food_stalls_seed_curated.csv](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_food_stalls_seed_curated.csv)

## Source datasets

- [SFA Eating Establishments](https://data.gov.sg/datasets/d_1f0313499a17075d13aae6ed3e825bc6/view)
- [SFA Certificate Grading Info of Licensed Eating Establishments](https://data.gov.sg/datasets/d_546a95c5e6a0a264a82247ec107a0629/view)
- [NEA Dates of Hawker Centres Closure](https://data.gov.sg/datasets/d_bda4baa634dd1cc7a6c7cad5f19e2d68/view)
- [WhyQ Corporate Catering stall catalogue](https://www.whyq.sg/corporate-catering)
- [Food Republic outlet pages](https://foodrepublic.com.sg/food-republic-outlets/)
