import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const requireFromRepo = createRequire(join(repoRoot, "package.json"));
const metroConfigPath = resolve(repoRoot, "metro.config.js");
const servicesDir = resolve(repoRoot, "src/lib/services");

type Resolution = { type: string; filePath?: string };
type ResolveRequest = (context: unknown, moduleName: string, platform: string) => Resolution;

function loadMetroConfig(appEnv: string | undefined): {
  resolver: { resolveRequest?: ResolveRequest };
} {
  const previous = process.env.EXPO_PUBLIC_APP_ENV;
  if (appEnv === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
  else process.env.EXPO_PUBLIC_APP_ENV = appEnv;
  try {
    delete requireFromRepo.cache[metroConfigPath];
    return requireFromRepo(metroConfigPath);
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
    else process.env.EXPO_PUBLIC_APP_ENV = previous;
  }
}

function resolveWith(config: ReturnType<typeof loadMetroConfig>, filePath: string): Resolution {
  const context = {
    resolveRequest: () => ({ type: "sourceFile", filePath }),
  };
  const resolveRequest = config.resolver.resolveRequest;
  return resolveRequest
    ? resolveRequest(context, "irrelevant", "ios")
    : context.resolveRequest();
}

test("production Metro bundles stub out mock and Excel data sources", () => {
  const config = loadMetroConfig("production");
  const stub = join(servicesDir, "excel/releaseBundleStub.js");

  for (const file of [
    "mock/mockService.ts",
    "mock/repositories.ts",
    "mock/data.ts",
    "excel/excelService.ts",
    "excel/repositories.ts",
    "excel/excelCatalog.generated.json",
  ]) {
    assert.equal(resolveWith(config, join(servicesDir, file)).filePath, stub, file);
  }

  const supabaseService = join(servicesDir, "supabase/supabaseService.ts");
  assert.equal(resolveWith(config, supabaseService).filePath, supabaseService);
});

test("non-production Metro bundles keep the real mock and Excel modules", () => {
  const config = loadMetroConfig("development");
  const catalog = join(servicesDir, "excel/excelCatalog.generated.json");
  assert.equal(resolveWith(config, catalog).filePath, catalog);
});
