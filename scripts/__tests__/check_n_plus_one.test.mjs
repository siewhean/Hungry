import assert from "node:assert/strict";
import test from "node:test";

import { findNPlusOne } from "../check-n-plus-one.mjs";

const lines = (source) => findNPlusOne(source).map((finding) => finding.text);

test("flags a query awaited inside a for...of loop", () => {
  const found = lines(`
    for (const id of ids) {
      const { data } = await client.from("dishes").select("*").eq("id", id);
    }
  `);
  assert.equal(found.length, 1);
});

test("flags a service call inside an array callback", () => {
  const found = lines(`
    await Promise.all(ids.map((id) => getHungryService().discovery.getDish(id)));
  `);
  assert.equal(found.length, 1);
});

test("flags rpc and storage signing inside forEach and while", () => {
  assert.equal(
    lines(`rows.forEach(async (row) => { await client.rpc("x", { id: row.id }); });`).length,
    1,
  );
  assert.equal(
    lines(`while (more) { const u = await createSignedStorageUrl(client, b, p); }`).length,
    1,
  );
});

test("does not flag one batched query or a lookup from a Map", () => {
  const found = lines(`
    const { data } = await client.from("dishes").select("*").in("id", ids);
    const byId = new Map(data.map((row) => [row.id, row]));
    for (const id of ids) {
      use(byId.get(id));
    }
  `);
  assert.deepEqual(found, []);
});

test("ignores Array.from and Buffer.from inside loops", () => {
  const found = lines(`
    for (const row of rows) {
      const copy = Array.from(row.items);
      const bytes = Buffer.from(row.text);
    }
  `);
  assert.deepEqual(found, []);
});

test("ignores calls named only in strings and comments", () => {
  const found = lines(`
    for (const row of rows) {
      // client.from("dishes") would be an N+1 here
      log("client.rpc(x)");
    }
  `);
  assert.deepEqual(found, []);
});

test("an n-plus-one-ok marker on or above the call, or on an enclosing loop, allows it", () => {
  assert.deepEqual(
    lines(`
    for (const file of files) {
      // n-plus-one-ok: each file is its own upload
      await client.storage.from("b").upload(file.path, file.body);
    }`),
    [],
  );
  assert.deepEqual(
    lines(`
    // n-plus-one-ok: pages depend on the previous cursor
    for (;;) {
      for (const x of y) {
        await client.rpc("page", { cursor });
      }
    }`),
    [],
  );
});

test("a call after the loop is not flagged", () => {
  assert.deepEqual(
    lines(`
    for (const id of ids) { total += id; }
    await client.rpc("save", { total });
  `),
    [],
  );
});
