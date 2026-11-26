import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");
const installed = (name: string): string =>
  JSON.parse(read(`node_modules/${name}/package.json`)).version;
const atLeast = (version: string, minimum: string) => {
  const a = version.split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

// The native tab bar crashed on a Release iPhone build (no icons, taps ignored, SIGABRT on tab
// switch) when @react-navigation/bottom-tabs 7.15.x was paired with react-native-screens 4.26: the
// old bottom-tabs sends tabKey/isFocused/top-level icons, 4.26 expects navStateRequest,
// onTabSelected, screenKey and ios.icon. 7.16.0 is the first release that speaks the new API.
const MIN_BOTTOM_TABS = "7.16.0";

test("installed bottom-tabs is new enough to speak the react-native-screens 4.26 tabs API", () => {
  const version = installed("@react-navigation/bottom-tabs");
  assert.ok(
    atLeast(version, MIN_BOTTOM_TABS),
    `@react-navigation/bottom-tabs ${version} < ${MIN_BOTTOM_TABS}`,
  );
});

test("bottom-tabs native view drives the Tabs host with navStateRequest, screenKey and ios icons", () => {
  const view = read(
    "node_modules/@react-navigation/bottom-tabs/lib/module/unstable/NativeBottomTabView.native.js",
  );
  assert.match(view, /navStateRequest/);
  assert.match(view, /baseProvenance/);
  assert.match(view, /onTabSelected/);
  assert.match(view, /screenKey/);
  assert.doesNotMatch(view, /onNativeFocusChange/);
  assert.doesNotMatch(view, /tabKey/);
});

test("installed react-native-screens Tabs host accepts the props bottom-tabs sends", () => {
  const hostTypes = read(
    "node_modules/react-native-screens/src/components/tabs/host/TabsHost.types.ts",
  );
  assert.match(hostTypes, /navStateRequest: TabsHostNavStateRequest/);
  assert.match(hostTypes, /baseProvenance: number/);
  const screenTypes = read(
    "node_modules/react-native-screens/src/components/tabs/screen/TabsScreen.types.ts",
  );
  assert.match(screenTypes, /screenKey: string/);
});

test("package.json keeps bottom-tabs on a range that cannot resolve below the minimum", () => {
  const range: string = JSON.parse(read("package.json")).dependencies[
    "@react-navigation/bottom-tabs"
  ];
  const floor = range.replace(/^[\^~]/, "");
  assert.ok(
    atLeast(floor, MIN_BOTTOM_TABS),
    `package.json range ${range} allows < ${MIN_BOTTOM_TABS}`,
  );
});

test("the app builds its native tabs with sfSymbol icons through the unstable native navigator", () => {
  const nav = read("src/app/navigation/SwipeableTabNavigator.tsx");
  assert.match(nav, /createNativeBottomTabNavigator/);
  assert.match(nav, /@react-navigation\/bottom-tabs\/unstable/);
  assert.match(nav, /type: "sfSymbol" as const/);
});
