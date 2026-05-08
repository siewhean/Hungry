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
  assert.match(bootstrap, /client\.auth\s*\.\s*getSession\(\)/);
  assert.match(bootstrap, /client\.auth\.onAuthStateChange/);
  assert.match(rootNavigator, /const isAuthReady = useSessionStore/);
  assert.match(rootNavigator, /if \(!isAuthReady\) \{\s*return;\s*\}/);
  assert.match(splash, /if \(!isAuthReady\) \{\s*return;\s*\}/);
});

test("Supabase auth responses hydrate the app profile store", () => {
  const profileStore = read("src/store/useProfileStore.ts");
  const loginScreen = read("src/app/screens/auth/LoginScreen.tsx");
  const signUpScreen = read("src/app/screens/auth/SignUpScreen.tsx");
  const bootstrap = read("src/hooks/useAppBootstrap.ts");

  assert.match(profileStore, /applyProfile: \(profile: UserProfile\) => void/);
  assert.match(loginScreen, /applyProfile\(session\.profile\)/);
  assert.match(signUpScreen, /applyProfile\(session\.profile\)/);
  assert.match(bootstrap, /getHungryService\(\)\.profile\.getProfile\(\)/);
  assert.doesNotMatch(
    loginScreen,
    /await getHungryService\(\)\.auth\.signIn\(values\.email, values\.password\);\s*\n\s*\}/,
  );
});
