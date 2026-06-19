import http from "k6/http";
import { check, fail, sleep } from "k6";

const BASE_URL = (__ENV.LOAD_BASE_URL || "").replace(/\/$/, "");
const LOAD_AUTH_TOKEN = __ENV.LOAD_AUTH_TOKEN || "";
const LOAD_ALLOW_MUTATIONS = __ENV.LOAD_ALLOW_MUTATIONS === "1";
const LOAD_STAGING_ONLY = __ENV.LOAD_STAGING_ONLY === "1";

export const options = {
  vus: Number(__ENV.LOAD_VUS || 2),
  duration: __ENV.LOAD_DURATION || "1m",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
};

function requireAdminStagingEnv() {
  if (!LOAD_ALLOW_MUTATIONS || !LOAD_STAGING_ONLY) {
    fail("admin dashboard load test requires LOAD_ALLOW_MUTATIONS=1 and LOAD_STAGING_ONLY=1 against staging");
  }
  if (!BASE_URL || !LOAD_AUTH_TOKEN) {
    fail("admin dashboard load test requires staging LOAD_BASE_URL and LOAD_AUTH_TOKEN");
  }
}

export function setup() {
  requireAdminStagingEnv();
}

export default function adminDashboardLoad() {
  const response = http.get(`${BASE_URL}/api/console/merchant-applications`, {
    headers: {
      Authorization: `Bearer ${LOAD_AUTH_TOKEN}`,
    },
    tags: { surface: "admin-dashboard" },
  });

  check(response, {
    "admin dashboard auth checked": (res) => res.status === 200 || res.status === 401 || res.status === 403,
  });
  sleep(1);
}
