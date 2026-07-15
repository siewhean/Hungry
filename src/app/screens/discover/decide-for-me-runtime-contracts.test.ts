import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRoot: string) {
  return readFileSync(resolve(process.cwd(), pathFromRoot), "utf8");
}

test("Discover navigates to Decide for Me without waiting for recommendation reads", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const handler =
    discover.match(
      /const handleDecideForMe = \(\) => \{[\s\S]*?\n  \};\n\n  const handleFoodStylePress/,
    )?.[0] ?? "";

  assert.match(handler, /navigation\.navigate\("DecideForMeResult"\)/);
  assert.doesNotMatch(handler, /await|\.decideForMe\(|\.searchDishes\(|getHungryService\(/);
  assert.doesNotMatch(handler, /cacheRecommendationSlate|finally\(/);
});

test("Decide result owns one capped recommendation request and explicit recovery states", () => {
  const result = read("src/app/screens/discover/DecideForMeResultScreen.tsx");
  const searchEffect =
    result.match(
      /useEffect\(\(\) => \{\n    let active = true;[\s\S]*?\n  \}, \[[\s\S]*?\n  \]\);\n\n  const dish/,
    )?.[0] ?? "";

  assert.equal(result.match(/\.searchDishes\(/g)?.length, 1);
  assert.doesNotMatch(result, /\.decideForMe\(/);
  assert.match(result, /const DECIDE_RESULT_LIMIT = 20/);
  assert.match(result, /results\s*\.slice\(0, DECIDE_RESULT_LIMIT\)/);
  assert.match(result, /const recommendationContextRef = useRef\(/);
  assert.match(searchEffect, /dietaryFlags: recommendationContext\.dietaryPreferences/);
  assert.match(searchEffect, /tasteValues: recommendationContext\.tasteVector/);
  assert.doesNotMatch(searchEffect, /profile\.|currentLocation\./);
  assert.match(result, /setIsLoading\(true\)/);
  assert.match(result, /setLoadError\(/);
  assert.match(result, /label="Try again" onPress=\{retrySearch\}/);
  assert.match(result, /Finding your best nearby match…/);
});

test("Decide result discloses representative media and never fabricates dish facts", () => {
  const result = read("src/app/screens/discover/DecideForMeResultScreen.tsx");

  assert.match(result, /serviceProviderMode === "supabase"/);
  assert.match(result, /getDishFallbackImageSource\(dish\)/);
  assert.match(result, /REPRESENTATIVE/);
  assert.match(result, /formatDiscoverPrice\(dish\)/);
  assert.match(result, /No source-backed description is available for this dish yet\./);
  assert.doesNotMatch(result, /A flavorful local specialty/);
  assert.doesNotMatch(result, /\{venue\?\.name\} · \{venue\?\.unitNumber\}/);
});
