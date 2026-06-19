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
assertContains("src/proxy.ts", "hungry_console_api_token", "Console page proxy cookie contract failed");
assertContains("src/proxy.ts", "NODE_ENV !== \"production\"", "Console dev bypass production fence failed");
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
assertContains("src/app/console/merchants/page.tsx", "getConsolePrototypeFallback(initialMockMerchants, [])", "Console merchant local fallback fence failed");
assertContains("src/app/console/users/page.tsx", "getConsolePrototypeFallback(initialUsers, [])", "Console users local fallback fence failed");
assertContains("src/app/console/users/page.tsx", "const userActionsEnabled = getConsolePrototypeFallback(true, false)", "Console users production action fence failed");
assertContains("src/app/console/users/page.tsx", "User management backend is not connected in production.", "Console users mutation backend guard failed");
assertContains("src/app/console/users/page.tsx", "User export backend is not connected in production.", "Console users export backend guard failed");
assertContains("src/app/console/users/page.tsx", "users.length > 0 ? Math.round((activeCount / users.length) * 100) : 0", "Console users empty active-rate guard failed");
assertContains("src/app/console/feedback/page.tsx", "getConsolePrototypeFallback(initialFeedback, [])", "Console feedback local fallback fence failed");
assertContains("src/app/console/reports/page.tsx", "getConsolePrototypeFallback(initialReports, [])", "Console reports local fallback fence failed");
assertContains("src/app/console/merchant-applications/page.tsx", "getConsolePrototypeFallback(initialApplications, [])", "Console merchant applications local fallback fence failed");
assertContains("src/app/console/feature-flags/page.tsx", "getConsolePrototypeFallback(initialFlags, [])", "Console feature flags local fallback fence failed");
assertContains("src/app/console/page.tsx", "getConsolePrototypeFallback(initialClaims, [])", "Console overview claim fallback fence failed");
assertContains("src/app/console/page.tsx", "getConsolePrototypeFallback(initialAlerts, [])", "Console overview alert fallback fence failed");
assertContains("src/app/console/page.tsx", "getConsolePrototypeFallback(initialRequestVolumePoints, [])", "Console overview request volume fallback fence failed");
assertContains("src/app/console/page.tsx", "Live data unavailable", "Console overview live-data empty state contract failed");
assertContains("src/app/console/page.tsx", "No live merchant review queue data available", "Console overview merchant queue empty state contract failed");
assertContains("src/app/console/notifications/page.tsx", "getConsolePrototypeFallback(mockNotifications, [])", "Console notifications local fallback fence failed");
assertContains("src/app/console/notifications/page.tsx", "const notificationActionsEnabled = getConsolePrototypeFallback(true, false)", "Console notifications production action fence failed");
assertContains("src/app/console/notifications/page.tsx", "Notification backend is not connected in production.", "Console notifications production no-op guard failed");
assertContains("src/app/console/product-analytics/page.tsx", "const prototypeAnalyticsEnabled = getConsolePrototypeFallback(true, false)", "Console product analytics production fallback fence failed");
assertContains("src/app/console/product-analytics/page.tsx", "Live product analytics unavailable", "Console product analytics empty state contract failed");
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
assertContains("src/lib/supabase/websiteData.ts", "email: redactEmail(asString(row.email))", "Console waitlist email redaction contract failed");
assertContains("src/lib/supabase/websiteData.ts", "emailRedacted: true", "Console waitlist redaction marker contract failed");
assertContains("src/lib/supabase/websiteData.ts", "metadata: sanitizeConsoleMetadata(row.metadata)", "Console waitlist metadata redaction contract failed");
assertContains("src/app/console/waitlist/page.tsx", "Email redacted by default for privacy.", "Console waitlist redacted UI contract failed");
assertContains("src/app/console/users/page.tsx", "redactEmail(user.email)", "Console users email redaction UI contract failed");
assertContains("src/app/console/feedback/page.tsx", "redactEmail(item.email)", "Console feedback table redaction UI contract failed");
assertContains("src/app/console/feedback/page.tsx", "redactEmail(replyTarget.email)", "Console feedback reply redaction UI contract failed");
assertContains("src/app/console/merchant-applications/page.tsx", "redactContact(app.contact)", "Console merchant application table contact redaction contract failed");
assertContains("src/app/console/merchant-applications/page.tsx", "redactContact(selectedApp.contact)", "Console merchant application drawer contact redaction contract failed");
assertContains("src/app/console/merchant-applications/page.tsx", "redactIdentifier(selectedApp.uen, 3, 2)", "Console merchant application UEN redaction contract failed");
assertContains("src/app/console/merchant-applications/page.tsx", "redactIdentifier(selectedApp.sfaLicenceNo, 2, 2)", "Console merchant application licence redaction contract failed");
assertContains("src/app/console/merchants/page.tsx", "redactIdentifier(selectedMerchant.uen, 3, 2)", "Console merchant drawer UEN redaction contract failed");
assertContains("src/app/console/merchants/page.tsx", 'placeholder="Enter replacement UEN only"', "Console merchant UEN replacement placeholder contract failed");
assertContains("src/app/console/merchants/page.tsx", 'logs.push("UEN updated - Today")', "Console merchant audit log UEN redaction contract failed");

console.log("Website security route contracts passed.");
