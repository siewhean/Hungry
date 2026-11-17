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

function requireReadOnlySupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail("discovery load test requires staging SUPABASE_URL and SUPABASE_ANON_KEY");
  }
}

export function setup() {
  requireReadOnlySupabaseEnv();
}

export default function discoveryLoad() {
  const response = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_discovery_feed_by_location`,
    JSON.stringify({
      p_area_name: "Chinatown",
      p_radius_meters: 3000,
      p_limit: 30,
    }),
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      tags: { surface: "discovery", area: "Chinatown" },
    },
  );

  check(response, {
    "discovery status is 2xx": (res) => res.status >= 200 && res.status < 300,
  });
  sleep(1);
}
