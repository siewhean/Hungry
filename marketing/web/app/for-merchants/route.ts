import type { NextRequest } from "next/server";

import { stitchResponse } from "../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse("04-for-merchants-68e53927663040ca98098852cb9d9613.html", request);
}
