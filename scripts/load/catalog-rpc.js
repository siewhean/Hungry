import http from "k6/http";
import { check, fail } from "k6";
import { Rate, Trend } from "k6/metrics";

const STAGING_ORIGIN = "https://uuylnktiipkmcweyqnpd.supabase.co";
const ORIGIN = (__ENV.SUPABASE_URL || "").replace(/\/$/, "");
const API_KEY = __ENV.SUPABASE_ANON_KEY || "";
const tokens = (__ENV.LOAD_AUTH_TOKENS || __ENV.LOAD_AUTH_TOKEN || "")
  .split(",")
  .map((token) => token.trim())
  .filter(Boolean);

const rpcDeadline = new Rate("catalog_rpc_success_by_deadline");
const rpcResponseBytes = new Trend("catalog_rpc_response_bytes");

export const LOAD_VUS = Number(__ENV.LOAD_VUS || "1");

export function verifyFixtureSessions() {
  const local =
    __ENV.LOAD_ALLOW_ISOLATED_LOCALHOST === "1" &&
    /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(ORIGIN);
  if (ORIGIN !== STAGING_ORIGIN && !local) {
    fail(
      "catalog load tests require the approved Hungry staging origin or explicit local Supabase opt-in",
    );
  }
  if (!Number.isInteger(LOAD_VUS) || LOAD_VUS < 1 || LOAD_VUS > 20) {
    fail("catalog load tests support 1–20 virtual users");
  }
  if (
    !API_KEY ||
    tokens.length !== LOAD_VUS ||
    new Set(tokens).size !== tokens.length ||
    tokens.some((token) => token === API_KEY || token.split(".").length !== 3)
  ) {
    fail("provide a different authenticated fixture JWT per virtual user");
  }
  const users = new Set();
  for (const token of tokens) {
    const response = http.get(
      `${ORIGIN}/auth/v1/user`,
      requestOptions(token, { name: "fixture_auth" }),
    );
    let user;
    try {
      user = response.json();
    } catch {
      fail("fixture auth returned invalid JSON");
    }
    if (
      response.status !== 200 ||
      user?.role !== "authenticated" ||
      user.is_anonymous ||
      typeof user.id !== "string" ||
      users.has(user.id)
    ) {
      fail("fixture JWT must identify a distinct signed-in test account on the selected project");
    }
    users.add(user.id);
  }
}

function requestOptions(token, tags) {
  return {
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    redirects: 0,
    timeout: "20s",
    tags,
  };
}

function responseBytes(body) {
  let bytes = 0;
  for (const character of body || "") {
    const codePoint = character.codePointAt(0);
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export function runCatalogRpc(route, body, cohort, deadlineMs, isExpectedResult, scenario) {
  const tags = { name: route, route, cohort, ...(scenario ? { fixture_scope: scenario } : {}) };
  const response = http.post(
    `${ORIGIN}/rest/v1/rpc/${route}`,
    JSON.stringify(body),
    requestOptions(tokens[__VU - 1], tags),
  );
  let rows;
  if (response.status === 200) {
    try {
      rows = response.json();
    } catch {
      // Malformed responses are counted as failed fixtures.
    }
  }
  const expected = Array.isArray(rows) && isExpectedResult(rows);
  check(
    response,
    {
      "catalog RPC returned expected HTTP status": (res) => res.status === 200,
      "catalog RPC returned the intended fixture": () => expected,
    },
    tags,
  );
  rpcDeadline.add(expected && response.timings.duration <= deadlineMs, tags);
  rpcResponseBytes.add(responseBytes(response.body), tags);
  return expected ? rows : undefined;
}
