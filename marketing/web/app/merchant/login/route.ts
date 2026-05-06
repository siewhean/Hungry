import type { NextRequest } from "next/server";

import { stitchResponse } from "../../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse("01-merchant-login-91ae482421f9479aaebbe04d9858c12d.html", request);
}
