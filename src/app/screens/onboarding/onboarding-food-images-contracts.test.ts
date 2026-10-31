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

/** Lossy WebP (VP8) only: the onboarding photos are converted at 600 px, quality 80. */
function readWebpSize(filePath: string): { width: number; height: number } {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF", `${filePath} must be a WebP file`);
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP", `${filePath} must be a WebP file`);
  assert.equal(buffer.toString("ascii", 12, 16), "VP8 ", `${filePath} must be lossy WebP`);

  return {
    width: buffer.readUInt16LE(26) & 0x3fff,
    height: buffer.readUInt16LE(28) & 0x3fff,
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
  // Result cards are real catalog dishes: show the dish's own photo or the
  // shared no-photo tile, never an onboarding stock image of a different dish.
  const resultCardSource = fs.readFileSync(
    path.join(repoRoot, "src/app/screens/onboarding/ResultDishCard.tsx"),
    "utf8",
  );
  // A missing photo, or one that fails to load, shows the cuisine tile (labelled "no photo yet").
  assert.match(
    resultCardSource,
    /!dish\.imageUrl \|\| failed\) \{\s*return <CuisineTile dish=\{dish\}[\s\S]*source=\{\{ uri: dish\.imageUrl \}\}[\s\S]*onError=\{\(\) => setFailed\(true\)\}/,
    "onboarding result recommendations should use dish.imageUrl with the cuisine-tile fallback",
  );
  assert.doesNotMatch(
    `${source}\n${resultScreenSource}`,
    /getOnboardingDishImageSource|ONBOARDING_RESULT_DISH_IMAGES/,
    "onboarding result recommendations must not map catalog dishes to onboarding stock images",
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
    ...source.matchAll(/require\("(\.\.\/\.\.\/\.\.\/assets\/onboarding\/food\/[^"]+\.webp)"\)/g),
  ].map(([, relativeAsset]) =>
    path.normalize(path.join(path.dirname(registryPath), relativeAsset)),
  );
  const uniqueReferencedAssets = new Set(referencedAssets);
  const filesOnDisk = fs
    .readdirSync(assetDir)
    .filter((fileName) => fileName.endsWith(".webp"))
    .map((fileName) => path.join(assetDir, fileName));
  const generatedScenarioAssets = [
    ...tasteQuizSource.matchAll(/generatedImageAsset:\s*"([^"]+\.webp)"/g),
  ].map(([, fileName]) => fileName);
  const legacyOnlyAssets = [...new Set(generatedScenarioAssets)]
    .map((fileName) => path.join(assetDir, fileName))
    .filter((filePath) => !uniqueReferencedAssets.has(filePath));

  // r2 onboarding-M7: only photos a question shows are bundled; nothing else is required().
  assert.equal(
    uniqueReferencedAssets.size,
    16,
    "every bundled onboarding food photo is one a taste question shows",
  );
  assert.deepEqual(
    [...uniqueReferencedAssets, ...legacyOnlyAssets].sort(),
    filesOnDisk.sort(),
    "every onboarding food asset on disk is either bundled by the registry or named by the legacy scenario quiz",
  );
  assert.deepEqual(
    fs.readdirSync(assetDir).filter((fileName) => !fileName.endsWith(".webp")),
    [],
    "the onboarding photos are WebP only; a PNG would bring back ~600 KB per photo",
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

  for (const assetPath of [...uniqueReferencedAssets, ...legacyOnlyAssets]) {
    const stats = fs.statSync(assetPath);
    const size = readWebpSize(assetPath);
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
      stats.size > 10_000 && stats.size < 150_000,
      `${path.basename(assetPath)} should be a real photo at web size, not a placeholder or a raw export`,
    );
  }
});

test("taste questions show each dish once with sour and salty hawker examples", () => {
  const source = fs.readFileSync(registryPath, "utf8");
  const block = source.slice(source.indexOf("TASTE_QUESTION_FOODS"));
  const labels = [...block.matchAll(/label: "([^"]+)"/g)].map(([, label]) => label);

  assert.equal(labels.length, 18, "six taste questions should show three dishes each");
  assert.equal(new Set(labels).size, labels.length, "each dish should appear in one question only");
  // Lightest answer first, so the example under each label matches the label.
  assert.match(block, /sour: \[[^\]]*"Mee siam"[^\]]*"Rojak"[^\]]*"Asam laksa"/);
  assert.match(block, /spicy: \[[^\]]*"Korean stew"[^\]]*"Laksa"[^\]]*"Mala xiang guo"/);
  assert.match(block, /salty: \[[^\]]*"Fish soup"[^\]]*"Chai tow kway"[^\]]*"Char kway teow"/);

  const quizScreen = fs.readFileSync(
    path.join(repoRoot, "src/app/screens/onboarding/TasteQuizScreen.tsx"),
    "utf8",
  );
  assert.match(
    quizScreen,
    /choiceFoods\[index\]\.imageSource \? \([\s\S]*<NoDishPhoto[\s\S]*dishName=\{choiceFoods\[index\]\.label\}/,
    "dishes without a generated photo should fall back to the shared no-photo tile",
  );
});
