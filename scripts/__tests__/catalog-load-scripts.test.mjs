import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function load(name, env, iteration, http) {
  const read = (file) => fs.readFileSync(new URL(`../load/${file}`, import.meta.url), "utf8");
  const source = (read("catalog-rpc.js") + "\n" + read(`${name}.k6.js`))
    .replace(/^import .*;\n/gm, "")
    .replace(/\bexport (?:default )?/g, "");
  const checks = [];
  const metrics = [];
  class Metric {
    constructor(name) {
      this.name = name;
    }

    add(value, tags) {
      metrics.push({ name: this.name, value, tags });
    }
  }
  const entryPoint = name === "detail" ? "detailLoad" : "discoveryLoad";
  const subject = vm.runInNewContext(`${source}\n({ setup, run: ${entryPoint} })`, {
    __ENV: env,
    __ITER: iteration,
    __VU: 1,
    http,
    Rate: Metric,
    Trend: Metric,
    fail: (message) => {
      throw new Error(message);
    },
    sleep() {},
    check(response, expectations) {
      const results = Object.values(expectations).map((predicate) => predicate(response));
      checks.push(...results);
      return results.every(Boolean);
    },
  });
  return { ...subject, checks, metrics };
}

const catalogOrigin = "https://uuylnktiipkmcweyqnpd.supabase.co";
const catalogEnv = {
  SUPABASE_URL: catalogOrigin,
  SUPABASE_ANON_KEY: "test-api-key",
  LOAD_AUTH_TOKEN: "fixture.signed.jwt",
};

function fixtureAuth(url, options) {
  assert.equal(url, `${catalogOrigin}/auth/v1/user`);
  assert.equal(options.redirects, 0);
  assert.equal(options.headers.Authorization, "Bearer fixture.signed.jwt");
  return { status: 200, json: () => ({ id: "fixture-user", role: "authenticated" }) };
}

function rpcResult(rows, duration = 10, status = 200) {
  return { status, json: () => rows, timings: { duration }, body: JSON.stringify(rows) };
}

test("dish-only detail load uses the authenticated detail RPC on alternate iterations too", () => {
  const urls = [];
  for (const iteration of [0, 1, 2]) {
    const subject = load("detail", { ...catalogEnv, LOAD_DISH_ID: "dish-a" }, iteration, {
      get: fixtureAuth,
      post(url, body, options) {
        urls.push(url);
        assert.deepEqual(JSON.parse(body), { p_dish_id: "dish-a" });
        assert.equal(options.redirects, 0);
        assert.equal(options.headers.Authorization, "Bearer fixture.signed.jwt");
        return rpcResult([{ dish_id: "dish-a", name: "Noodles" }]);
      },
    });
    subject.setup();
    subject.run();
    assert.deepEqual(subject.checks, [true, true]);
  }
  assert.deepEqual(urls, Array(3).fill(`${catalogOrigin}/rest/v1/rpc/get_dish_detail`));
});

test("stall load verifies the header and two disjoint menu pages", () => {
  const calls = [];
  const subject = load(
    "detail",
    {
      ...catalogEnv,
      LOAD_VENUE_ID: "stall-a",
      LOAD_VENUE_EXPECT_MORE: "1",
    },
    0,
    {
      get: fixtureAuth,
      post(url, body) {
        const route = url.split("/").at(-1);
        const args = JSON.parse(body);
        calls.push(route);
        assert.equal(args.p_venue_id, "stall-a");
        if (route !== "get_stall_menu_page")
          return rpcResult([{ venue_id: "stall-a", name: "Stall" }]);
        assert.equal(args.p_limit, 20);
        if (args.p_cursor === null) {
          return rpcResult([{ dishes: [{ dish_id: "a" }], next_cursor: "cursor-a" }]);
        }
        assert.equal(args.p_cursor, "cursor-a");
        return rpcResult([{ dishes: [{ dish_id: "a" }], next_cursor: null }]);
      },
    },
  );
  subject.setup();
  subject.run();
  assert.deepEqual(calls, [
    "get_venue_detail",
    "get_stall_header",
    "get_stall_menu_page",
    "get_stall_menu_page",
  ]);
  assert.equal(subject.checks.at(-1), false);
});

test("discovery tests both sizes, treats wrong content and slow responses as deadline failures", () => {
  const requests = [];
  const fixture = { area: "Chinatown", dishId: "dish-a", venueId: "venue-a" };
  const subject = load(
    "discovery",
    {
      ...catalogEnv,
      LOAD_DISCOVERY_FIXTURES: JSON.stringify([fixture]),
    },
    0,
    {
      get: fixtureAuth,
      post(url, body) {
        assert.equal(url, `${catalogOrigin}/rest/v1/rpc/get_discovery_feed_by_location`);
        const args = JSON.parse(body);
        requests.push(args);
        return args.p_limit === 10
          ? rpcResult(
              [
                {
                  venue_id: "venue-a",
                  top_dish_id: "dish-a",
                  top_dish_name: "Soup",
                  top_dish_price: 2,
                },
              ],
              351,
            )
          : rpcResult([]);
      },
    },
  );
  subject.run(subject.setup());
  assert.deepEqual(
    requests.map(({ p_limit }) => p_limit),
    [10, 100],
  );
  assert.deepEqual(subject.checks, [true, true, true, false]);
  assert.deepEqual(
    subject.metrics
      .filter(({ name }) => name === "catalog_rpc_success_by_deadline")
      .map(({ value }) => value),
    [false, false],
  );
});

test("catalog load refuses production, unapproved origins, and bare anonymous credentials", () => {
  for (const origin of [
    "https://frluxwpqqyomiqmjzavd.supabase.co",
    "https://other.staging.test",
    `${catalogOrigin}/any-path`,
    "http://127.0.0.1:54321",
  ]) {
    const subject = load(
      "detail",
      { ...catalogEnv, SUPABASE_URL: origin, LOAD_DISH_ID: "d" },
      0,
      {},
    );
    assert.throws(() => subject.setup(), /approved Hungry staging origin/);
  }
  assert.throws(
    () =>
      load(
        "detail",
        {
          ...catalogEnv,
          LOAD_AUTH_TOKEN: catalogEnv.SUPABASE_ANON_KEY,
          LOAD_DISH_ID: "d",
        },
        0,
        {},
      ).setup(),
    /authenticated fixture JWT/,
  );
});
