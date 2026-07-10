import http from "k6/http";
import { check, fail, sleep } from "k6";

const SUPABASE_URL = (__ENV.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";
const LOAD_AUTH_TOKEN = __ENV.LOAD_AUTH_TOKEN || "";
const LOAD_ALLOW_MUTATIONS = __ENV.LOAD_ALLOW_MUTATIONS === "1";
const LOAD_STAGING_ONLY = __ENV.LOAD_STAGING_ONLY === "1";
const LOAD_TEST_DISH_ID = __ENV.LOAD_TEST_DISH_ID || "";

export const options = {
  vus: Number(__ENV.LOAD_VUS || 1),
  duration: __ENV.LOAD_DURATION || "30s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
};

function requireMutationSafetyEnv() {
  if (!LOAD_ALLOW_MUTATIONS || !LOAD_STAGING_ONLY) {
    fail("post publish load test is mutating and requires LOAD_ALLOW_MUTATIONS=1 and LOAD_STAGING_ONLY=1");
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !LOAD_AUTH_TOKEN || !LOAD_TEST_DISH_ID) {
    fail(
      "post publish load test requires staging SUPABASE_URL, SUPABASE_ANON_KEY, LOAD_AUTH_TOKEN, and LOAD_TEST_DISH_ID",
    );
  }
}

export function setup() {
  requireMutationSafetyEnv();
}

export default function postPublishLoad() {
  const body = {
    dish_id: LOAD_TEST_DISH_ID,
    caption: `k6 staging post ${Date.now()}-${__VU}-${__ITER}`,
    visibility: "public",
  };
  const response = http.post(`${SUPABASE_URL}/rest/v1/posts`, JSON.stringify(body), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${LOAD_AUTH_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    tags: { surface: "post-publish", mutation: "true" },
  });

  check(response, {
    "post publish accepted": (res) => res.status === 201 || res.status === 204,
  });
  sleep(1);
}
