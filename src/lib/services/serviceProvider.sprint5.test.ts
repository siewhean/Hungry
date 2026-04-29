import assert from "node:assert/strict";
import test from "node:test";

import { getServiceProvider, resetServiceProvider } from "@/lib/services/serviceProvider";

const shouldSkipSupabaseRuntime =
  process.env.HUNGRY_DISABLE_ASYNC_STORAGE === "1" ||
  process.env.HUNGRY_DISABLE_SECURE_STORE === "1";

const supabaseModeTest = shouldSkipSupabaseRuntime ? test.skip : test;

supabaseModeTest("service provider resolves supabase mode from HUNGRY_DATA_SOURCE", () => {
  const previousDataSource = process.env.HUNGRY_DATA_SOURCE;
  const previousPublicDataSource = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE;

  process.env.HUNGRY_DATA_SOURCE = "supabase";
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "";
  resetServiceProvider();
  assert.equal(getServiceProvider().mode, "supabase");

  process.env.HUNGRY_DATA_SOURCE = "mock";
  resetServiceProvider();
  assert.equal(getServiceProvider().mode, "mock");

  process.env.HUNGRY_DATA_SOURCE = previousDataSource;
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = previousPublicDataSource;
  resetServiceProvider();
});

supabaseModeTest(
  "service provider resolves supabase mode from EXPO_PUBLIC_HUNGRY_DATA_SOURCE",
  () => {
    const previousDataSource = process.env.HUNGRY_DATA_SOURCE;
    const previousPublicDataSource = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE;

    process.env.HUNGRY_DATA_SOURCE = "";
    process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "supabase";
    resetServiceProvider();
    assert.equal(getServiceProvider().mode, "supabase");

    process.env.HUNGRY_DATA_SOURCE = previousDataSource;
    process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = previousPublicDataSource;
    resetServiceProvider();
  },
);
