import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Supabase auth bootstrap gates protected-route redirects until session restore completes", () => {
  const sessionStore = read("src/store/useSessionStore.ts");
  const bootstrap = read("src/hooks/useAppBootstrap.ts");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const splash = read("src/app/screens/SplashScreen.tsx");

  assert.match(sessionStore, /isAuthReady: false/);
  assert.match(sessionStore, /markAuthReady: \(\) => set\(\{ isAuthReady: true \}\)/);
  assert.match(bootstrap, /const hasHydrated = useSessionStore/);
  assert.match(bootstrap, /if \(!hasHydrated\) \{\s*return;\s*\}/);
  assert.match(bootstrap, /client\.auth\s*\.\s*getSession\(\)/);
  assert.match(bootstrap, /client\.auth\.onAuthStateChange/);
  assert.match(rootNavigator, /const isAuthReady = useSessionStore/);
  assert.match(rootNavigator, /if \(!isAuthReady\) \{\s*return;\s*\}/);
  assert.match(splash, /if \(!isAuthReady\) \{\s*return;\s*\}/);
});

test("Supabase auth responses hydrate the app profile store", () => {
  const profileStore = read("src/store/useProfileStore.ts");
  const profileHelper = read("src/features/auth/applySignedInProfile.ts");
  const loginScreen = read("src/app/screens/auth/LoginScreen.tsx");
  const signUpScreen = read("src/app/screens/auth/SignUpScreen.tsx");
  const bootstrap = read("src/hooks/useAppBootstrap.ts");

  assert.match(profileStore, /applyProfile: \(profile: UserProfile\) => void/);
  assert.match(profileHelper, /useProfileStore\.getState\(\)\.applyProfile\(mergedProfile\)/);
  assert.match(loginScreen, /applySignedInProfile\(session\.profile/);
  assert.match(signUpScreen, /applySignedInProfile\(session\.profile/);
  assert.match(bootstrap, /getHungryService\(\)\.profile\.getProfile\(\)/);
  assert.doesNotMatch(
    loginScreen,
    /await getHungryService\(\)\.auth\.signIn\(values\.email, values\.password\);\s*\n\s*\}/,
  );
});

test("Supabase auth bootstrap preserves restored sessions across transient startup failures", () => {
  const bootstrap = read("src/hooks/useAppBootstrap.ts");
  const sessionStore = read("src/store/useSessionStore.ts");

  assert.match(
    sessionStore,
    /partialize: \(state\) => \(\{[\s\S]*isAuthenticated: state\.isAuthenticated[\s\S]*authenticatedUserId: state\.authenticatedUserId[\s\S]*authDataSource: state\.authDataSource/,
  );
  assert.match(bootstrap, /const restoredSession = useSessionStore\.getState\(\)/);
  assert.match(bootstrap, /function preserveRestoredAuthState/);
  assert.match(
    bootstrap,
    /restoredSession\.isAuthenticated && restoredSession\.authenticatedUserId/,
  );
  assert.match(
    bootstrap,
    /applyAuthStateFromSession\(\{\s*isAuthenticated: true,\s*userId: restoredSession\.authenticatedUserId,\s*\}\)/,
  );
});

test("restored mock sessions keep the mock provider instead of being rejected as Supabase sessions", () => {
  const bootstrap = read("src/hooks/useAppBootstrap.ts");
  const sessionStore = read("src/store/useSessionStore.ts");

  assert.match(sessionStore, /authDataSource\?: HungryDataSource \| null/);
  assert.match(sessionStore, /authDataSource: shouldAuthenticate \? authDataSource : null/);
  assert.match(bootstrap, /const authDataSource = useSessionStore/);
  assert.match(bootstrap, /const restoredMockSession =/);
  assert.match(bootstrap, /authDataSource === "mock"/);
  assert.match(bootstrap, /setMockServiceProvider\(\)/);
});

test("explicit mock data source keeps user-mode bootstrap on mock services for dev and E2E", () => {
  const bootstrap = read("src/hooks/useAppBootstrap.ts");

  assert.match(bootstrap, /const configuredDataSource = getConfiguredDataSource\(\)/);
  assert.match(
    bootstrap,
    /if \(configuredDataSource === "mock"\) \{\s*setMockServiceProvider\(\);[\s\S]*setIsDataSourceReady\(true\);\s*return;\s*\}/,
  );
  assert.match(bootstrap, /setConfiguredDataSource\("supabase"\)/);
  assert.match(bootstrap, /setSupabaseServiceProvider\(\)/);
});

test("Supabase null-session bootstrap events do not clear a restored app session", () => {
  const bootstrap = read("src/hooks/useAppBootstrap.ts");

  assert.match(
    bootstrap,
    /const user = data\.session\?\.user;\s*if \(!user\) \{\s*if \(preserveRestoredAuthState\(applyAuthStateFromSession\)\) \{\s*return;\s*\}\s*applyAuthStateFromSession\(\{ isAuthenticated: false, userId: null \}\);/,
  );
  assert.match(bootstrap, /client\.auth\.onAuthStateChange\(\(event, session\) =>/);
  assert.match(
    bootstrap,
    /if \(event !== "SIGNED_OUT" && preserveRestoredAuthState\(applyAuthStateFromSession\)\) \{\s*return;\s*\}\s*applyAuthStateFromSession\(\{ isAuthenticated: false, userId: null \}\);/,
  );
});
