import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("authenticated catalog users are not globally redirected away during network outages", () => {
  const bootstrap = read("src/hooks/useAppBootstrap.ts");

  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");

  // Going offline shows a banner over the current screen instead of a takeover.
  assert.match(bootstrap, /setOffline\(isNetworkOffline\(state\)\)/);
  assert.match(rootNavigator, /<OfflineBanner \/>/);
  assert.doesNotMatch(rootNavigator, /navigationRef\.navigate\("Offline"\)/);
});

test("Release 0.1 profile does not expose favourites while the route is disabled", () => {
  const profile = read("src/app/screens/profile/ReleaseProfileScreen.tsx");

  assert.match(profile, /FEATURE_FLAGS\.favouritesEnabled \? \(/);
  assert.match(profile, /rootNavigation\.navigate\("Favourites"\)/);
  assert.match(profile, /Your account and essential settings\./);
});

test("profile edits do not claim upload success before persistence or mutate auth email indirectly", () => {
  const profile = read("src/app/screens/profile/EditProfileScreen.tsx");

  assert.match(profile, /Photo selected\. Save changes to upload it\./);
  assert.match(profile, /editable=\{false\}/);
  assert.doesNotMatch(profile, /updateProfile\(\{[\s\S]*?email,/);
  assert.match(profile, /Profile updated\./);
});

test("compiled non-development builds fail closed when app environment is omitted", () => {
  const client = read("src/lib/services/supabase/client.ts");

  assert.match(client, /typeof __DEV__ !== "undefined" && !__DEV__/);
  assert.match(client, /return "production"/);
  assert.match(client, /if \(isReleasedBuild\(\)\) return "supabase"/);
});
