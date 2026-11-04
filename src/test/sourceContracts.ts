import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

export function readRepoFile(pathFromRepoRoot: string): string {
  return readFileSync(path.join(repoRoot, pathFromRepoRoot), "utf8");
}

/**
 * The Home screen and the files it was split into (section components, hooks, showcase helpers),
 * read as one source so a contract about Home does not care which file a piece lives in.
 */
export function readHomeSource(): string {
  const sectionDir = "src/components/discover/home";
  return [
    "src/app/screens/discover/DiscoverHomeScreen.tsx",
    ...readdirSync(path.join(repoRoot, sectionDir)).map((name) => `${sectionDir}/${name}`),
    "src/features/discover/popularFoodStyles.ts",
    "src/features/discover/stallShowcase.ts",
    "src/features/discover/useDiscoverFeed.ts",
    "src/features/discover/useDiscoverFilters.ts",
  ]
    .map(readRepoFile)
    .join("\n");
}

export function assertRepoFileExists(pathFromRepoRoot: string): void {
  assert.equal(existsSync(path.join(repoRoot, pathFromRepoRoot)), true, pathFromRepoRoot);
}

export function assertSourceIncludes(
  source: string,
  patterns: readonly RegExp[],
  context: string,
): void {
  for (const pattern of patterns) {
    assert.match(source, pattern, `${context} should include ${pattern}`);
  }
}

export function assertSourceExcludes(
  source: string,
  patterns: readonly RegExp[],
  context: string,
): void {
  for (const pattern of patterns) {
    assert.doesNotMatch(source, pattern, `${context} should not include ${pattern}`);
  }
}

export function segmentBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Expected to find segment start: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Expected to find segment end: ${end}`);
  return source.slice(startIndex, endIndex);
}
