import { NextResponse, type NextRequest } from "next/server";

const MERCHANT_ACCESS_COOKIE = "hungry_merchant_access_token";
const CONSOLE_TOKEN_COOKIE = "hungry_console_api_token";
const CONSOLE_TOKEN_HEADER = "x-hungry-console-token";

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

function configuredConsoleToken() {
  return (
    process.env.HUNGRY_CONSOLE_API_TOKEN?.trim() ||
    process.env.HUNGRY_CONSOLE_ADMIN_TOKEN?.trim() ||
    ""
  );
}

function hasConsolePageAccess(request: NextRequest) {
  const configuredToken = configuredConsoleToken();
  const providedToken =
    request.headers.get(CONSOLE_TOKEN_HEADER)?.trim() ||
    request.cookies.get(CONSOLE_TOKEN_COOKIE)?.value.trim() ||
    "";
  const bearerToken = request.headers.get("authorization")?.trim();

  if (configuredToken) {
    return providedToken === configuredToken || bearerToken === `Bearer ${configuredToken}`;
  }

  return process.env.NODE_ENV !== "production" || process.env.HUNGRY_ALLOW_UNPROTECTED_CONSOLE_API === "1";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/merchant") && !merchantAuthRoutes.has(pathname)) {
    const hasMerchantSession = Boolean(request.cookies.get(MERCHANT_ACCESS_COOKIE)?.value);

    if (!hasMerchantSession) {
      return redirectOrJson(request, "/merchant/login", "Merchant sign-in is required.");
    }
  }

  if (pathname.startsWith("/console") && !hasConsolePageAccess(request)) {
    return redirectOrJson(request, "/", "Console access is not authorized.");
  }

  if (pathname.startsWith("/merchant") || pathname.startsWith("/console")) {
    return applyPrivateResponseHeaders(NextResponse.next());
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
