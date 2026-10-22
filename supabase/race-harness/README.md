# Race condition harness

Replays each fixed race with two overlapping transactions on a throwaway local Postgres
(no Supabase, no real data) and fails if a race shows up again.

```bash
npm run test:races                                   # asserts the state after the fix
RACE_SHOW_BEFORE=1 npm run test:races                # also shows the old bodies losing each race
```

How it works: `extract_functions.py` pulls the function bodies from `supabase/migrations`
as they were before `20261022124500_race_condition_fixes.sql`, `stubs.sql` supplies minimal
stand-in tables, then `run.sh` applies the migration, runs each scenario (session A holds its
transaction open, session B starts half a second later), and checks the outcome. It also
applies the down migration and checks every function body is restored, then re-applies up.

To cover a new race, add a table to `stubs.sql` if needed, load the function in `run.sh`,
add a scenario next to T1 to T11 and its expected values to `EXPECTED`. Needs the Postgres
server binaries (`/usr/lib/postgresql/*/bin`, present on GitHub's ubuntu-latest) and python3.
