import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const scannedRoots = ["src/app", "src/components", "src/features", "src/hooks", "src/store"];
const sourceExtensions = new Set([".ts", ".tsx"]);
const allowedServiceInternalImports = new Set([
  // App-shell configuration checks and diagnostics expose no catalog/auth data;
  // they only report whether the released Supabase client is configured.
  "src/app/AppBody.tsx",
  "src/app/screens/auth/EmailVerificationScreen.tsx",
  "src/app/screens/auth/ForgotPasswordScreen.tsx",
  "src/app/screens/auth/LoginScreen.tsx",
  "src/app/screens/auth/ResetPasswordScreen.tsx",
  "src/app/screens/auth/ResetPasswordSuccessScreen.tsx",
  "src/app/screens/auth/SignUpScreen.tsx",
  "src/app/screens/discover/CatalogDiagnosticsModal.tsx",
  "src/app/screens/dev/DeveloperLauncherScreen.tsx",
  "src/app/screens/onboarding/OnboardingAuthScreen.tsx",
  "src/app/screens/profile/EditProfileScreen.tsx",
  "src/hooks/useAppBootstrap.ts",
  "src/store/useProfileStore.ts",
  "src/store/useSessionStore.ts",
]);

function walkFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(path.join(root, dir))) {
    const relativePath = path.join(dir, entry);
    const absolutePath = path.join(root, relativePath);
    if (statSync(absolutePath).isDirectory()) {
      walkFiles(relativePath, files);
      continue;
    }
    if (sourceExtensions.has(path.extname(relativePath))) {
      files.push(relativePath);
    }
  }
  return files;
}

test("production UI and stores do not bypass the Hungry service provider with mock or Supabase internals", () => {
  const violations: string[] = [];
  const serviceInternalPattern = /@\/lib\/services\/(mock|supabase)\//g;

  for (const scannedRoot of scannedRoots) {
    for (const file of walkFiles(scannedRoot)) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      const source = readFileSync(path.join(root, file), "utf8");
      if (!serviceInternalPattern.test(source)) continue;
      serviceInternalPattern.lastIndex = 0;
      if (allowedServiceInternalImports.has(file)) continue;
      violations.push(file);
    }
  }

  assert.deepEqual(violations, []);
});
