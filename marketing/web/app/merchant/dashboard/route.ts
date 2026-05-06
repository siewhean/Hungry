import type { NextRequest } from "next/server";

import { stitchResponse } from "../../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse(
    "13-merchant-dashboard-detail-84ca45f0daa847019ed235e2ae6fa29f.html",
    request,
  );
}
