// SET4-2: changing one notification switch must not write back the other columns, or a change made
// on another phone is undone. The real Supabase service against a fake client.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";

let service: typeof import("./supabaseService").supabaseService;

before(async () => {
  const client = await import("./client");
  client.setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
});

beforeEach(() => {
  fake.queries.length = 0;
  fake.tables = {};
  auth.userId = ME;
});

const SAVED_ROW = {
  stall_updates: true,
  weekly_picks: true,
  mealtime_suggestions: false,
  social_activity: true,
  quiet_start_hour: 22,
  quiet_end_hour: 8,
  weekly_cap: 3,
};

function upserts() {
  return fake
    .queriesOn("notification_preferences")
    .flatMap((call) => call.ops)
    .filter(([op]) => op === "upsert")
    .map(([, args]) => args[0] as Record<string, unknown>);
}

test("updatePreferences sends only the changed column and the user id, with no read first", async () => {
  fake.tables.notification_preferences = (call) => {
    const upsert = call.ops.find(([op]) => op === "upsert");
    const row = (upsert?.[1][0] ?? {}) as Record<string, unknown>;
    return { data: { ...SAVED_ROW, ...row }, error: null };
  };

  const next = await service.push.updatePreferences({ weeklyPicks: false });

  assert.deepEqual(upserts(), [{ user_id: ME, weekly_picks: false }]);
  assert.equal(next.weeklyPicks, false);
  assert.equal(next.stallUpdates, true, "the saved row comes back whole");
  const reads = fake
    .queriesOn("notification_preferences")
    .filter((call) => !call.ops.some(([op]) => op === "upsert"));
  assert.deepEqual(reads, [], "no separate read of the saved preferences");
});

test("updatePreferences maps every preference to its own column", async () => {
  fake.tables.notification_preferences = () => ({ data: SAVED_ROW, error: null });

  await service.push.updatePreferences({
    stallUpdates: false,
    mealtimeSuggestions: true,
    socialActivity: false,
    quietStartHour: 21,
    quietEndHour: 7,
    weeklyCap: 2,
  });

  assert.deepEqual(upserts(), [
    {
      user_id: ME,
      stall_updates: false,
      mealtime_suggestions: true,
      social_activity: false,
      quiet_start_hour: 21,
      quiet_end_hour: 7,
      weekly_cap: 2,
    },
  ]);
});

test("updatePreferences refuses a signed-out caller before touching the table", async () => {
  auth.userId = null;
  await assert.rejects(() => service.push.updatePreferences({ weeklyPicks: false }), /signed in/);
  assert.deepEqual(fake.queriesOn("notification_preferences"), []);
});
