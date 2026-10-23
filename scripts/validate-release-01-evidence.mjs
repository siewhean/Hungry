#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const evidencePath = process.argv[2];
if (!evidencePath) {
  console.error(
    "Usage: node scripts/validate-release-01-evidence.mjs <release-evidence.json>",
  );
  process.exit(2);
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(resolve(process.cwd(), evidencePath), "utf8"));
} catch (error) {
  console.error(`[release-0.1-evidence] could not read valid JSON: ${error.message}`);
  process.exit(2);
}

const failures = [];
const shaPattern = /^[0-9a-f]{40}$/i;
const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;

function requireString(path, value) {
  if (!nonEmpty(value)) failures.push(`${path} must be a non-empty string`);
}

function requireSha(path, value) {
  if (!shaPattern.test(String(value ?? ""))) failures.push(`${path} must be a 40-character SHA`);
}

function requireTrue(path, value) {
  if (value !== true) failures.push(`${path} must be true`);
}

function requireNumberAtLeast(path, value, minimum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    failures.push(`${path} must be a number >= ${minimum}`);
  }
}

requireSha("identity.implementationSha", evidence.identity?.implementationSha);
requireSha("identity.evidenceSha", evidence.identity?.evidenceSha);
requireString("identity.iosBuildId", evidence.identity?.iosBuildId);
requireString("identity.androidBuildId", evidence.identity?.androidBuildId);
requireString("identity.catalogReleaseId", evidence.identity?.catalogReleaseId);
requireString("identity.supabaseMigrationHead", evidence.identity?.supabaseMigrationHead);
requireString("identity.ciUrl", evidence.identity?.ciUrl);
requireString("identity.securityUrl", evidence.identity?.securityUrl);
requireString("identity.releaseOwner", evidence.identity?.releaseOwner);
requireString("identity.releaseCandidateTag", evidence.identity?.releaseCandidateTag);

const requiredGates = [
  "cleanWorktree",
  "localChecks",
  "ci",
  "security",
  "mergeCompatibility",
  "supabaseCapacity",
  "migrationReconciled",
  "supabaseAdvisor",
  "supabaseRls",
  "catalogPilot",
  "catalogPaging",
  "catalogImages",
  "stagingFallback",
  "stagingNoResults",
  "iosArtifactInstalled",
  "androidArtifactInstalled",
  "iosQa",
  "androidQa",
  "accessibility",
  "privacyAndDeletion",
  "monitoringAndSourceMaps",
  "rollbackRehearsed",
  "betaExit",
  "noOpenP0",
  "noUnownedP1",
  "storeMetadataReviewed",
];

for (const gate of requiredGates) requireTrue(`gates.${gate}`, evidence.gates?.[gate]);

requireNumberAtLeast("metrics.startupSuccessPercent", evidence.metrics?.startupSuccessPercent, 98);
requireNumberAtLeast("metrics.crashFreeSessionsPercent", evidence.metrics?.crashFreeSessionsPercent, 99.5);
requireNumberAtLeast(
  "metrics.primaryJourneyCompletionPercent",
  evidence.metrics?.primaryJourneyCompletionPercent,
  85,
);
requireNumberAtLeast("metrics.exactPilotPassPercent", evidence.metrics?.exactPilotPassPercent, 100);
requireNumberAtLeast(
  "metrics.initialDiscoverApprovedImagePercent",
  evidence.metrics?.initialDiscoverApprovedImagePercent,
  100,
);
requireNumberAtLeast("metrics.completedTesterJourneys", evidence.metrics?.completedTesterJourneys, 15);

for (const key of ["nativeBuild", "easUpdate", "catalogRelease", "featureFlags"]) {
  requireString(`rollback.${key}`, evidence.rollback?.[key]);
}

if (!Array.isArray(evidence.knownLimitations)) {
  failures.push("knownLimitations must be an array");
}

if (!Array.isArray(evidence.acceptedRisks)) {
  failures.push("acceptedRisks must be an array");
} else {
  evidence.acceptedRisks.forEach((risk, index) => {
    if (risk?.severity === "P0") failures.push(`acceptedRisks[${index}] may not be P0`);
    requireString(`acceptedRisks[${index}].owner`, risk?.owner);
    requireString(`acceptedRisks[${index}].rationale`, risk?.rationale);
    requireString(`acceptedRisks[${index}].expiresAt`, risk?.expiresAt);
  });
}

if (failures.length > 0) {
  console.error("[release-0.1-evidence] NO-GO. Evidence is incomplete or below threshold:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `[release-0.1-evidence] GO CANDIDATE: ${evidence.identity.releaseCandidateTag} at ${evidence.identity.implementationSha}`,
);
