import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("detail screens show full food-centre location, weekly hours, and maps action", () => {
  const dishDetail = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");
  const locationHelpers = read("src/features/detail/stallLocation.ts");
  const safeLinking = read("src/lib/security/safeLinking.ts");

  assert.match(dishDetail, /formatFoodCentreLocation\(building\)/);
  assert.match(dishDetail, /formatFullStallAddress\(venue, building\)/);
  assert.match(dishDetail, /openTrustedMapsUrl\(buildMapsSearchUrl\(fullStallAddress\)\)/);

  assert.match(stallDetail, /formatWeeklyOperatingHours\(venue\.operatingHours\)/);
  assert.match(stallDetail, /weeklyOperatingHours\.map/);
  assert.match(stallDetail, /openTrustedMapsUrl\(buildMapsSearchUrl\(stallAddress\)\)/);

  assert.match(locationHelpers, /WEEKDAYS\.map/);
  assert.match(locationHelpers, /Singapore \$\{building\.postalCode\}/);
  assert.match(safeLinking, /ALLOWED_MAPS_HOSTS/);
  assert.match(safeLinking, /openTrustedMapsUrl/);
});

test("detail save buttons use compact standardized labels that stay inside the buttons", () => {
  const saveActions = read("src/features/checklistPortfolio/DetailSaveActions.tsx");
  const button = read("src/components/ui/Button.tsx");

  assert.match(saveActions, /label="Add to Checklist"[\s\S]*size="sm"/);
  assert.match(saveActions, /label="Add to Portfolio"[\s\S]*size="sm"/);
  assert.match(saveActions, /labelNumberOfLines=\{1\}/);
  assert.match(saveActions, /labelEllipsizeMode="tail"/);
  assert.match(button, /flexShrink: 1/);
  assert.match(button, /textAlign: "center"/);
});
