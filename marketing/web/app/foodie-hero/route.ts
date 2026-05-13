import type { NextRequest } from "next/server";

import { stitchResponse } from "../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse(
    "08-foodie-hero-visual-feast-60812b7af2db4eca813b95bf7c0f5709.html",
    request,
  );
}
