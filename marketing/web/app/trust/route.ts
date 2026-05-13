import type { NextRequest } from "next/server";

import { stitchResponse } from "../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse("07-trust-identity-section-1e858e53dc7f462b87b9ab911b69b818.html", request);
}
