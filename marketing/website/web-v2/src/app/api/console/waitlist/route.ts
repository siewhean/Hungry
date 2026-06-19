import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { listConsoleWaitlistEntries } from "@/lib/supabase/websiteData";
import { requireConsoleApiAccess } from "../_auth";

export async function GET(request: NextRequest) {
  const unauthorized = await requireConsoleApiAccess(request);
  if (unauthorized) return unauthorized;

  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "console-waitlist"),
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    return NextResponse.json(await listConsoleWaitlistEntries());
  } catch (error) {
    console.error("Console waitlist list failed", error);
    return jsonError("Unable to load console waitlist.", 500);
  }
}
