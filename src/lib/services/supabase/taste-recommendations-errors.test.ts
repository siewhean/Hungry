// A failing get_taste_recommendations call falls back to popular dishes, so the user never
// sees it; it must reach Sentry (ONB-X3). A rate-limit refusal is expected and is not reported.

import assert from "node:assert/strict";
import Module from "node:module";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();

const captured: unknown[] = [];
process.env.EXPO_PUBLIC_SENTRY_DSN = "https://key@sentry.example/1";
const internals = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
const originalLoad = internals._load;
internals._load = function load(request: string, ...rest: unknown[]) {
  if (request === "@sentry/react-native") {
    return { captureException: (error: unknown) => captured.push(error) };
  }
  return originalLoad.call(this, request, ...rest);
};

let service: typeof import("./supabaseService").supabaseService;

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
});

beforeEach(() => {
  captured.length = 0;
  fake.rpcCalls.length = 0;
  fake.rpc = {};
  fake.tables = {};
});

const slate = () =>
  service.recommendations.getSlate({
    surface: "home",
    tasteProfile: { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 },
    dietaryFlags: [],
    limit: 4,
  });

test("a failed taste recommendations call is reported and thrown, not hidden as an empty slate", async () => {
  fake.rpc.get_taste_recommendations = () => ({
    error: { message: "column does not exist", code: "42703" },
  });
  await assert.rejects(slate(), /column does not exist/);
  assert.equal(fake.callsTo("get_taste_recommendations").length, 1);
  assert.equal(captured.length, 1);
});

test("a failed popular read throws when the caller refuses the catalog fallback", async () => {
  fake.rpc.search_dishes = () => ({ error: { message: "network down", code: "08006" } });
  await assert.rejects(
    service.discovery.listPopularNearby(undefined, undefined, { noCatalogFallback: true }),
    /Popular dishes could not be loaded/,
  );
});

test("a rate-limited taste recommendations call is not reported", async () => {
  fake.rpc.get_taste_recommendations = () => ({
    error: { message: "Too many requests", code: "rate_limited" },
  });
  await slate().catch(() => undefined);
  assert.equal(fake.callsTo("get_taste_recommendations").length, 1);
  assert.equal(captured.length, 0);
});
