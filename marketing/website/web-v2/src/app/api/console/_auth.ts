import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/security/api";
import {
  getUserFromAccessToken,
  isSupabaseServiceConfigured,
  supabaseFetchOnDemand,
  type SupabaseUser,
} from "@/lib/supabase/server";

const CONSOLE_API_TOKEN =
  process.env.HUNGRY_CONSOLE_API_TOKEN?.trim() ||
  process.env.HUNGRY_CONSOLE_ADMIN_TOKEN?.trim() ||
  "";

const CONSOLE_API_COOKIE = "hungry_console_api_token";
const CONSOLE_CSRF_HEADER = "x-hungry-csrf";
const CONSOLE_CSRF_HEADER_VALUE = "same-origin";
const CONSOLE_ADMIN_ROLES = "in.(admin,ops)";

type ConsoleAdminRow = {
  email: string | null;
  id: string;
  role: "admin" | "ops" | "viewer";
  status: "active" | "suspended";
  user_id: string;
};

function getBearerToken(value: string | null) {
  if (!value) return undefined;
  const [scheme, token] = value.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : undefined;
}

function getProvidedToken(request: NextRequest) {
  return (
    request.headers.get("x-hungry-console-token")?.trim() ||
    getBearerToken(request.headers.get("authorization")) ||
    request.cookies.get(CONSOLE_API_COOKIE)?.value.trim() ||
    ""
  );
}

function getProvidedTokenSource(request: NextRequest) {
  if (request.headers.get("x-hungry-console-token")?.trim()) return "header";
  if (getBearerToken(request.headers.get("authorization"))) return "authorization";
  if (request.cookies.get(CONSOLE_API_COOKIE)?.value.trim()) return "cookie";
  return "none";
}

function getOriginHost(origin: string | null) {
  if (!origin) return "";
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

function getRequestHost(request: NextRequest) {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
}

async function requireConsoleAdminRole(accessToken: string) {
  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error: "Console role authorization is not configured.",
      },
      { status: 503 },
    );
  }

  let user: SupabaseUser;
  try {
    user = await getUserFromAccessToken(accessToken);
  } catch {
    return NextResponse.json(
      {
        configured: true,
        error: "Console API access is not authorized.",
      },
      { status: 401 },
    );
  }

  let data: ConsoleAdminRow[];
  try {
    const result = await supabaseFetchOnDemand<ConsoleAdminRow[]>("rest/v1/website_console_admins", {
      params: {
        limit: 1,
        role: CONSOLE_ADMIN_ROLES,
        select: "id,user_id,email,role,status",
        status: "eq.active",
        user_id: `eq.${user.id}`,
      },
      serviceRole: true,
    });
    data = result.data;
  } catch (error) {
    console.error("Console admin role lookup failed", error);
    return NextResponse.json(
      {
        configured: true,
        error: "Console role authorization is unavailable.",
      },
      { status: 503 },
    );
  }

  if (data.length > 0) return null;

  return NextResponse.json(
    {
      configured: true,
      error: "Console API access is not authorized.",
    },
    { status: 401 },
  );
}

export async function requireConsoleApiAccess(request: NextRequest) {
  const bearerToken = getBearerToken(request.headers.get("authorization"));
  const providedToken = getProvidedToken(request);

  if (CONSOLE_API_TOKEN && providedToken === CONSOLE_API_TOKEN) {
    return null;
  }

  if (bearerToken && bearerToken !== CONSOLE_API_TOKEN) {
    return requireConsoleAdminRole(bearerToken);
  }

  if (!CONSOLE_API_TOKEN) {
    if (process.env.NODE_ENV !== "production" || process.env.HUNGRY_ALLOW_UNPROTECTED_CONSOLE_API === "1") {
      return null;
    }
    return NextResponse.json(
      {
        configured: false,
        error: "Console API authorization is not configured.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      configured: true,
      error: "Console API access is not authorized.",
    },
    { status: 401 },
  );
}

export function requireConsoleMutationProtection(request: NextRequest) {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    return jsonError("Cross-site requests are not allowed.", 403);
  }

  const originHost = getOriginHost(request.headers.get("origin"));
  const requestHost = getRequestHost(request);
  if (originHost && requestHost && originHost !== requestHost) {
    return jsonError("Request origin is not allowed.", 403);
  }

  if (
    getProvidedTokenSource(request) === "cookie" &&
    request.headers.get(CONSOLE_CSRF_HEADER) !== CONSOLE_CSRF_HEADER_VALUE
  ) {
    return jsonError("Request verification failed.", 403);
  }

  return null;
}
