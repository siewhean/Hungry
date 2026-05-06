import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("profile home contract: quick access lives behind the header menu", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  assert.match(source, /headerRight=\{/);
  assert.match(source, /<Menu color=\{palette\.text\} size=\{22\}/);
  assert.match(
    source,
    /accessibilityLabel=\{menuOpen \? "Close quick access" : "Open quick access"\}/,
  );
  assert.doesNotMatch(source, /Your established list-based profile/);
  assert.doesNotMatch(source, /label="Saved Content"/);
});

test("profile home contract: profile stats use dynamic profile and social store values", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const domainSource = read("src/types/domain.ts");

  assert.match(domainSource, /followersCount: number/);
  assert.match(domainSource, /followingCount: number/);
  assert.match(
    source,
    /const followedAuthors = useSocialStore\(\(state\) => state\.followedAuthors\)/,
  );
  assert.match(source, /followers: profile\.stats\.followersCount/);
  assert.match(source, /following: profile\.stats\.followingCount \+ followedCount/);
  assert.match(source, /profile\.stats\.dishesReviewed === 0/);
  assert.match(source, /profile\.stats\.dishesReviewed === 1/);
  assert.match(source, /Updated based on \$\{profile\.stats\.dishesReviewed\} reviews/);
  assert.match(source, /label="Followers"/);
  assert.match(source, /label="Following"/);
  assert.match(source, /label="Reviews"[\s\S]*<PencilLine size=\{14\}/);
  assert.match(source, /label="Saved"[\s\S]*<Bookmark size=\{14\}/);
  assert.match(source, /<AppText variant="h1" style=\{\{ color: palette\.orange \}\}>/);
  assert.match(source, /<AppText variant="h1" style=\{\{ color: palette\.text \}\}>/);
  assert.match(source, /<AppText variant="bodyBold">Detailed Analysis<\/AppText>/);
  assert.match(
    source,
    /<AppText variant="h3" style=\{\{ color: palette\.text \}\}>\s*\{value\}\s*<\/AppText>/,
  );
  assert.match(source, /const headerActionSize = spacing\[8\] \+ spacing\[2\.5\]/);
  assert.match(source, /height: headerActionSize/);
  assert.match(source, /width: headerActionSize/);
  assert.match(source, /top: spacing\[8\] \+ spacing\[0\.5\]/);
  assert.match(source, /height: spacing\[20\]/);
  assert.match(source, /width: spacing\[20\]/);
  assert.doesNotMatch(source, /fontSize: 24/);
  assert.doesNotMatch(source, /fontSize: 18/);
  assert.doesNotMatch(source, /top: 34/);
  assert.doesNotMatch(source, /height: 80/);
  assert.doesNotMatch(source, /last 5 reviews/);
});
