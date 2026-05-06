import type { NextRequest } from "next/server";

import { stitchResponse } from "../../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse("12-search-analytics-264fb0568f64460cb003884e7df76222.html", request);
}
