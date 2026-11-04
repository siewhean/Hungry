import { readdirSync, readFileSync, statSync } from "node:fs";
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

function assertNotContains(path, pattern, message) {
  const source = read(path);
  if (source.includes(pattern)) {
    throw new Error(`${message}: ${path} still contains ${pattern}`);
  }
}

function walkSourceFiles(dir) {
  const entries = readdirSync(join(root, dir)).sort();
  const files = [];

  for (const entry of entries) {
    const relativePath = `${dir}/${entry}`;
    const absolutePath = join(root, relativePath);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...walkSourceFiles(relativePath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(relativePath);
    }
  }

  return files;
}

function assertServerOnlyEnvNames() {
  const allowedFiles = new Set(["src/lib/supabase/server.ts"]);
  const forbiddenPatterns = ["SUPABASE_SERVICE_ROLE_KEY", "HUNGRY_SUPABASE_SERVICE_ROLE_KEY"];

  for (const file of walkSourceFiles("src")) {
    if (allowedFiles.has(file)) continue;
    const source = read(file);
    for (const pattern of forbiddenPatterns) {
      if (source.includes(pattern)) {
        throw new Error(`Service-role env name must stay server-only: ${file} contains ${pattern}`);
      }
    }
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

assertContains("src/proxy.ts", 'matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]', "Security proxy matcher failed");
assertContains("src/proxy.ts", "hungry_merchant_access_token", "Merchant page proxy cookie contract failed");
assertContains("src/proxy.ts", "validateConsoleBasicAuth", "Console page proxy basic-auth contract failed");
assertContains("src/proxy.ts", "consoleBasicAuthChallengeHeader", "Console page proxy challenge contract failed");
assertContains("src/proxy.ts", 'pathname.startsWith("/api/console")', "Console API proxy basic-auth contract failed");
assertNotContains("src/proxy.ts", "NODE_ENV !== \"production\"", "Console must not have a dev bypass");
assertNotContains("src/proxy.ts", "HUNGRY_ALLOW_UNPROTECTED_CONSOLE_API", "Console must not have an unprotected bypass");
assertContains("src/proxy.ts", "applyPrivateResponseHeaders", "Private proxy response header contract failed");
assertContains("src/proxy.ts", "no-store, no-cache, must-revalidate, proxy-revalidate", "Private proxy cache contract failed");
assertContains("src/proxy.ts", "noindex, nofollow, noarchive", "Private proxy indexing contract failed");
assertContains("next.config.ts", "privateNoIndexHeaders", "Private route header contract failed");
assertContains("next.config.ts", 'source: "/merchant"', "Merchant root private header contract failed");
assertContains("next.config.ts", 'source: "/merchant/:path*"', "Merchant private header contract failed");
assertContains("next.config.ts", 'source: "/console"', "Console root private header contract failed");
assertContains("next.config.ts", 'source: "/console/:path*"', "Console private header contract failed");
assertContains("next.config.ts", 'source: "/api/merchant/:path*"', "Merchant API private header contract failed");
assertContains("next.config.ts", 'source: "/api/console/:path*"', "Console API private header contract failed");
assertServerOnlyEnvNames();
assertContains("src/components/layout/Navbar.tsx", 'import { siteNav } from "@/content/site";', "Public navbar must use canonical siteNav");
assertNotContains("src/components/layout/Navbar.tsx", "Merchant Portal", "Public navbar must not expose a merchant portal link");
assertNotContains("src/components/layout/Navbar.tsx", "for-merchants#merchant-tools", "Public navbar must not expose a merchant portal anchor");
assertNotContains("src/components/layout/Navbar.module.css", "for-merchants#merchant-tools", "Public navbar must remove hidden merchant portal link styling instead of hiding links with CSS");
assertNotContains("src/app/for-merchants/page.tsx", "merchant-tools", "Public merchant page must not expose the old merchant-tools anchor");

for (const route of mutationRoutes) {
  assertContains(route, "requireMerchantMutationProtection(request)", "Merchant CSRF contract failed");
}

assertContains("src/app/api/console/summary/route.ts", "../_auth", "Console auth import contract failed");
assertContains("src/lib/security/consoleBasicAuth.ts", "HUNGRY_CONSOLE_USERNAME", "Console username env contract failed");
assertContains("src/lib/security/consoleBasicAuth.ts", "HUNGRY_CONSOLE_PASSWORD", "Console password env contract failed");
assertContains("src/lib/security/consoleBasicAuth.ts", "constantTimeEquals", "Console credential comparison contract failed");
assertContains("src/app/api/console/_auth.ts", "validateConsoleBasicAuth", "Console API basic-auth contract failed");
assertContains("src/app/api/console/_auth.ts", "consoleBasicAuthChallengeHeader", "Console API challenge contract failed");
assertNotContains("src/app/api/console/_auth.ts", "HUNGRY_CONSOLE_API_TOKEN", "Console API token bypass must not be used");
assertNotContains("src/app/api/console/_auth.ts", "HUNGRY_ALLOW_UNPROTECTED_CONSOLE_API", "Console API must not have an unprotected bypass");
assertContains("src/app/api/console/summary/route.ts", "await requireConsoleApiAccess(request)", "Console API auth contract failed");
assertContains("src/app/api/console/merchants/route.ts", "await requireConsoleApiAccess(request)", "Console API auth contract failed");
assertContains(
  "src/app/api/console/merchants/[outletId]/verification/route.ts",
  "requireConsoleMutationProtection(request)",
  "Console mutation origin contract failed",
);
assertContains(
  "src/app/api/console/claims/[claimId]/route.ts",
  "requireConsoleMutationProtection(request)",
  "Console claim mutation origin contract failed",
);
assertContains(
  "src/app/api/console/claims/[claimId]/route.ts",
  'requireConsoleRole(auth, "ops")',
  "Console claim ops-role contract failed",
);
assertContains("src/app/api/waitlist/route.ts", "await requireRateLimit(request", "Waitlist rate-limit contract failed");
assertContains("src/app/api/waitlist/route.ts", "requireJsonRequest(request)", "Waitlist JSON content-type contract failed");
assertContains("src/app/api/waitlist/route.ts", "Enter your business name.", "Waitlist merchant business-name validation contract failed");
assertContains("src/app/api/waitlist/route.ts", "Select your food business type.", "Waitlist merchant business-type validation contract failed");
assertContains("src/app/api/waitlist/route.ts", "Specify your food business type.", "Waitlist merchant other-business-type validation contract failed");
assertContains("src/app/api/merchant/login/route.ts", "await requireRateLimit(request", "Merchant login rate-limit contract failed");
assertContains("src/lib/security/api.ts", "HUNGRY_RATE_LIMIT_REDIS_REST_URL", "Durable rate-limit env contract failed");
assertContains("src/lib/security/validation.ts", "readJsonObject", "API validation helper contract failed");
assertContains("src/app/api/merchant/signup/route.ts", "validationErrorResponse(error)", "Merchant signup validation contract failed");
assertContains("src/app/api/merchant/profile/route.ts", "readJsonObject(request", "Merchant profile validation contract failed");
assertContains("src/lib/merchantPortal/audit.ts", "rest/v1/merchant_audit_logs", "Merchant audit helper persistence contract failed");
assertContains("src/lib/merchantPortal/audit.ts", "serviceRole: true", "Merchant audit helper service-role contract failed");
assertContains("src/app/api/merchant/menu/route.ts", "writeMerchantAuditLog", "Merchant menu create audit contract failed");
assertContains("src/app/api/merchant/menu/route.ts", "crypto.randomUUID()", "Merchant menu create ID entropy contract failed");
assertNotContains("src/app/api/merchant/menu/route.ts", "Date.now()", "Merchant menu create must not use timestamp IDs");
assertContains("src/app/api/merchant/menu/[dishId]/route.ts", "writeMerchantAuditLog", "Merchant menu update/delete audit contract failed");
assertContains("src/app/api/merchant/profile/route.ts", "writeMerchantAuditLog", "Merchant profile audit contract failed");
assertContains("src/app/api/merchant/verification/route.ts", "writeMerchantAuditLog", "Merchant verification audit contract failed");
assertContains("src/lib/merchantPortal/csrf.ts", "merchantMutationFetch", "Merchant client CSRF helper contract failed");
assertContains("src/lib/console/prototypeStorage.ts", "NEXT_PUBLIC_HUNGRY_CONSOLE_PROTOTYPE_STORAGE", "Console prototype storage fence contract failed");
assertContains("src/lib/console/prototypeStorage.ts", "const IS_PRODUCTION = process.env.NODE_ENV === \"production\";", "Console prototype production detector contract failed");
assertContains("src/lib/console/prototypeStorage.ts", "!IS_PRODUCTION && process.env.NEXT_PUBLIC_HUNGRY_CONSOLE_PROTOTYPE_STORAGE !== \"0\"", "Console prototype storage production fail-closed contract failed");
assertContains("src/lib/console/prototypeStorage.ts", "getConsolePrototypeFallback<T>", "Console prototype production fallback contract failed");
assertContains("src/app/console/page.tsx", '<ConsoleRoutePage section="overview" />', "Console overview shared route contract failed");
assertContains("src/app/console/merchants/page.tsx", '<ConsoleRoutePage section="merchants" />', "Console merchant shared route contract failed");
assertContains("src/app/console/users/page.tsx", '<ConsoleRoutePage section="users" />', "Console users shared route contract failed");
assertContains("src/app/console/feedback/page.tsx", '<ConsoleRoutePage section="feedback" />', "Console feedback shared route contract failed");
assertContains("src/app/console/reports/page.tsx", '<ConsoleRoutePage section="reports" />', "Console reports shared route contract failed");
assertContains("src/app/console/merchant-applications/page.tsx", '<ConsoleRoutePage section="merchant-applications" />', "Console merchant applications shared route contract failed");
assertContains("src/app/console/feature-flags/page.tsx", '<ConsoleRoutePage section="feature-flags" />', "Console feature flags shared route contract failed");
assertContains("src/app/console/product-analytics/page.tsx", '<ConsoleRoutePage section="product-analytics" />', "Console analytics shared route contract failed");
assertContains("src/app/console/ConsoleRoutePage.tsx", 'route.status === "hidden"', "Console hidden route guard failed");
assertContains("src/app/console/ConsoleRoutePage.tsx", "notFound()", "Console hidden route not-found contract failed");
assertContains("src/app/console/ConsoleRouteClient.tsx", "fetch(\`/api/console/dataset?", "Console production dataset client contract failed");
assertContains("src/app/console/ConsoleRouteClient.tsx", 'credentials: "include"', "Console authenticated fetch contract failed");
assertContains("src/app/console/ConsoleRouteClient.tsx", '"x-hungry-csrf": "same-origin"', "Console mutation CSRF client contract failed");
assertNotContains("src/app/console/ConsoleRouteClient.tsx", "getConsolePrototypeFallback", "Console production client must not load prototype fallbacks");
assertContains("src/app/console/notifications/page.tsx", "notFound()", "Unbacked console notifications route must stay hidden");
assertContains("src/app/api/console/dataset/route.ts", "await requireConsoleApiAccess(request)", "Console dataset auth contract failed");
assertContains("src/app/api/console/dataset/route.ts", "isConsoleAuthResponse(auth)", "Console dataset auth response contract failed");
assertContains("src/app/api/console/dataset/route.ts", "await requireRateLimit(request", "Console dataset rate-limit contract failed");
assertContains("src/app/api/console/me/route.ts", "await requireConsoleApiAccess(request)", "Console identity auth contract failed");
assertContains("src/app/api/console/me/route.ts", "isConsoleAuthResponse(auth)", "Console identity auth response contract failed");
assertContains("src/app/api/console/me/route.ts", "authMode: auth.authMode", "Console identity auth-mode allowlist contract failed");
assertContains("src/app/api/console/me/route.ts", "email: auth.email", "Console identity email allowlist contract failed");
assertContains("src/app/api/console/me/route.ts", "role: auth.role", "Console identity role allowlist contract failed");
assertContains("src/app/api/console/me/route.ts", "status: auth.status", "Console identity status allowlist contract failed");
assertNotContains("src/app/api/console/me/route.ts", "adminId:", "Console identity must not expose internal admin IDs");
assertNotContains("src/app/api/console/me/route.ts", "userId:", "Console identity must not expose Supabase user IDs");
assertNotContains("src/app/api/console/me/route.ts", "id: auth.id", "Console identity must not expose internal actor IDs");
assertContains("src/app/api/console/team/route.ts", "await requireConsoleApiAccess(request)", "Console team auth contract failed");
assertContains("src/app/api/console/team/route.ts", 'requireConsoleRole(auth, "admin")', "Console team admin role contract failed");
assertContains("src/app/api/console/team/route.ts", "requireConsoleMutationProtection(request)", "Console team CSRF contract failed");
assertContains("src/app/api/console/team/route.ts", "requireJsonRequest(request)", "Console team JSON contract failed");
assertContains("src/app/api/console/team/route.ts", "await requireRateLimit(request", "Console team rate-limit contract failed");
assertContains("src/app/api/console/team/route.ts", "readJsonObject(request)", "Console team validation contract failed");
assertContains("src/app/api/console/team/[memberId]/route.ts", "await requireConsoleApiAccess(request)", "Console team member auth contract failed");
assertContains("src/app/api/console/team/[memberId]/route.ts", 'requireConsoleRole(auth, "admin")', "Console team member admin role contract failed");
assertContains("src/app/api/console/team/[memberId]/route.ts", "requireConsoleMutationProtection(request)", "Console team member CSRF contract failed");
assertContains("src/app/api/console/team/[memberId]/route.ts", "requireJsonRequest(request)", "Console team member JSON contract failed");
assertContains("src/app/api/console/team/[memberId]/route.ts", "await requireRateLimit(request", "Console team member rate-limit contract failed");
assertContains("src/app/api/console/team/[memberId]/route.ts", "readJsonObject(request)", "Console team member validation contract failed");
assertContains("src/lib/supabase/consoleData.ts", "roleCanAccess(actor.role, route.minRole)", "Console dataset role boundary contract failed");
assertContains("src/lib/supabase/consoleData.ts", "isSupabaseServiceConfigured()", "Console production service configuration contract failed");
assertContains("src/lib/supabase/consoleData.ts", "serviceRole: true", "Console server data service-role contract failed");
assertContains("src/lib/supabase/consoleData.ts", "redactEmail(value)", "Console shared metadata redaction contract failed");
assertContains("src/lib/supabase/consoleData.ts", "asRedactedEmail(row.email)", "Console record title email redaction contract failed");
assertContains("src/lib/supabase/consoleData.ts", "entry.businessName ?? redactEmail(entry.email)", "Console waitlist subtitle redaction contract failed");
assertContains("src/lib/supabase/consoleData.ts", "entry.name ?? entry.businessName ?? redactEmail(entry.email)", "Console waitlist title redaction contract failed");
assertContains("src/lib/supabase/consoleData.ts", 'emptyTitle: "No records yet"', "Console production empty-state contract failed");
assertContains("src/lib/merchantVerification.ts", "getConsolePrototypeFallback(", "Merchant verification fallback fence failed");
assertContains("src/lib/merchantVerification.ts", "PROTOTYPE_MERCHANT_NAME", "Merchant verification prototype identity marker failed");
assertContains("src/lib/merchantVerification.ts", "productionMerchantVerificationState", "Merchant verification production fallback state failed");
assertContains("src/lib/merchantVerification.ts", 'stallName: "Your Stall"', "Merchant verification production safe stall fallback failed");
assertContains("src/app/merchant/verification/page.tsx", "const corppassPrototypeEnabled = getConsolePrototypeFallback(true, false)", "Merchant Corppass prototype production fence failed");
assertContains("src/app/merchant/verification/page.tsx", "Corppass integration is not connected in production.", "Merchant Corppass unavailable production guard failed");
assertContains("src/app/merchant/verification/page.tsx", "corppassPrototypeEnabled && singpassModalOpen", "Merchant Corppass modal production fence failed");
assertContains("src/app/merchant/verification/page.tsx", "Prototype business profile details", "Merchant Corppass prototype copy contract failed");
assertContains("src/lib/console/redaction.ts", "export function redactEmail", "Console email redaction helper contract failed");
assertContains("src/lib/console/redaction.ts", "export function redactContact", "Console contact redaction helper contract failed");
assertContains("src/lib/console/redaction.ts", "export function redactIdentifier", "Console identifier redaction helper contract failed");
assertContains("src/lib/supabase/websiteData.ts", 'import { redactEmail } from "@/lib/console/redaction";', "Console waitlist shared redaction import contract failed");
assertContains("src/lib/supabase/websiteData.ts", "function sanitizeConsoleMetadata", "Console metadata redaction contract failed");
assertContains("src/lib/supabase/websiteData.ts", "metadata: sanitizeConsoleMetadata(row.metadata)", "Console waitlist metadata redaction contract failed");
assertContains("src/app/console/waitlist/page.tsx", '<ConsoleRoutePage section="waitlist" />', "Console waitlist shared route contract failed");
assertContains("src/lib/supabase/consoleData.ts", "email: redactEmail(entry.email)", "Console waitlist shared-service email redaction contract failed");
assertContains("src/lib/supabase/consoleData.ts", "recordConsoleAuditEvent(actor", "Console mutation audit contract failed");

console.log("Website security route contracts passed.");
