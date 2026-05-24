# Singapore Food Business Workbook

The workbook at [singapore_food_stalls.xlsx](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_food_stalls.xlsx) is the working Excel artifact for the Singapore food-business database.

## Refresh command

```bash
python3 -m pip install openpyxl
npm run data:enrich
```

## Supabase staging import

Generate a staging-only SQL import for the canonical CSV:

```bash
npm run data:supabase:stage:canonical
```

The generated SQL is written to `/tmp/hungry-canonical-food-business-staging.sql`.
It creates/updates one `import_runs` row, loads `staging_food_businesses`, writes
validation issues to `staging_import_errors`, and does not mutate production
`buildings`, `venues`, `dishes`, or media tables.

For linked Supabase CLI imports where the single SQL file is too large for the
management API, generate smaller sequential SQL chunks and apply them:

```bash
npm run data:supabase:stage:canonical:split
npm run data:supabase:stage:canonical:apply-sql-chunks
npm run smoke:supabase-canonical-food-business-staging -- --require-network
```

To write directly to a Supabase staging project through service-role REST, set
`HUNGRY_SUPABASE_IMPORT_URL`, `HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY`,
`HUNGRY_SUPABASE_IMPORT_PROJECT_REF`, and `HUNGRY_ALLOW_SERVICE_ROLE_IMPORT=1`,
then run:

```bash
npm run data:supabase:stage:canonical:apply
npm run smoke:supabase-canonical-food-business-staging
```

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

## Dual-account quota pin automation

Keep Places `SearchTextRequest per minute` pinned until both primary and backup keys reach ceiling behavior:

```bash
npm run data:quota:pin:both -- --duration-s 75 --concurrency 20 --target-per-minute 600 --max-cycles 20
```

Behavior:

- reads `GOOGLE_MAPS_ENRICHMENT_API_KEY` and `GOOGLE_MAPS_ENRICHMENT_API_KEY_BACKUP` from `.env.local`
- runs repeated saturation windows for each key
- exits only when both accounts hit ceiling behavior (`429` observed or sustained near-full successful volume)
