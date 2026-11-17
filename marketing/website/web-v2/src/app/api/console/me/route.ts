import { NextRequest, NextResponse } from "next/server";

import { isConsoleAuthResponse, requireConsoleApiAccess } from "../_auth";

export async function GET(request: NextRequest) {
  const auth = await requireConsoleApiAccess(request);
  if (isConsoleAuthResponse(auth)) return auth;

  return NextResponse.json({
    actor: {
      authMode: auth.authMode,
      email: auth.email,
      role: auth.role,
      status: auth.status,
    },
    configured: true,
  });
}
