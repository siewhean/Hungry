#!/usr/bin/env node
// Runs `npm audit` and fails on moderate+ advisories, except the allowlisted
// ones below. Only add advisories that have no patched release reachable from
// our dependency tree, and remove them once a fix ships.
import { execFileSync } from "node:child_process";

const ALLOWLIST = {
  // braces <=3.0.3: no patched release; pulled in by Metro and the RN CLI via micromatch.
  "GHSA-vfj7-8cjw-p6xm": "braces",
  // node-forge <=1.4.0: no patched release; pulled in by Expo code signing.
  "GHSA-86w9-cpqp-85rv": "node-forge",
  // image-size: fixed only in 2.0.3, but React Native and Metro require the 0.6/1.x lines.
  "GHSA-5p2g-fcmc-qvqq": "image-size",
  "GHSA-w3rx-r6r6-pgpr": "image-size",
};
const FAILING_SEVERITIES = new Set(["moderate", "high", "critical"]);

let raw;
try {
  raw = execFileSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  // npm audit exits non-zero when it finds vulnerabilities; the JSON is still on stdout.
  raw = error.stdout;
}

const report = JSON.parse(raw);
const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via === "object") {
      advisories.set(via.url.split("/").pop(), via);
    }
  }
}

const allowed = [];
const blocking = [];
for (const [id, advisory] of advisories) {
  if (!FAILING_SEVERITIES.has(advisory.severity)) continue;
  (ALLOWLIST[id] ? allowed : blocking).push({ id, ...advisory });
}

for (const advisory of allowed) {
  console.log(
    `allowlisted ${advisory.severity} ${advisory.name} ${advisory.id}: ${advisory.title}`,
  );
}
for (const id of Object.keys(ALLOWLIST)) {
  if (!advisories.has(id)) {
    console.log(`note: ${id} (${ALLOWLIST[id]}) no longer reported; remove it from the allowlist`);
  }
}

if (blocking.length > 0) {
  for (const advisory of blocking) {
    console.error(
      `${advisory.severity} ${advisory.name} ${advisory.id}: ${advisory.title} (${advisory.url})`,
    );
  }
  console.error(`\n${blocking.length} moderate+ advisories are not allowlisted.`);
  process.exit(1);
}

console.log(`npm audit gate passed (${allowed.length} allowlisted advisories).`);
