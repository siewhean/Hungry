import { NextResponse, type NextRequest } from "next/server";

import {
  consoleBasicAuthChallengeHeader,
  validateConsoleBasicAuth,
} from "@/lib/security/consoleBasicAuth";

const MERCHANT_ACCESS_COOKIE = "hungry_merchant_access_token";

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
  const status = configured ? 401 : 503;
  const message = configured
    ? "Console username and password are required."
    : "Console username and password are not configured.";
  const response = wantsJson(request)
    ? NextResponse.json({ configured, error: message }, { status })
    : new NextResponse(message, { status });

  if (configured) {
    response.headers.set("WWW-Authenticate", consoleBasicAuthChallengeHeader());
  }

  return applyPrivateResponseHeaders(response);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/merchant") && !merchantAuthRoutes.has(pathname)) {
    const hasMerchantSession = Boolean(request.cookies.get(MERCHANT_ACCESS_COOKIE)?.value);

    if (!hasMerchantSession) {
      return redirectOrJson(request, "/merchant/login", "Merchant sign-in is required.");
    }
  }

  if (pathname.startsWith("/console") || pathname.startsWith("/api/console")) {
    const denied = consoleBasicAuthDenied(request);
    if (denied) return denied;
  }

  if (
    pathname.startsWith("/merchant") ||
    pathname.startsWith("/console") ||
    pathname.startsWith("/api/console")
  ) {
    return applyPrivateResponseHeaders(NextResponse.next());
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
