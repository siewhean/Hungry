import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("Profile exposes the add-stall contribution section and route", () => {
  const navigationTypes = read("src/app/navigation/navigationTypes.ts");
  const profileStack = read("src/app/screens/profile/ProfileStack.tsx");
  const profileHome = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  assert.match(navigationTypes, /AddStall: undefined/);
  assert.match(profileStack, /import \{ AddStallScreen \} from "\.\/AddStallScreen"/);
  assert.match(profileStack, /<Stack\.Screen name="AddStall" component=\{AddStallScreen\}/);
  assert.match(profileHome, /function StallContributionCard/);
  assert.match(profileHome, /loadStallSubmissions/);
  assert.match(profileHome, /label="Add Discovered Stall"/);
  assert.match(profileHome, /navigation\.navigate\("AddStall"\)/);
  assert.match(profileHome, /Add stalls from online finds/);
  assert.match(profileHome, /Submitted/);
  assert.match(profileHome, /With menu/);
  assert.match(profileHome, /Scout/);
});

test("AddStall form requires stall name and image while preserving optional detail fields", () => {
  const screen = read("src/app/screens/profile/AddStallScreen.tsx");

  assert.match(screen, /import \* as ImagePicker from "expo-image-picker"/);
  assert.match(screen, /requestMediaLibraryPermissionsAsync/);
  assert.match(screen, /launchImageLibraryAsync/);
  assert.match(screen, /mediaTypes: ImagePicker\.MediaTypeOptions\.Images/);
  assert.match(screen, /allowsMultipleSelection: true/);
  assert.match(screen, /selectionLimit: MAX_STALL_IMAGES/);
  assert.match(screen, /selectedImages\.map/);
  assert.match(screen, /horizontal/);
  assert.match(screen, /makeCoverImage/);
  assert.match(screen, /BottomSheet[\s\S]*accessibilityLabel="Choose opening time"/);
  assert.match(screen, /DateTimePicker[\s\S]*display="spinner"/);
  assert.match(screen, /Stall name is required\./);
  assert.match(screen, /At least one stall photo is required\./);
  assert.match(screen, /label="Stall name"/);
  assert.match(screen, /<SelectField[\s\S]*label="Area"/);
  assert.match(screen, /placeholder="1"/);
  assert.match(screen, /placeholder="30 Seng Poh Road"/);
  assert.match(screen, /Opening hours/);
  assert.match(screen, /Use \$\{preset\.label\.toLowerCase\(\)\} opening days/);
  assert.match(screen, /menuItemDrafts\.map/);
  assert.match(screen, /label=\{`Menu item \$\{index \+ 1\}`\}/);
  assert.match(screen, /accessibilityLabel="Add another menu item"/);
  assert.match(screen, /<Plus color=\{palette\.orange\}/);
  assert.match(screen, /label="Ordering or delivery link"/);
  assert.doesNotMatch(screen, /label="Where did you find it online\?"/);
  assert.doesNotMatch(screen, /label="Notes"/);
  assert.doesNotMatch(screen, /sourceUrl: sourceUrl\.trim\(\)/);
  assert.match(screen, /submitStall\(input\)/);
  assert.match(screen, /awardFoodCred\("stall_submitted", submission\.id\)/);
  assert.match(screen, /incrementMission\(profile\.id, "add_stall"\)/);
  assert.match(
    screen,
    /recordPassportContribution\(profile\.id, "stall_submitted", submission\.id\)/,
  );
  assert.match(screen, /Scout achievements/);
  assert.match(screen, /First Find/);
  assert.match(screen, /Menu Mapper/);
  assert.match(screen, /Local Scout/);
});

test("Stall submission service and gamification contracts are shared", () => {
  const domain = read("src/types/domain.ts");
  const serviceTypes = read("src/lib/services/types.ts");
  const store = read("src/store/useStallSubmissionStore.ts");
  const mockService = read("src/lib/services/mock/mockService.ts");
  const passportStore = read("src/store/usePassportStore.ts");
  const foodCred = read("src/constants/foodCredConfig.ts");
  const missions = read("src/constants/missionTemplates.ts");

  assert.match(domain, /export interface UserStallSubmission/);
  assert.match(domain, /export interface SubmitUserStallSubmissionInput/);
  assert.match(domain, /\| "stall_submitted"/);
  assert.match(domain, /\| "add_stall"/);
  assert.match(serviceTypes, /contributions: \{/);
  assert.match(serviceTypes, /submitDiscoveredStall/);
  assert.match(serviceTypes, /listMyDiscoveredStalls/);
  assert.match(serviceTypes, /recordProgress/);
  assert.match(store, /getHungryService\(\)\.contributions\.submitDiscoveredStall/);
  assert.match(mockService, /contributions: \{/);
  assert.match(mockService, /createMockUserStallSubmission/);
  assert.match(mockService, /recordProgress\(categoryId, eventType, referenceId\)/);
  assert.match(passportStore, /recordContribution/);
  assert.match(passportStore, /countUniqueContributionEvents\(events, "stall_submitted"\)/);
  assert.match(foodCred, /stall_submitted: 12/);
  assert.match(missions, /id: "mission-add-new-stall"/);
  assert.match(missions, /missionType: "add_stall"/);
});
