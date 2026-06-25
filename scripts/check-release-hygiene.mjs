#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const ignoredDirectories = new Set([".git", "node_modules"]);
const metadataFindings = [];

function isIgnoredDirectory(relativePath, name) {
  if (ignoredDirectories.has(name)) return true;
  if (relativePath === ".claude/worktrees") return true;
  if (relativePath.endsWith("/node_modules")) return true;
  return false;
}

function isMetadataFile(relativePath, name) {
  return (
    name === ".DS_Store" ||
    name.startsWith(".watchman-cookie-") ||
    relativePath.startsWith("supabase/.temp/")
  );
}

function walk(relativeDir = ".") {
  const absoluteDir = path.join(repoRoot, relativeDir);
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = relativeDir === "." ? entry.name : `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (isIgnoredDirectory(relativePath, entry.name)) continue;
      walk(relativePath);
      continue;
    }
    if (isMetadataFile(relativePath, entry.name)) {
      metadataFindings.push(relativePath);
    }
  }
}

walk();

if (metadataFindings.length > 0) {
  console.error("Release hygiene check failed. Remove local metadata files before release:");
  for (const finding of metadataFindings.slice(0, 200)) {
    console.error(`- ${finding}`);
  }
  if (metadataFindings.length > 200) {
    console.error(`...and ${metadataFindings.length - 200} more`);
  }
  process.exit(1);
}

console.log("Release hygiene check passed.");
