import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.LOAD_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

export const options = {
  vus: Number(__ENV.LOAD_VUS || 5),
  duration: __ENV.LOAD_DURATION || "1m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

const paths = [
  "/",
  "/for-foodies",
  "/for-merchants",
  "/singapore",
  "/dishes/chicken-rice",
];

export default function publicWebLoad() {
  const path = paths[__ITER % paths.length];
  const response = http.get(`${BASE_URL}${path}`, {
    tags: { surface: "public-web", path },
  });

  check(response, {
    "public web status is 2xx or 3xx": (res) => res.status >= 200 && res.status < 400,
  });
  sleep(1);
}
