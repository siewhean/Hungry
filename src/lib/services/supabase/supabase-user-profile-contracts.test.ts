import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("Supabase mode never creates an authenticated placeholder profile id", () => {
  const repository = read("src/lib/services/supabase/supabaseRepository.ts");
  const service = read("src/lib/services/supabase/supabaseService.ts");

  assert.doesNotMatch(repository, /supabase-user/);
  assert.doesNotMatch(service, /supabase-user/);
  assert.match(repository, /getProfile\(isAuthenticated: boolean, userId\?: string \| null\)/);
  assert.match(repository, /return buildAuthenticatedProfile\(userId\)/);
  assert.match(service, /fetchUserProfile\(client, userId/);
  assert.match(service, /id: userId/);
});

test("session/profile stores bind temporary Supabase auth profiles to the real session UUID", () => {
  const serviceTypes = read("src/lib/services/types.ts");
  const profileStore = read("src/store/useProfileStore.ts");
  const sessionStore = read("src/store/useSessionStore.ts");
  const bootstrap = read("src/hooks/useAppBootstrap.ts");

  assert.match(serviceTypes, /getProfile\(isAuthenticated: boolean, userId\?: string \| null\)/);
  assert.match(profileStore, /syncProfile: \(isAuthenticated: boolean, userId\?: string \| null\)/);
  assert.match(sessionStore, /syncProfileForAuthState\(true,\s*session\.userId\)/);
  assert.match(sessionStore, /getConfiguredDataSource\(\) === "supabase"/);
  assert.match(sessionStore, /isUuidLike\(profileId\)/);
  assert.match(sessionStore, /const isInvalidSupabaseAuthState =/);
  assert.match(sessionStore, /session\.isAuthenticated[\s\S]*!isUuidLike\(session\.userId\)/);
  assert.match(sessionStore, /isInvalidSupabaseAuthState[\s\S]*isAuthenticated: false/);
  assert.doesNotMatch(sessionStore, /syncProfile\(true\)/);

  const providerIndex = bootstrap.indexOf("setSupabaseServiceProvider();");
  const profileSyncIndex = bootstrap.indexOf(
    "syncProfile(hasValidSupabaseAuth, authenticatedUserId);",
  );
  assert.ok(providerIndex >= 0, "bootstrap should select the Supabase provider");
  assert.ok(
    profileSyncIndex > providerIndex,
    "bootstrap should sync the UUID-bound profile after swap",
  );
  assert.doesNotMatch(bootstrap, /syncProfile\(isAuthenticated\);/);
});
