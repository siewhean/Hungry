#!/usr/bin/env node
// Runs `npm audit` and fails on moderate+ advisories, except the allowlisted
// ones below. Only add advisories that have no patched release reachable from
// our dependency tree, and remove them once a fix ships. An entry with an
// `expires` date (YYYY-MM-DD) stops being allowlisted after that day.
import { execFileSync } from "node:child_process";

const ALLOWLIST = {
  // image-size: fixed only in 2.0.3, but React Native and Metro require the 0.6/1.x lines.
  "GHSA-5p2g-fcmc-qvqq": "image-size",
  "GHSA-w3rx-r6r6-pgpr": "image-size",
  // zod <4.6.6: fixed only in zod 4; eslint-plugin-react-hooks and @expo/cli require zod 3.
  // Build and lint tooling only; it is not in the app bundle and never validates user input.
  "GHSA-mrhx-c7xc-m3w5": "zod",
  // glob >=9 <=14.0.1: AbortSignal bypass. expo-updates and @expo/* pin glob 13 (SDK 58 too) and no
  // caller passes a `signal`; build tooling only, not in the app bundle or Edge Functions.
  "GHSA-3g3m-2fjr-6pw4": { name: "glob", expires: "2026-12-31" },
  // minimatch <11.0.1: globparts amplification. No patched release in the 3/5/9/10 lines that eslint,
  // exceljs and Expo tooling use; patterns there come from repo config, not untrusted input.
  "GHSA-g3hv-75wg-m249": { name: "minimatch", expires: "2026-12-31" },
};
const today = new Date().toISOString().slice(0, 10);
const entryName = (entry) => (typeof entry === "string" ? entry : entry.name);
const isActive = (entry) => typeof entry === "string" || today <= entry.expires;
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
  (ALLOWLIST[id] && isActive(ALLOWLIST[id]) ? allowed : blocking).push({ id, ...advisory });
}

for (const advisory of allowed) {
  console.log(
    `allowlisted ${advisory.severity} ${advisory.name} ${advisory.id}: ${advisory.title}`,
  );
}
for (const id of Object.keys(ALLOWLIST)) {
  if (!advisories.has(id)) {
    console.log(`note: ${id} (${entryName(ALLOWLIST[id])}) no longer reported; remove it from the allowlist`);
  }
}

if (blocking.length > 0) {
  for (const advisory of blocking) {
    console.error(
      `${advisory.severity} ${advisory.name} ${advisory.id}: ${advisory.title} (${advisory.url})`,
    );
  }
  for (const advisory of blocking) {
    if (ALLOWLIST[advisory.id]) {
      console.error(`allowlist entry ${advisory.id} expired on ${ALLOWLIST[advisory.id].expires}`);
    }
  }
  console.error(`\n${blocking.length} moderate+ advisories are not allowlisted.`);
  process.exit(1);
}

console.log(`npm audit gate passed (${allowed.length} allowlisted advisories).`);
