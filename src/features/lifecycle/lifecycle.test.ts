import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildLifecycleSnapshot,
  classifyLifecycle,
  isReturningAfterBreak,
  singaporeDateKey,
} from "./lifecycle";

const TODAY = "2026-10-19";

test("active today is new, current, reactivated or resurrected by the gap since the last visit", () => {
  assert.equal(classifyLifecycle([TODAY], TODAY), "new");
  assert.equal(classifyLifecycle(["2026-10-12", TODAY], TODAY), "current");
  assert.equal(classifyLifecycle(["2026-10-11", TODAY], TODAY), "reactivated");
  assert.equal(classifyLifecycle(["2026-09-19", TODAY], TODAY), "reactivated");
  assert.equal(classifyLifecycle(["2026-09-18", TODAY], TODAY), "resurrected");
});

test("not active today is at risk weekly, at risk monthly or dormant", () => {
  assert.equal(classifyLifecycle([], TODAY), null);
  assert.equal(classifyLifecycle(["2026-10-18"], TODAY), "at_risk_weekly");
  assert.equal(classifyLifecycle(["2026-10-12"], TODAY), "at_risk_weekly");
  assert.equal(classifyLifecycle(["2026-10-11"], TODAY), "at_risk_monthly");
  assert.equal(classifyLifecycle(["2026-09-18"], TODAY), "dormant");
});

test("the snapshot counts today and reports the gap since the visit before it", () => {
  assert.deepEqual(buildLifecycleSnapshot(["2026-09-01"], TODAY), {
    state: "resurrected",
    previousActiveDate: "2026-09-01",
    daysSincePrevious: 48,
  });
  // A second open the same day gives the same answer.
  assert.deepEqual(
    buildLifecycleSnapshot(["2026-09-01", TODAY], TODAY),
    buildLifecycleSnapshot(["2026-09-01"], TODAY),
  );
  assert.deepEqual(buildLifecycleSnapshot([], TODAY), {
    state: "new",
    previousActiveDate: null,
    daysSincePrevious: null,
  });
});

test("Singapore dates roll over at 4pm UTC", () => {
  assert.equal(singaporeDateKey(new Date("2026-10-19T15:59:00Z")), "2026-10-19");
  assert.equal(singaporeDateKey(new Date("2026-10-19T16:00:00Z")), "2026-10-20");
});

test("only users back after more than a week get a welcome back", () => {
  assert.equal(isReturningAfterBreak("reactivated"), true);
  assert.equal(isReturningAfterBreak("resurrected"), true);
  assert.equal(isReturningAfterBreak("current"), false);
  assert.equal(isReturningAfterBreak("new"), false);
  assert.equal(isReturningAfterBreak(null), false);
});

test("the server records one row per day and uses the same thresholds", () => {
  const migration = readFileSync(
    "supabase/migrations/20261019200000_user_lifecycle_states.sql",
    "utf8",
  );
  assert.match(migration, /primary key \(user_id, activity_date\)/);
  assert.match(migration, /on conflict do nothing/);
  assert.match(migration, /<= 7 then 'current'/);
  assert.match(migration, /<= 30 then 'reactivated'/);
  assert.match(migration, /grant execute on function public\.record_app_open\(\) to authenticated/);
  assert.match(
    migration,
    /revoke all on function public\.lifecycle_state_for\(uuid, date\) from public, anon, authenticated/,
  );
  const bootstrap = readFileSync("src/hooks/useAppBootstrap.ts", "utf8");
  assert.match(bootstrap, /useLifecycleStore\.getState\(\)\.recordAppOpen\(\)/);
  const supabase = readFileSync("src/lib/services/supabase/supabaseService.ts", "utf8");
  assert.match(supabase, /\.rpc\("record_app_open"\)/);
  const exportMigration = readFileSync(
    "supabase/migrations/20261019200500_export_activity_days.sql",
    "utf8",
  );
  assert.match(exportMigration, /'activityDays'/);
});
