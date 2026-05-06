import type { NextRequest } from "next/server";

import { stitchResponse } from "../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse("02-join-waitlist-0433941bacaf455d81851e2f401082e5.html", request, {
    waitlistForm: true,
  });
}
