import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";

const root = process.cwd();
const manifestPath = resolve(root, "supabase/publish/catalog_raw_release.manifest.json");
const sqlTemplatePath = resolve(root, "supabase/publish/catalog_raw_release.sql");

function fail(message) {
  process.stderr.write(`Catalog release was not started: ${message}\n`);
  process.exit(1);
}

function readManifest() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    fail("the checked-in source manifest is unreadable");
  }

  const version =
    typeof manifest.manifestVersion === "string" ? manifest.manifestVersion.trim() : "";
  const sourceKind = typeof manifest.sourceKind === "string" ? manifest.sourceKind.trim() : "";
  const sourceWorkbook =
    typeof manifest.sourceWorkbook === "string" ? manifest.sourceWorkbook.trim() : "";
  const checksum =
    typeof manifest.sourceChecksumSha256 === "string"
      ? manifest.sourceChecksumSha256.trim().toLowerCase()
      : "";
  const expectedVenueTotal = manifest.expectedVenueTotal;
  const expectedDishTotal = manifest.expectedDishTotal;

  if (!version || !sourceKind || !sourceWorkbook || !/^[0-9a-f]{64}$/.test(checksum)) {
    fail("the source manifest has missing or invalid identity fields");
  }
  if (
    !Number.isSafeInteger(expectedVenueTotal) ||
    expectedVenueTotal < 0 ||
    !Number.isSafeInteger(expectedDishTotal) ||
    expectedDishTotal < 0
  ) {
    fail("the source manifest has invalid expected totals");
  }

  const sourcePath = resolve(root, sourceWorkbook);
  if (!sourcePath.startsWith(`${root}/`) || relative(root, sourcePath).startsWith("..")) {
    fail("the source workbook must stay inside the repository");
  }

  let observedChecksum;
  try {
    observedChecksum = createHash("sha256").update(readFileSync(sourcePath)).digest("hex");
  } catch {
    fail("the versioned source workbook is unavailable");
  }
  if (observedChecksum !== checksum) {
    fail("the source workbook checksum does not match the versioned manifest");
  }

  return { version, sourceKind, checksum, expectedVenueTotal, expectedDishTotal };
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function renderSql(manifest) {
  const template = readFileSync(sqlTemplatePath, "utf8");
  const rendered = template
    .replaceAll(":'manifest_version'", sqlLiteral(manifest.version))
    .replaceAll(":'source_kind'", sqlLiteral(manifest.sourceKind))
    .replaceAll(":'source_checksum'", sqlLiteral(manifest.checksum))
    .replaceAll(":expected_venue_total", String(manifest.expectedVenueTotal))
    .replaceAll(":expected_dish_total", String(manifest.expectedDishTotal));

  if (rendered.includes(":'manifest_") || rendered.includes(":expected_")) {
    fail("the publish SQL template contains an unresolved source-manifest value");
  }
  return rendered;
}

// Self-hosted Supabase: target the database explicitly instead of a CLI-linked cloud project.
const dbUrl = process.env.SUPABASE_DB_URL?.trim();
if (!dbUrl) {
  fail("SUPABASE_DB_URL is required (Postgres connection string for the target Supabase database)");
}

const manifest = readManifest();
const tempDirectory = mkdtempSync(resolve(tmpdir(), "hungry-catalog-publish-"));
const renderedSqlPath = resolve(tempDirectory, "catalog_raw_release.sql");

try {
  writeFileSync(renderedSqlPath, renderSql(manifest), "utf8");
  const output = execFileSync(
    "npx",
    [
      "--no-install",
      "supabase",
      "db",
      "query",
      "--db-url",
      dbUrl,
      "--file",
      renderedSqlPath,
      "--output",
      "json",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );

  process.stdout.write(output);

  const result = JSON.parse(output);
  const release = result.rows?.[0];
  if (
    release?.status !== "active" ||
    (Array.isArray(release?.quality_findings) && release.quality_findings.length)
  ) {
    process.stderr.write(
      `Catalog release was not activated; investigate the compact quality findings: ${JSON.stringify(release?.quality_findings ?? [])}\n`,
    );
    process.exitCode = 1;
  }
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
