import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireJsonRequest, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { isConsoleRole, type ConsoleRole } from "@/lib/console/routeRegistry";
import { updateConsoleAdminMember } from "@/lib/supabase/consoleData";
import {
  isConsoleAuthResponse,
  requireConsoleApiAccess,
  requireConsoleMutationProtection,
  requireConsoleRole,
} from "../../_auth";

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireConsoleApiAccess(request);
  if (isConsoleAuthResponse(auth)) return auth;
  const roleBlocked = requireConsoleRole(auth, "admin");
  if (roleBlocked) return roleBlocked;
  const mutationBlocked = requireConsoleMutationProtection(request);
  if (mutationBlocked) return mutationBlocked;
  const jsonBlocked = requireJsonRequest(request);
  if (jsonBlocked) return jsonBlocked;

  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "console-team-update"),
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const { memberId } = await context.params;
    const body = await readJsonObject(request);
    const role = getStringField(body, "role", { max: 16 });
    const status = getStringField(body, "status", { max: 16 });
    const patch: { role?: ConsoleRole; status?: "active" | "suspended" } = {};
    if (role) {
      if (!isConsoleRole(role)) return jsonError("Invalid console role.", 400);
      patch.role = role;
    }
    if (status) {
      if (status !== "active" && status !== "suspended") return jsonError("Invalid console member status.", 400);
      patch.status = status;
    }

    const member = await updateConsoleAdminMember(auth, memberId, patch);
    return NextResponse.json({ member, ok: true });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    console.error("Console team update failed", error);
    return jsonError(error instanceof Error ? error.message : "Unable to update console team member.", 400);
  }
}
