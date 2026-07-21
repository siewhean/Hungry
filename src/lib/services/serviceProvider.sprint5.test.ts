import assert from "node:assert/strict";
import test from "node:test";

import {
  getServiceProvider,
  resetServiceProvider,
  setExcelServiceProvider,
  setMockServiceProvider,
  setSupabaseServiceProvider,
} from "@/lib/services/serviceProvider";
import { isSupabaseConfigured } from "@/lib/services/supabase/client";

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

  process.env.HUNGRY_DATA_SOURCE = "excel";
  resetServiceProvider();
  assert.equal(getServiceProvider().mode, "excel");

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

test("service provider can be forced into mock mode for developer shortcuts", () => {
  const previousDataSource = process.env.HUNGRY_DATA_SOURCE;
  const previousPublicDataSource = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE;

  process.env.HUNGRY_DATA_SOURCE = "supabase";
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "supabase";
  resetServiceProvider();
  assert.equal(getServiceProvider().mode, "supabase");

  setMockServiceProvider();
  assert.equal(getServiceProvider().mode, "mock");

  process.env.HUNGRY_DATA_SOURCE = previousDataSource;
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = previousPublicDataSource;
  resetServiceProvider();
});

test("released builds reject fixture mode and use Supabase or the Excel catalog fallback", () => {
  const previousEnvironment = process.env.EXPO_PUBLIC_APP_ENV;
  process.env.EXPO_PUBLIC_APP_ENV = "production";
  resetServiceProvider();

  const expectedReleasedMode = isSupabaseConfigured() ? "supabase" : "excel";

  setMockServiceProvider();
  assert.equal(getServiceProvider().mode, expectedReleasedMode);

  setExcelServiceProvider();
  assert.equal(getServiceProvider().mode, expectedReleasedMode);

  if (previousEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
  else process.env.EXPO_PUBLIC_APP_ENV = previousEnvironment;
  resetServiceProvider();
});

test("service provider can be forced into supabase mode for user mode", () => {
  setMockServiceProvider();
  assert.equal(getServiceProvider().mode, "mock");

  setSupabaseServiceProvider();
  assert.equal(getServiceProvider().mode, "supabase");

  resetServiceProvider();
});

test("service provider can be forced into Excel mode without eagerly loading the catalog", () => {
  setMockServiceProvider();
  assert.equal(getServiceProvider().mode, "mock");

  setExcelServiceProvider();
  assert.equal(getServiceProvider().mode, "excel");

  resetServiceProvider();
});
