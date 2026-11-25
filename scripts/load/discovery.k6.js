import { fail, sleep } from "k6";
import { LOAD_VUS, runCatalogRpc, verifyFixtureSessions } from "./catalog-rpc.js";

const ROUTE = "get_discovery_feed_by_location";

export const options = {
  vus: LOAD_VUS,
  duration: __ENV.LOAD_DURATION || "1m",
  thresholds: {
    "http_req_failed{route:get_discovery_feed_by_location}": ["rate<0.001"],
    "http_req_duration{route:get_discovery_feed_by_location,cohort:first,expected_response:true}": [
      "p(95)<=350",
    ],
    "http_req_duration{route:get_discovery_feed_by_location,cohort:full,expected_response:true}": [
      "p(95)<=500",
    ],
    "catalog_rpc_success_by_deadline{route:get_discovery_feed_by_location,cohort:first}": [
      "rate>=0.95",
    ],
    "catalog_rpc_success_by_deadline{route:get_discovery_feed_by_location,cohort:full}": [
      "rate>=0.95",
    ],
    checks: ["rate==1"],
  },
};

function fixtureRequest(fixture, limit) {
  return {
    p_area_name: fixture.area ?? null,
    p_lat: fixture.lat ?? null,
    p_lng: fixture.lng ?? null,
    p_radius_meters: fixture.radius ?? null,
    p_building_id: fixture.buildingId ?? null,
    p_limit: limit,
  };
}

function checkFixture(rows, fixture) {
  if (fixture.expectEmpty === true) return rows.length === 0;
  return rows.some(
    (row) =>
      row?.top_dish_id === fixture.dishId &&
      typeof row.top_dish_name === "string" &&
      row.top_dish_name.trim() &&
      Number(row.top_dish_price) > 0 &&
      row.venue_id === fixture.venueId,
  );
}

export function setup() {
  let fixtures;
  try {
    fixtures = JSON.parse(__ENV.LOAD_DISCOVERY_FIXTURES || "[]");
  } catch {
    fail("LOAD_DISCOVERY_FIXTURES must be a JSON array");
  }
  if (
    !Array.isArray(fixtures) ||
    fixtures.length === 0 ||
    !fixtures.some((fixture) => fixture && fixture.expectEmpty !== true) ||
    !fixtures.every(
      (fixture) =>
        fixture &&
        (!fixture.name || /^[a-z0-9_-]{1,32}$/.test(fixture.name)) &&
        (fixture.expectEmpty === true ||
          (typeof fixture.dishId === "string" &&
            fixture.dishId &&
            typeof fixture.venueId === "string" &&
            fixture.venueId)),
    )
  ) {
    fail(
      "LOAD_DISCOVERY_FIXTURES requires positive dish/venue fixtures and explicit empty expectations",
    );
  }
  verifyFixtureSessions();
  return fixtures;
}

export default function discoveryLoad(fixtures) {
  const fixture = fixtures[(__ITER + __VU - 1) % fixtures.length];
  const first = runCatalogRpc(
    ROUTE,
    fixtureRequest(fixture, 10),
    "first",
    350,
    (rows) => rows.length <= 10 && checkFixture(rows, fixture),
    fixture.name,
  );
  if (first) {
    runCatalogRpc(
      ROUTE,
      fixtureRequest(fixture, 100),
      "full",
      500,
      (rows) => rows.length <= 100 && checkFixture(rows, fixture),
      fixture.name,
    );
  }
  sleep(2);
}
