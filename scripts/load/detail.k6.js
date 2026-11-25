import { fail, sleep } from "k6";
import { LOAD_VUS, runCatalogRpc, verifyFixtureSessions } from "./catalog-rpc.js";

const DISH_ID = __ENV.LOAD_DISH_ID || "";
const VENUE_ID = __ENV.LOAD_VENUE_ID || "";
const EXPECT_MORE = __ENV.LOAD_VENUE_EXPECT_MORE === "1";

const thresholds = { checks: ["rate==1"] };

function addThresholds(tags, deadlineMs) {
  thresholds[`http_req_failed{${tags}}`] = ["rate<0.01"];
  thresholds[`http_req_duration{${tags},expected_response:true}`] = [`p(95)<=${deadlineMs}`];
  thresholds[`catalog_rpc_success_by_deadline{${tags}}`] = ["rate>=0.95"];
}

if (DISH_ID) addThresholds("route:get_dish_detail", 750);
if (VENUE_ID) {
  addThresholds("route:get_stall_header", 750);
  addThresholds("route:get_stall_menu_page,cohort:first", 1000);
  if (EXPECT_MORE) addThresholds("route:get_stall_menu_page,cohort:continuation", 1000);
}

export const options = { vus: LOAD_VUS, duration: __ENV.LOAD_DURATION || "1m", thresholds };

export function setup() {
  if (!DISH_ID && !VENUE_ID) fail("provide LOAD_DISH_ID or LOAD_VENUE_ID for a visible fixture");
  verifyFixtureSessions();
}

function matchesVenue(rows) {
  return rows.length === 1 && rows[0]?.venue_id === VENUE_ID && Boolean(rows[0].name);
}

function menuIds(rows) {
  const dishes = rows[0]?.dishes;
  return Array.isArray(dishes) ? dishes.map((dish) => dish?.dish_id) : [];
}

function isValidMenuPage(rows) {
  const ids = menuIds(rows);
  const cursor = rows[0]?.next_cursor;
  return (
    rows.length === 1 &&
    ids.length > 0 &&
    ids.length <= 20 &&
    ids.every((id) => typeof id === "string" && id) &&
    new Set(ids).size === ids.length &&
    (cursor === null || (typeof cursor === "string" && cursor))
  );
}

function loadStall() {
  const args = { p_venue_id: VENUE_ID };
  // Include the deployed v1 path as an installed-build control without charging every stall flow.
  if (__ITER % 5 === 0) {
    runCatalogRpc("get_venue_detail", args, "legacy", 1000, matchesVenue);
  }
  const header = runCatalogRpc("get_stall_header", args, "header", 750, matchesVenue);
  if (!header) return;
  const first = runCatalogRpc(
    "get_stall_menu_page",
    { ...args, p_cursor: null, p_limit: 20 },
    "first",
    1000,
    (rows) => isValidMenuPage(rows) && (!EXPECT_MORE || Boolean(rows[0].next_cursor)),
  );
  const cursor = first?.[0].next_cursor;
  if (cursor) {
    const firstIds = new Set(menuIds(first));
    runCatalogRpc(
      "get_stall_menu_page",
      { ...args, p_cursor: cursor, p_limit: 20 },
      "continuation",
      1000,
      (rows) =>
        isValidMenuPage(rows) &&
        rows[0].next_cursor !== cursor &&
        menuIds(rows).every((id) => !firstIds.has(id)),
    );
  }
}

export default function detailLoad() {
  if (DISH_ID && (!VENUE_ID || __ITER % 2 === 0)) {
    runCatalogRpc(
      "get_dish_detail",
      { p_dish_id: DISH_ID },
      "dish",
      750,
      (rows) => rows.length === 1 && rows[0]?.dish_id === DISH_ID && Boolean(rows[0].name),
    );
  } else {
    loadStall();
  }
  sleep(2);
}
