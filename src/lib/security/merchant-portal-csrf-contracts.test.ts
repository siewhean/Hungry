import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("web Merchant Portal cookie mutations require CSRF and same-origin protection", () => {
  const session = read("marketing/website/web-v2/src/app/api/merchant/_session.ts");
  const clientHelper = read("marketing/website/web-v2/src/lib/merchantPortal/csrf.ts");

  assert.match(session, /MERCHANT_CSRF_COOKIE/);
  assert.match(session, /MERCHANT_CSRF_HEADER/);
  assert.match(session, /setMerchantCsrfCookie/);
  assert.match(session, /clearMerchantSessionCookies/);
  assert.match(session, /requireMerchantSameOriginRequest/);
  assert.match(session, /sec-fetch-site/);
  assert.match(session, /getAllowedRequestOrigins/);
  assert.match(session, /csrfCookie !== csrfHeader/);
  assert.match(session, /requireMerchantJsonRequest/);

  assert.match(clientHelper, /MERCHANT_CSRF_COOKIE/);
  assert.match(clientHelper, /MERCHANT_CSRF_HEADER/);
  assert.match(clientHelper, /merchantMutationFetch/);
  assert.match(clientHelper, /headers\.set\(MERCHANT_CSRF_HEADER/);
  assert.match(clientHelper, /credentials: "same-origin"/);

  for (const route of [
    "logout/route.ts",
    "profile/route.ts",
    "menu/route.ts",
    "menu/[dishId]/route.ts",
    "verification/route.ts",
  ]) {
    const source = read(`marketing/website/web-v2/src/app/api/merchant/${route}`);
    assert.match(source, /requireMerchantMutationProtection/);
    assert.match(source, /const blocked = requireMerchantMutationProtection\(request\)/);
    assert.match(source, /if \(blocked\) return blocked/);
  }
});

test("web Merchant Portal login rejects cross-site and non-JSON cookie-setting requests", () => {
  const login = read("marketing/website/web-v2/src/app/api/merchant/login/route.ts");

  assert.match(login, /requireMerchantSameOriginRequest/);
  assert.match(login, /requireMerchantJsonRequest/);
  assert.match(login, /setMerchantCsrfCookie\(response\)/);
  assert.match(login, /response\.cookies\.set\(MERCHANT_ACCESS_COOKIE/);
  assert.match(login, /response\.cookies\.set\(MERCHANT_REFRESH_COOKIE/);
});

test("web Merchant Portal sign-up and forgot-password are safe public auth routes", () => {
  const clientLayout = read("marketing/website/web-v2/src/app/merchant/MerchantClientLayout.tsx");
  const loginPage = read("marketing/website/web-v2/src/app/merchant/login/page.tsx");
  const signupPage = read("marketing/website/web-v2/src/app/merchant/signup/page.tsx");
  const forgotPage = read("marketing/website/web-v2/src/app/merchant/forgot-password/page.tsx");
  const signupRoute = read("marketing/website/web-v2/src/app/api/merchant/signup/route.ts");
  const forgotRoute = read(
    "marketing/website/web-v2/src/app/api/merchant/forgot-password/route.ts",
  );
  const supabaseServer = read("marketing/website/web-v2/src/lib/supabase/server.ts");

  assert.match(clientLayout, /MERCHANT_AUTH_ROUTES/);
  assert.match(clientLayout, /"\/merchant\/signup"/);
  assert.match(clientLayout, /"\/merchant\/forgot-password"/);
  assert.match(loginPage, /href="\/merchant\/signup"/);
  assert.match(loginPage, /href="\/merchant\/forgot-password"/);

  assert.match(signupPage, /\/api\/merchant\/signup/);
  assert.match(signupPage, /businessName/);
  assert.match(signupPage, /Create merchant access/);
  assert.match(forgotPage, /\/api\/merchant\/forgot-password/);
  assert.match(forgotPage, /Send reset instructions/);

  for (const source of [signupRoute, forgotRoute]) {
    assert.match(source, /requireMerchantSameOriginRequest/);
    assert.match(source, /requireMerchantJsonRequest/);
    assert.match(source, /requireRateLimit/);
  }

  assert.match(signupRoute, /signUpWithPassword/);
  assert.match(signupRoute, /submitWebsiteWaitlist/);
  assert.match(forgotRoute, /sendPasswordResetEmail/);
  assert.match(supabaseServer, /auth\/v1\/signup/);
  assert.match(supabaseServer, /auth\/v1\/recover/);
});

test("web Merchant Portal mutation callers attach the CSRF header helper", () => {
  for (const page of [
    "MerchantClientLayout.tsx",
    "page.tsx",
    "profile/page.tsx",
    "menu/page.tsx",
    "verification/page.tsx",
  ]) {
    const source = read(`marketing/website/web-v2/src/app/merchant/${page}`);
    assert.match(source, /merchantMutationFetch/);
  }
});
