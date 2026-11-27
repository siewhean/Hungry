import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyStallFolderIngest,
  classifyStallFolderEntries,
  planStallFolderIngest,
  prepareResizedVariants,
} from "../field-kit/ingest-stall-folder.mjs";

function fakeResizer(src, dest, maxEdge) {
  const content = fs.readFileSync(src);
  fs.writeFileSync(dest, Buffer.concat([Buffer.from(`resized:${maxEdge}:`), content]));
}

test("classifyStallFolderEntries buckets front, menu, hours, halal, and dish files deterministically", () => {
  const classified = classifyStallFolderEntries([
    ".DS_Store",
    "menu-02.JPG",
    "menu-01.jpg",
    "front.jpeg",
    "hours.txt",
    "hours-board.png",
    "halal-cert.webp",
    "dish-01-laksa.jpg",
    "notes.md",
  ]);
  assert.deepEqual(classified, {
    front: ["front.jpeg"],
    menus: ["menu-01.jpg", "menu-02.JPG"],
    hoursPhotos: ["hours-board.png"],
    hoursTextFile: "hours.txt",
    halalCerts: ["halal-cert.webp"],
    dishes: ["dish-01-laksa.jpg"],
    ignored: ["notes.md"],
  });
});

test("planStallFolderIngest builds 1600w + 480w variants, parses clear 7-day hours, skips ambiguous hours, and fails closed on invalid images", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "field-kit-test-"));
  const stallDir = path.join(root, "stall-munchi-jw");
  fs.mkdirSync(stallDir);
  try {
    fs.writeFileSync(path.join(stallDir, "front.jpg"), "fake-jpeg");
    fs.writeFileSync(path.join(stallDir, "menu-01.jpg"), "fake-menu");
    fs.writeFileSync(path.join(stallDir, "hours.txt"), "Mon-Sun: 8:00 AM - 8:30 PM\n");

    const plan = planStallFolderIngest(stallDir, {
      resizer: fakeResizer,
      consoleBaseUrl: "https://usehungry.com",
    });
    assert.equal(plan.venueId, "stall-munchi-jw");
    assert.equal(plan.hoursStatus, "parsed");
    assert.ok(plan.openingSchedule);
    assert.equal(plan.preparedImages.length, 2);
    assert.ok(plan.preparedImages.every((img) => img.mainBytes > 0 && img.thumbBytes > 0));
    assert.equal(
      plan.consoleReviewUrl,
      "https://usehungry.com/console/stall-submissions?q=stall-munchi-jw",
    );

    // Ambiguous hours must never be guessed.
    fs.writeFileSync(path.join(stallDir, "hours.txt"), "12-11 am, closed sometimes\n");
    const unclearPlan = planStallFolderIngest(stallDir, { resizer: fakeResizer });
    assert.equal(unclearPlan.hoursStatus, "unclear_skipped");
    assert.equal(unclearPlan.openingSchedule, null);

    // Invalid/corrupt image without custom resizer must fail closed instead of copying raw bytes.
    assert.throws(() => {
      prepareResizedVariants(path.join(stallDir, "front.jpg"), stallDir, "bad-img");
    }, /conversion.*failed/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("applyStallFolderIngest uploads 1600w + 480w menu images, invokes submit_menu_photo + ingest-menu-photo, and sets null opening_schedule", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "field-kit-apply-test-"));
  const stallDir = path.join(root, "ven-jw-01");
  fs.mkdirSync(stallDir);
  fs.writeFileSync(path.join(stallDir, "menu-01.jpg"), "menu-bytes");
  fs.writeFileSync(path.join(stallDir, "hours.txt"), "Mon-Sun: 9:00 AM - 5:00 PM\n");

  const calls = [];
  const fakeFetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? "GET" });
    if (String(url).endsWith("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "ops-user-uuid" }), { status: 200 });
    }
    if (String(url).includes("/storage/v1/object/menu-photos/")) {
      return new Response(JSON.stringify({ Key: "ok" }), { status: 200 });
    }
    if (String(url).endsWith("/rest/v1/rpc/submit_menu_photo")) {
      return new Response(JSON.stringify("sub-uuid-1"), { status: 200 });
    }
    if (String(url).endsWith("/functions/v1/ingest-menu-photo")) {
      return new Response(JSON.stringify({ ok: true, submissionId: "sub-uuid-1", extracted: 6 }), {
        status: 200,
      });
    }
    if (String(url).includes("/rest/v1/venues?")) {
      return new Response(JSON.stringify([{ id: "ven-jw-01" }]), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const result = await applyStallFolderIngest(stallDir, {
      fetchImpl: fakeFetch,
      resizer: fakeResizer,
      supabaseUrl: "https://staging.supabase.co",
      anonKey: "anon",
      serviceRoleKey: "service-role",
      operatorToken: "ops-jwt",
    });

    assert.equal(result.venueId, "ven-jw-01");
    assert.equal(result.submissions.length, 1);
    assert.equal(result.submissions[0].extracted, 6);
    assert.equal(result.scheduleApplied, true);
    assert.equal(
      calls.filter((c) => c.url.includes("/storage/v1/object/menu-photos/")).length,
      2,
      "both 1600w main and 480w thumbnail must be uploaded",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
