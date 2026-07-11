import http from "k6/http";
import { check, fail, sleep } from "k6";

const SUPABASE_URL = (__ENV.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";
const DISH_ID = __ENV.LOAD_DISH_ID || "";
const VENUE_ID = __ENV.LOAD_VENUE_ID || "";

export const options = {
  vus: Number(__ENV.LOAD_VUS || 5),
  duration: __ENV.LOAD_DURATION || "1m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

function requireReadOnlyDetailEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || (!DISH_ID && !VENUE_ID)) {
    fail("detail load test requires staging SUPABASE_URL, SUPABASE_ANON_KEY, and LOAD_DISH_ID or LOAD_VENUE_ID");
  }
}

export function setup() {
  requireReadOnlyDetailEnv();
}

export default function detailLoad() {
  const path =
    __ITER % 2 === 0 && DISH_ID
      ? `/rest/v1/dishes?id=eq.${encodeURIComponent(DISH_ID)}&select=*`
      : `/rest/v1/venues?id=eq.${encodeURIComponent(VENUE_ID || DISH_ID)}&select=*`;
  const response = http.get(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    tags: { surface: "detail" },
  });

  check(response, {
    "detail status is 2xx": (res) => res.status >= 200 && res.status < 300,
  });
  sleep(1);
}
