import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getConsoleRouteDataset } from "@/lib/supabase/consoleData";
import { isConsoleAuthResponse, requireConsoleApiAccess } from "../_auth";

export async function GET(request: NextRequest) {
  const auth = await requireConsoleApiAccess(request);
  if (isConsoleAuthResponse(auth)) return auth;

  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "console-dataset"),
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const params = request.nextUrl.searchParams;
    const section = params.get("section") ?? "overview";
    const searchParams = Object.fromEntries(params.entries());
    return NextResponse.json(await getConsoleRouteDataset(section, searchParams, auth));
  } catch (error) {
    console.error("Console dataset load failed", error);
    return jsonError(error instanceof Error ? error.message : "Unable to load console dataset.", 500);
  }
}
