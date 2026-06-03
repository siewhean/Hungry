import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/security/api";
import { getConsoleSummary } from "@/lib/supabase/websiteData";
import { requireConsoleApiAccess } from "../_auth";

export async function GET(request: NextRequest) {
  const unauthorized = await requireConsoleApiAccess(request);
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json(await getConsoleSummary());
  } catch (error) {
    console.error("Console summary load failed", error);
    return jsonError("Unable to load console summary.", 500);
  }
}
