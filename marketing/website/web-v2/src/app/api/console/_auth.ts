import { NextRequest, NextResponse } from "next/server";

import {
  consoleBasicAuthChallengeHeader,
  validateConsoleBasicAuth,
} from "@/lib/security/consoleBasicAuth";
import { jsonError } from "@/lib/security/api";
import {
  createBasicConsoleActor,
  resolveConsoleActorFromBearer,
  type ConsoleActor,
} from "@/lib/supabase/consoleData";
import { roleCanAccess, type ConsoleRole } from "@/lib/console/routeRegistry";

const CONSOLE_CSRF_HEADER = "x-hungry-csrf";
const CONSOLE_CSRF_HEADER_VALUE = "same-origin";

function getProvidedTokenSource(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim().toLowerCase() ?? "";
  if (authorization.startsWith("bearer ")) {
    return "bearer";
  }
  if (authorization.startsWith("basic ")) {
    return "basic";
  }
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

export function isConsoleAuthResponse(result: ConsoleActor | NextResponse): result is NextResponse {
  return "headers" in result && "status" in result && typeof result.headers.get === "function";
}

export async function requireConsoleApiAccess(request: NextRequest): Promise<ConsoleActor | NextResponse> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    try {
      return await resolveConsoleActorFromBearer(authorization.slice("bearer ".length).trim());
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Console access denied.", 403);
    }
  }

  const result = validateConsoleBasicAuth(request);
  if (result.valid) {
    return createBasicConsoleActor();
  }

  const configured = result.configured;
  const status = configured ? 401 : 503;
  const response = NextResponse.json(
    {
      configured,
      error: configured
        ? "Console username and password are required."
        : "Console username and password are not configured.",
    },
    { status },
  );

  if (configured) {
    response.headers.set("WWW-Authenticate", consoleBasicAuthChallengeHeader());
  }

  return response;
}

export function requireConsoleRole(actor: ConsoleActor, minRole: ConsoleRole) {
  if (roleCanAccess(actor.role, minRole)) return null;
  return jsonError("This console role is not allowed to perform that action.", 403);
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
    getProvidedTokenSource(request) !== "bearer" &&
    request.headers.get(CONSOLE_CSRF_HEADER) !== CONSOLE_CSRF_HEADER_VALUE
  ) {
    return jsonError("Request verification failed.", 403);
  }

  return null;
}
