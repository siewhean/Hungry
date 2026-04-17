import assert from "node:assert/strict";
import test from "node:test";

import { getConfiguredDataSource } from "@/lib/services/supabase/client";

test("getConfiguredDataSource prefers HUNGRY_DATA_SOURCE when set", () => {
  const previousPrivate = process.env.HUNGRY_DATA_SOURCE;
  const previousPublic = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE;

  process.env.HUNGRY_DATA_SOURCE = "supabase";
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "mock";
  assert.equal(getConfiguredDataSource(), "supabase");

  process.env.HUNGRY_DATA_SOURCE = "mock";
  assert.equal(getConfiguredDataSource(), "mock");

  process.env.HUNGRY_DATA_SOURCE = previousPrivate;
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = previousPublic;
});

test("getConfiguredDataSource falls back to EXPO_PUBLIC_HUNGRY_DATA_SOURCE when private var blank", () => {
  const previousPrivate = process.env.HUNGRY_DATA_SOURCE;
  const previousPublic = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE;

  process.env.HUNGRY_DATA_SOURCE = "";
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "supabase";
  assert.equal(getConfiguredDataSource(), "supabase");

  process.env.HUNGRY_DATA_SOURCE = previousPrivate;
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = previousPublic;
});
