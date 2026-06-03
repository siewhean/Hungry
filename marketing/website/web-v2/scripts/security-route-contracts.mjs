import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertContains(path, pattern, message) {
  const source = read(path);
  if (!source.includes(pattern)) {
    throw new Error(`${message}: ${path} is missing ${pattern}`);
  }
}

const requiredHeaders = [
  "Content-Security-Policy-Report-Only",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
];

const mutationRoutes = [
  "src/app/api/merchant/logout/route.ts",
  "src/app/api/merchant/menu/route.ts",
  "src/app/api/merchant/menu/[dishId]/route.ts",
  "src/app/api/merchant/profile/route.ts",
  "src/app/api/merchant/verification/route.ts",
];

for (const header of requiredHeaders) {
  assertContains("next.config.ts", header, "Security header contract failed");
}

for (const route of mutationRoutes) {
  assertContains(route, "requireMerchantMutationProtection(request)", "Merchant CSRF contract failed");
}

assertContains("src/app/api/console/summary/route.ts", "../_auth", "Console auth import contract failed");
assertContains("src/app/api/console/_auth.ts", "website_console_admins", "Console admin role contract failed");
assertContains("src/app/api/console/_auth.ts", "isSupabaseServiceConfigured", "Console service-role auth contract failed");
assertContains("src/app/api/console/summary/route.ts", "await requireConsoleApiAccess(request)", "Console API auth contract failed");
assertContains("src/app/api/console/merchants/route.ts", "await requireConsoleApiAccess(request)", "Console API auth contract failed");
assertContains(
  "src/app/api/console/merchants/[outletId]/verification/route.ts",
  "requireConsoleMutationProtection(request)",
  "Console mutation origin contract failed",
);
assertContains("src/app/api/waitlist/route.ts", "await requireRateLimit(request", "Waitlist rate-limit contract failed");
assertContains("src/app/api/merchant/login/route.ts", "await requireRateLimit(request", "Merchant login rate-limit contract failed");
assertContains("src/lib/security/api.ts", "HUNGRY_RATE_LIMIT_REDIS_REST_URL", "Durable rate-limit env contract failed");
assertContains("src/lib/security/validation.ts", "readJsonObject", "API validation helper contract failed");
assertContains("src/app/api/merchant/signup/route.ts", "validationErrorResponse(error)", "Merchant signup validation contract failed");
assertContains("src/app/api/merchant/profile/route.ts", "readJsonObject(request", "Merchant profile validation contract failed");
assertContains("src/lib/merchantPortal/csrf.ts", "merchantMutationFetch", "Merchant client CSRF helper contract failed");
assertContains("src/lib/console/prototypeStorage.ts", "NEXT_PUBLIC_HUNGRY_CONSOLE_PROTOTYPE_STORAGE", "Console prototype storage fence contract failed");
assertContains("src/app/console/merchants/page.tsx", "readConsolePrototypeStorage", "Console merchant local fallback fence failed");

console.log("Website security route contracts passed.");
