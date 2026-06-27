import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { clearConsoleWaitlistEntries, listConsoleWaitlistEntries } from "@/lib/supabase/websiteData";
import { recordConsoleAuditEvent } from "@/lib/supabase/consoleData";
import {
  isConsoleAuthResponse,
  requireConsoleApiAccess,
  requireConsoleMutationProtection,
  requireConsoleRole,
} from "../_auth";

export async function GET(request: NextRequest) {
  const auth = await requireConsoleApiAccess(request);
  if (isConsoleAuthResponse(auth)) return auth;

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

export async function DELETE(request: NextRequest) {
  const auth = await requireConsoleApiAccess(request);
  if (isConsoleAuthResponse(auth)) return auth;
  const roleBlocked = requireConsoleRole(auth, "admin");
  if (roleBlocked) return roleBlocked;
  const blocked = requireConsoleMutationProtection(request);
  if (blocked) return blocked;

  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "console-waitlist-delete"),
    limit: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const result = await clearConsoleWaitlistEntries();
    await recordConsoleAuditEvent(auth, {
      action: "console.waitlist.clear",
      metadata: { deleted: result.deleted },
      targetType: "website_waitlist_entries",
    });
    return NextResponse.json(await listConsoleWaitlistEntries());
  } catch (error) {
    console.error("Console waitlist clear failed", error);
    return jsonError("Unable to clear waitlist submissions.", 500);
  }
}
