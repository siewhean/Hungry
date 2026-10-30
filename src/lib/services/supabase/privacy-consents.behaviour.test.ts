// App Review 5.1.1(ii) and 5.1.2(i): the analytics and AI-search choices are saved on the account.
// The real Supabase service against a fake client.

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

function upserts() {
  return fake
    .queriesOn("privacy_settings")
    .flatMap((call) => call.ops)
    .filter(([op]) => op === "upsert")
    .map(([, args]) => args[0] as Record<string, unknown>);
}

test("getConsents reads the saved answers for the signed-in user", async () => {
  fake.tables.privacy_settings = () => ({
    data: { analytics_consent: false, ai_search_consent: true },
    error: null,
  });

  assert.deepEqual(await service.privacy.getConsents(), { analytics: false, aiSearch: true });
  const [read] = fake.queriesOn("privacy_settings");
  assert.deepEqual(read.ops.find(([op]) => op === "eq")?.[1], ["user_id", ME]);
});

test("getConsents reports 'not asked' and AI search off when nothing is saved", async () => {
  fake.tables.privacy_settings = () => ({ data: null, error: null });
  assert.deepEqual(await service.privacy.getConsents(), { analytics: null, aiSearch: false });

  fake.tables.privacy_settings = () => ({
    data: { analytics_consent: null, ai_search_consent: false },
    error: null,
  });
  assert.deepEqual(await service.privacy.getConsents(), { analytics: null, aiSearch: false });
});

test("getConsents makes no request when nobody is signed in, and throws when the read fails", async () => {
  auth.userId = null;
  assert.deepEqual(await service.privacy.getConsents(), { analytics: null, aiSearch: false });
  assert.deepEqual(fake.queriesOn("privacy_settings"), []);

  auth.userId = ME;
  fake.tables.privacy_settings = () => ({ data: null, error: { message: "down" } });
  await assert.rejects(() => service.privacy.getConsents());
});

test("saveConsents sends only the consent being changed and the user id", async () => {
  fake.tables.privacy_settings = () => ({ data: null, error: null });

  await service.privacy.saveConsents({ aiSearch: true });
  await service.privacy.saveConsents({ analytics: false });
  await service.privacy.saveConsents({ analytics: true, aiSearch: false });

  assert.deepEqual(upserts(), [
    { user_id: ME, ai_search_consent: true },
    { user_id: ME, analytics_consent: false },
    { user_id: ME, analytics_consent: true, ai_search_consent: false },
  ]);
});

test("saveConsents throws when signed out or when the save fails, so the app never claims a saved choice", async () => {
  auth.userId = null;
  await assert.rejects(() => service.privacy.saveConsents({ aiSearch: true }));
  assert.deepEqual(upserts(), []);

  auth.userId = ME;
  fake.tables.privacy_settings = () => ({ data: null, error: { message: "denied" } });
  await assert.rejects(() => service.privacy.saveConsents({ aiSearch: true }));
});
