import { NextResponse, type NextRequest } from "next/server";

import {
  consoleBasicAuthChallengeHeader,
  validateConsoleBasicAuth,
} from "@/lib/security/consoleBasicAuth";
import {
  CSP_NONCE_HEADER,
  createContentSecurityPolicy,
  createCspNonce,
} from "@/lib/security/contentSecurityPolicy";

const MERCHANT_ACCESS_COOKIE = "hungry_merchant_access_token";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const MERCHANT_PORTAL_ENABLED =
  !IS_PRODUCTION || process.env.HUNGRY_MERCHANT_PORTAL_ENABLED === "1";

const merchantAuthRoutes = new Set([
  "/merchant/forgot-password",
  "/merchant/login",
  "/merchant/signup",
]);

function applyPrivateResponseHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

function wantsJson(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";
  return (
    accept.includes("application/json") ||
    request.headers.get("x-requested-with") === "XMLHttpRequest"
  );
}

function redirectOrJson(request: NextRequest, redirectPath: string, message: string) {
  if (wantsJson(request)) {
    return applyPrivateResponseHeaders(NextResponse.json({ error: message }, { status: 401 }));
  }

  const url = new URL(redirectPath, request.url);

  if (redirectPath === "/merchant/login") {
    url.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  }

  return applyPrivateResponseHeaders(NextResponse.redirect(url));
}

function consoleBasicAuthDenied(request: NextRequest) {
  const result = validateConsoleBasicAuth(request);
  if (result.valid) return null;

  const configured = result.configured;
  const breakGlassDisabled = result.reason === "disabled";
  const status = configured ? 401 : 503;
  const message = configured
    ? "Console username and password are required."
    : breakGlassDisabled
      ? "Console Basic Auth break-glass access is disabled."
      : "Console Basic Auth break-glass credentials are not configured.";
  const response = wantsJson(request)
    ? NextResponse.json({ configured, error: message }, { status })
    : new NextResponse(message, { status });

  if (configured) {
    response.headers.set("WWW-Authenticate", consoleBasicAuthChallengeHeader());
  }

  return applyPrivateResponseHeaders(response);
}

function unavailableResponse(request: NextRequest, message: string) {
  const response =
    wantsJson(request) || request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: message }, { status: 503 })
      : new NextResponse(message, { status: 503 });

  return applyPrivateResponseHeaders(response);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = createCspNonce();
  const development = process.env.NODE_ENV === "development";
  const contentSecurityPolicy = createContentSecurityPolicy(nonce, { development });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  function secure(response: NextResponse) {
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return response;
  }

  function nextResponse() {
    return secure(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
    );
  }

  if (
    !MERCHANT_PORTAL_ENABLED &&
    (pathname.startsWith("/merchant") || pathname.startsWith("/api/merchant"))
  ) {
    return secure(
      unavailableResponse(request, "Merchant Portal is not enabled for this deployment."),
    );
  }

  if (pathname.startsWith("/merchant") && !merchantAuthRoutes.has(pathname)) {
    const hasMerchantSession = Boolean(request.cookies.get(MERCHANT_ACCESS_COOKIE)?.value);

    if (!hasMerchantSession) {
      return secure(redirectOrJson(request, "/merchant/login", "Merchant sign-in is required."));
    }
  }

  const hasConsoleBearer =
    pathname.startsWith("/api/console") &&
    request.headers.get("authorization")?.trim().toLowerCase().startsWith("bearer ");

  if (
    (pathname.startsWith("/console") || pathname.startsWith("/api/console")) &&
    !hasConsoleBearer
  ) {
    const denied = consoleBasicAuthDenied(request);
    if (denied) return secure(denied);
  }

  if (
    pathname.startsWith("/merchant") ||
    pathname.startsWith("/console") ||
    pathname.startsWith("/api/console")
  ) {
    return applyPrivateResponseHeaders(nextResponse());
  }

  return nextResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
