import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("StallLogoMark retries logo candidates and falls back to text identity", () => {
  const source = readRepoFile("src/components/stall/StallLogoMark.tsx");

  assert.match(source, /getVenueLogoCandidates\(logoUrl\)/);
  assert.match(
    source,
    /const \[failedUrls, setFailedUrls\] = useState<readonly string\[\]>\(\[\]\)/,
  );
  assert.match(source, /const activeLogoUrl = candidates\.find/);
  assert.match(source, /onError=\{\(\) =>/);
  assert.match(source, /setFailedUrls\(\(current\) =>/);
  assert.match(source, /getVenueLogoInitials\(name\)/);
  assert.match(
    source,
    /accessibilityLabel=\{!activeLogoUrl \? `\$\{name\} stall logo unavailable` : undefined\}/,
  );
  assert.doesNotMatch(source, /Utensils/);
  assert.doesNotMatch(source, /representative_dish|topDish|imageUrl/);

  // The logo fills the ring (cover, no inner padding) and the circle has no backdrop behind it.
  assert.match(source, /contentFit="cover"/);
  assert.match(source, /const imageSize = Math\.max\(1, size - borderWidth \* 2\)/);
  assert.match(source, /backgroundColor: activeLogoUrl \? "transparent" : palette\.surfaceRaised/);
  assert.doesNotMatch(source, /contentFit="contain"/);
});
