import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { listConsoleMerchants } from "@/lib/supabase/websiteData";
import { isConsoleAuthResponse, requireConsoleApiAccess } from "../_auth";

export async function GET(request: NextRequest) {
  const auth = await requireConsoleApiAccess(request);
  if (isConsoleAuthResponse(auth)) return auth;

  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "console-merchants"),
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    return NextResponse.json(await listConsoleMerchants());
  } catch (error) {
    console.error("Console merchant list failed", error);
    return jsonError("Unable to load console merchants.", 500);
  }
}
