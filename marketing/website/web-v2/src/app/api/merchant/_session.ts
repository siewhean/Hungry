import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/security/api";
import { MERCHANT_CSRF_COOKIE, MERCHANT_CSRF_HEADER } from "@/lib/merchantPortal/csrf";

export const MERCHANT_ACCESS_COOKIE = "hungry_merchant_access_token";
export const MERCHANT_REFRESH_COOKIE = "hungry_merchant_refresh_token";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function createMerchantCsrfToken() {
  return crypto.randomUUID();
}

export function setMerchantCsrfCookie(response: NextResponse, token = createMerchantCsrfToken()) {
  response.cookies.set(MERCHANT_CSRF_COOKIE, token, {
    httpOnly: false,
    maxAge: 60 * 60 * 12,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return token;
}

export function clearMerchantSessionCookies(response: NextResponse) {
  response.cookies.delete(MERCHANT_ACCESS_COOKIE);
  response.cookies.delete(MERCHANT_REFRESH_COOKIE);
  response.cookies.delete(MERCHANT_CSRF_COOKIE);
}

export function ensureMerchantCsrfCookie(request: NextRequest, response: NextResponse) {
  const existing = request.cookies.get(MERCHANT_CSRF_COOKIE)?.value;
  return setMerchantCsrfCookie(response, existing || createMerchantCsrfToken());
}

function getAllowedRequestOrigins(request: NextRequest) {
  return new Set(
    [
      request.nextUrl.origin,
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, ""),
      process.env.HUNGRY_MERCHANT_PORTAL_ORIGIN?.replace(/\/$/, ""),
    ].filter(Boolean),
  );
}

export function requireMerchantMutationProtection(request: NextRequest) {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  const blockedOrigin = requireMerchantSameOriginRequest(request);
  if (blockedOrigin) return blockedOrigin;

  const csrfCookie = request.cookies.get(MERCHANT_CSRF_COOKIE)?.value;
  const csrfHeader = request.headers.get(MERCHANT_CSRF_HEADER)?.trim();
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return jsonError("Merchant request verification failed.", 403);
  }

  return null;
}

export function requireMerchantSameOriginRequest(request: NextRequest) {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    return jsonError("Cross-site merchant requests are not allowed.", 403);
  }

  const origin = request.headers.get("origin")?.replace(/\/$/, "");
  if (origin && !getAllowedRequestOrigins(request).has(origin)) {
    return jsonError("Merchant request origin is not allowed.", 403);
  }

  return null;
}

export function requireMerchantJsonRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return jsonError("Merchant request must use JSON.", 415);
  }

  return null;
}

export async function requireMerchantAccessToken() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(MERCHANT_ACCESS_COOKIE)?.value;
  if (!accessToken) {
    throw new Error("Merchant sign-in is required.");
  }
  return accessToken;
}
