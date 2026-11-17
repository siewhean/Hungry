import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const source = await fs.readFile(new URL("./auto-enrich-images.mjs", import.meta.url), "utf8");

test("offline workbook fallback uses maintained ExcelJS instead of vulnerable SheetJS", () => {
  assert.match(source, /require\("exceljs"\)/);
  assert.doesNotMatch(source, /require\("xlsx"\)/);
  assert.match(source, /await workbook\.xlsx\.readFile\(workbookPath\)/);
});
test("auto-enrichment uses the shared platform abstraction for all delivery adapters", () => {
  assert.match(source, /scrapeWithPlatformAdapter\(\{/);
  for (const platform of ["grabfood", "oddle", "foodpanda", "deliveroo"]) {
    assert.match(source, new RegExp(`scrapePlatform\\(page, "${platform}"`));
  }
  assert.doesNotMatch(source, /launchPersistentContext/);
});

test("direct platform resolution replaces web-search discovery", () => {
  const resolverStart = source.indexOf("async function resolvePlatformSourceUrl");
  const resolverEnd = source.indexOf("async function validateVenuePage", resolverStart);
  const resolverBody = source.slice(resolverStart, resolverEnd);
  assert.match(resolverBody, /resolveDirectPlatformUrl/);
  assert.doesNotMatch(source, /duckduckgo|searchForUrl/i);
  assert.match(source, /knownSourcesOnly: true/);
  assert.match(source, /--discover-sources/);
});

test("unverified delivery-platform sources cannot replace approved provenance", () => {
  assert.match(source, /source === "foodpanda" \|\| source === "deliveroo"\) return "unverified"/);
  assert.match(source, /const canApplyMenuFields = sourceRightsApproved \|\| !existingMenuIsApproved/);
  assert.match(source, /menu_approved_for_display: sourceHasApprovedRights\(item\.source\)/);
});

test("parallel workers retain serialized writes and checkpoint completion state", () => {
  assert.match(source, /runWorkerPool\(sortedVenues, workerCount/);
  assert.match(source, /scheduleWrite\(\(\) => runWithRetry/);
  assert.match(source, /mergeCheckpointProgress\(checkpointState/);
  assert.match(source, /currentVenueCompleted\(success\)/);
  assert.match(source, /await fs\.rename\(temporaryPath, runOptions\.checkpointPath\)/);
  assert.ok(source.indexOf("await loadCheckpoint();") < source.indexOf("venueGroups = await fetchMissingDishVenueGroups();"));
  assert.match(source, /checkpointState\.completedVenueIds\.size \+ Math\.max/);
});
