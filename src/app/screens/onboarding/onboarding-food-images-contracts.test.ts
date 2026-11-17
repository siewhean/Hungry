import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const registryPath = path.join(repoRoot, "src/app/screens/onboarding/onboardingFoodImages.ts");
const resultScreenPath = path.join(
  repoRoot,
  "src/app/screens/onboarding/TasteProfileResultScreen.tsx",
);
const tasteQuizPath = path.join(repoRoot, "src/lib/ai/tasteQuiz.ts");
const assetDir = path.join(repoRoot, "src/assets/onboarding/food");
const provenancePath = path.join(repoRoot, "tasks/release-evidence/asset-provenance.md");

function readPngSize(filePath: string): { width: number; height: number } {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", `${filePath} must be a PNG file`);

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("onboarding food visuals use generated local food assets", () => {
  const source = fs.readFileSync(registryPath, "utf8");
  const resultScreenSource = fs.readFileSync(resultScreenPath, "utf8");
  const tasteQuizSource = fs.readFileSync(tasteQuizPath, "utf8");
  const provenance = fs.readFileSync(provenancePath, "utf8");
  const onboardingImageSource = `${source}\n${tasteQuizSource}`;

  assert.doesNotMatch(
    onboardingImageSource,
    /https?:\/\//,
    "onboarding food and taste quiz image references must not use remote URLs",
  );
  assert.doesNotMatch(
    onboardingImageSource,
    /unsplash|pexels|pixabay|stock|scraped|homemade|phone shot/i,
    "onboarding food and taste quiz image references must not use stock, scraped, or homemade imagery",
  );
  assert.match(
    tasteQuizSource,
    /generatedImageAsset/,
    "legacy taste quiz scenarios should point at generated local onboarding assets",
  );
  assert.match(
    resultScreenSource,
    /source=\{\{\s*uri:\s*dish\.imageUrl\s*\}\}/,
    "recommendations show the actual ranked dish photo, preserving identity",
  );
  assert.match(
    resultScreenSource,
    /getSearchResultsAsync/,
    "result dishes come from the provider and selected preferences",
  );
});
