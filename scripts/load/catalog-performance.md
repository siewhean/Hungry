# Hungry catalog performance verification

## Authenticated gateway timing

Use short-lived tokens for dedicated signed-in fixtures and the project's publishable key. The scripts validate each identity before calling catalog RPCs. Set a separate token per virtual user using `LOAD_AUTH_TOKENS` as a comma-separated list. For one user, `LOAD_AUTH_TOKEN` also works. Keep tokens out of command history, logs and evidence. The scripts accept the exact Hungry staging origin. A bound local Supabase at port 54321 requires `LOAD_ALLOW_ISOLATED_LOCALHOST=1`.

Configure these values in the test environment:

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the approved project.
- `LOAD_DISCOVERY_FIXTURES` as JSON objects for area, GPS, mall, national and verified-empty scopes. A nonempty fixture needs `dishId` and `venueId` that occur on both page sizes. Optional request fields are `area`, `lat`, `lng`, `radius` and `buildingId`. Add a short `name` for the scenario metric. Set `expectEmpty: true` only for a scope that returns zero stalls. Use GPS for the empty case because an unknown area name can fall back to another scope.
- `LOAD_DISH_ID` and `LOAD_VENUE_ID` for visible records. Set `LOAD_VENUE_EXPECT_MORE=1` with a venue that has more than 20 visible dishes to require a continuation.
- `LOAD_VUS` at 1, 5 or 20 and `LOAD_DURATION` long enough for the required sample. Use an approved benchmark window and start with one VU. Each test sleeps two seconds per iteration. Use distinct fixture users so concurrent requests stay within per-account limits.

Run `npm run load:discovery -- --out json=<path>` and `npm run load:detail -- --out json=<path>` separately. Record the build, project region, RPC definition hash, fixture version, VUs, time window and sample size. Use the JSON output to group by route, fixture scope, cohort and status. Report successful p50/p95, timeout/429/5xx counts, response bytes and success within deadline across all attempts. A failed first page or header prevents dependent requests in that iteration. The deadline metric includes failed requests to endpoints that were attempted. Gateway results complement device tap-to-visible measurements. The detail benchmark requires the split RPCs from [PR #295](https://github.com/siewhean/Hungry/pull/295) to be deployed on its target.

## Discovery query comparison

Restore a sanitized, production-shaped Supabase snapshot to an isolated local instance with matching PostgreSQL/PostGIS, RLS, functions, indexes and catalog distributions. Refresh stale planner statistics on that instance. Use an existing authenticated test account from the clone as `--fixture-user`. Verify the clone's plan shapes and load windows separately from staging gateway measurements.

Create a JSON fixture file with the five case keys below. Replace the example inputs with known positive authorization, geography and building fixtures in the clone. Use RPC argument objects.

```json
{
  "area": { "p_area_name": "Chinatown" },
  "gps": { "p_lat": 1.284, "p_lng": 103.844, "p_radius_meters": 1500 },
  "mall": {
    "p_lat": 1.284,
    "p_lng": 103.844,
    "p_radius_meters": 1500,
    "p_building_id": "replace-with-known-building-id"
  },
  "national": {},
  "empty": { "p_lat": 1.16, "p_lng": 103.7, "p_radius_meters": 1 }
}
```

Set `PGPASSWORD` for the local control connection and run the comparison:

```sh
python3 scripts/db/benchmark-discovery-feed.py --isolated-local-db \
  --fixture-user <local-fixture-uuid> --fixtures /path/to/cases.json \
  --rounds 10 > /path/to/discovery-plans.ndjson
```

The harness connects to loopback, extracts the deployed SQL body, and runs the inner query in a read-only transaction under the authenticated role and JWT claims. Its comparison confines top-dish selection to the same candidate venues and uses the deployed eligibility and rank expressions. It compares each variant's ordered full rows with the existing RPC at limits 10 and 100. It records response bytes and nested EXPLAIN plans with actual row counts, buffer reads and sort details. It alternates plan order across repeated trials. An initial comparison warms the fixture; report these as warm SQL measurements. Use independent fresh clone starts for cold measurements.

Review repeated p50/p95, eligibility and ordered parity, buffer work, spill and row estimates. Validate the candidate separately under authenticated gateway concurrency on the isolated benchmark deployment before promotion. A synthetic harness smoke validates the diagnostic machinery. Release requires evidence from the representative dataset and device cohorts.

## Mobile timing and rollout

Collect `catalog_performance` events in an opted-in test build. Group by app version, native build, OTA update, project host, surface, milestone and outcome. Keep failed and timed-out attempts in the deadline denominator. Record warm and cold cache runs independently. Record native process launch separately from the JavaScript boot marker. Use device captures to confirm that a laid-out element is in the viewport, especially for the stall menu and images.

App builds use the legacy stall endpoints by default. Set `EXPO_PUBLIC_ENABLE_STALL_READS_V2=true` only for a benchmark build targeting a database with the split RPCs. [The database PR](https://github.com/siewhean/Hungry/pull/295) merged with a passing hosted rehearsal. After deployment approval, ship it through `scripts/db/ship.sh` and validate installed and new app versions. Restore the `stall_reads_v2` remote flag wiring in the client release before canarying at 5%, 25%, and 100%. For rollback, disable the flag, confirm v2 traffic has stopped, then roll back the database if needed. The Discover SQL candidate remains in the comparison harness.
