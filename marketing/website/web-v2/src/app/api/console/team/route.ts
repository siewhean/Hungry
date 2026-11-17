import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireJsonRequest, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { isConsoleRole } from "@/lib/console/routeRegistry";
import { addConsoleAdminMember } from "@/lib/supabase/consoleData";
import {
  isConsoleAuthResponse,
  requireConsoleApiAccess,
  requireConsoleMutationProtection,
  requireConsoleRole,
} from "../_auth";

export async function POST(request: NextRequest) {
  const auth = await requireConsoleApiAccess(request);
  if (isConsoleAuthResponse(auth)) return auth;
  const roleBlocked = requireConsoleRole(auth, "admin");
  if (roleBlocked) return roleBlocked;
  const mutationBlocked = requireConsoleMutationProtection(request);
  if (mutationBlocked) return mutationBlocked;
  const jsonBlocked = requireJsonRequest(request);
  if (jsonBlocked) return jsonBlocked;

  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "console-team-create"),
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await readJsonObject(request);
    const email = getStringField(body, "email", { max: 320, required: true, transform: "lower-trim" });
    const userId = getStringField(body, "userId", { max: 64, required: true });
    const role = getStringField(body, "role", { fallback: "viewer", max: 16 }) ?? "viewer";
    if (!email || !userId) return jsonError("Email and Supabase user ID are required.", 400);
    if (!isConsoleRole(role)) return jsonError("Invalid console role.", 400);

    const member = await addConsoleAdminMember(auth, { email, role, userId });
    return NextResponse.json({ member, ok: true });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    console.error("Console team create failed", error);
    return jsonError(error instanceof Error ? error.message : "Unable to add console team member.", 400);
  }
}
