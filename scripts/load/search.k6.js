import http from "k6/http";
import { check, fail, sleep } from "k6";

const SUPABASE_URL = (__ENV.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";

export const options = {
  vus: Number(__ENV.LOAD_VUS || 5),
  duration: __ENV.LOAD_DURATION || "1m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

const queries = ["laksa", "chicken rice", "halal", "late night", "value"];

function requireReadOnlySupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail("search load test requires staging SUPABASE_URL and SUPABASE_ANON_KEY");
  }
}

export function setup() {
  requireReadOnlySupabaseEnv();
}

export default function searchLoad() {
  const query = queries[__ITER % queries.length];
  const response = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/search_dishes`,
    JSON.stringify({
      p_query: query,
      p_radius_meters: null,
      p_dietary_flags: [],
      p_limit: 20,
      p_cursor_score: null,
      p_cursor_id: null,
      p_venue_id: null,
      p_area_name: null,
      p_cuisine_tags: null,
      p_max_price: null,
      p_open_only: false,
    }),
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      tags: { surface: "search", query },
    },
  );

  check(response, {
    "search status is 2xx": (res) => res.status >= 200 && res.status < 300,
  });
  sleep(1);
}
