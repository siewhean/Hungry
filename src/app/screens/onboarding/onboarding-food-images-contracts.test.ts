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
  const onboardingImageSource = `${source}\n${tasteQuizSource}\n${resultScreenSource}`;

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
  assert.doesNotMatch(
    resultScreenSource,
    /source=\{\{\s*uri:\s*dish\.imageUrl\s*\}\}/,
    "onboarding result recommendations must not fall back to remote dish image URLs",
  );
  assert.match(
    resultScreenSource,
    /getOnboardingDishImageSource\(dish\.id\)/,
    "onboarding result recommendations should reuse generated local dish imagery",
  );
  assert.match(
    source,
    /ONBOARDING_RESULT_DISH_IMAGES/,
    "onboarding result recommendations should have an explicit generated image map",
  );
  assert.match(
    provenance,
    /src\/assets\/onboarding\/food\/.*professional restaurant-style generated food photography/s,
    "onboarding food assets must record generated professional-photo provenance",
  );
  assert.match(
    provenance,
    /No homemade photos, casual phone shots, stock providers, or scraped food photos are allowed/,
    "onboarding food provenance must reject homemade-looking and stock imagery",
  );
  assert.match(
    provenance,
    /generated restaurant\/menu photography with controlled lighting, polished plating, clean tableware/,
    "onboarding food provenance must require a professional generated-photo standard",
  );
  assert.match(
    provenance,
    /no casual home-kitchen counters, phone flash, cluttered homemade staging, watermark text, stock-photo providers, or scraped food photos/,
    "onboarding food provenance must block homemade, stock, scraped, or watermarked replacements",
  );

  const referencedAssets = [
    ...source.matchAll(/require\("(\.\.\/\.\.\/\.\.\/assets\/onboarding\/food\/[^"]+\.png)"\)/g),
  ].map(([, relativeAsset]) =>
    path.normalize(path.join(path.dirname(registryPath), relativeAsset)),
  );
  const uniqueReferencedAssets = new Set(referencedAssets);
  const filesOnDisk = fs
    .readdirSync(assetDir)
    .filter((fileName) => fileName.endsWith(".png"))
    .map((fileName) => path.join(assetDir, fileName));
  const generatedScenarioAssets = [
    ...tasteQuizSource.matchAll(/generatedImageAsset:\s*"([^"]+\.png)"/g),
  ].map(([, fileName]) => fileName);

  assert.equal(
    uniqueReferencedAssets.size,
    20,
    "all onboarding food choices should use generated local assets",
  );
  assert.deepEqual(
    [...uniqueReferencedAssets].sort(),
    filesOnDisk.sort(),
    "every onboarding food asset on disk should be referenced exactly by the registry",
  );
  assert.ok(
    generatedScenarioAssets.length > 0,
    "legacy taste quiz scenarios should keep generated asset references",
  );
  for (const generatedAsset of generatedScenarioAssets) {
    assert.ok(
      fs.existsSync(path.join(assetDir, generatedAsset)),
      `${generatedAsset} must exist as a generated onboarding food asset`,
    );
  }

  for (const assetPath of uniqueReferencedAssets) {
    const stats = fs.statSync(assetPath);
    const size = readPngSize(assetPath);
    const fileName = path.basename(assetPath);
    const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const manifestRow = new RegExp(
      `\\|\\s+\`${escapedFileName}\`\\s+\\|\\s+[^|]+\\|\\s+Generated professional restaurant-style food photography; polished plating; clean tableware; no homemade kitchen staging\\.\\s+\\|`,
    );

    assert.match(
      provenance,
      manifestRow,
      `${fileName} must have per-asset generated professional-photo provenance`,
    );

    assert.equal(
      size.width,
      size.height,
      `${path.basename(assetPath)} must stay square for onboarding cards`,
    );
    assert.ok(
      size.width >= 600,
      `${path.basename(assetPath)} must keep a high-resolution generated-photo source`,
    );
    assert.ok(
      stats.size > 400_000,
      `${path.basename(assetPath)} should not be replaced with a tiny placeholder`,
    );
  }
});
