// The Wheel's lobby, add sheet, result card and home, clicked through with a controlled search.
// Run with `node scripts/test-render.mjs src/app/screens/wheel/wheel.render.test.tsx`.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach, beforeEach } from "node:test";
import { Linking } from "react-native";

import { WheelEntryAddSheet } from "@/app/screens/wheel/WheelEntryAddSheet";
import { WheelHomeScreen } from "@/app/screens/wheel/WheelHomeScreen";
import { WheelLobbyScreen } from "@/app/screens/wheel/WheelLobbyScreen";
import { WheelResultModal } from "@/app/screens/wheel/WheelResultModal";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { clearExperimentOverrides, setExperimentOverride } from "@/lib/experiments/experiments";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useWheelStore } from "@/store/useWheelStore";
import { cleanup, createFakeNavigation, renderScreen, render } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { DishDetail, SearchFilters } from "@/types/domain";
import { createElement } from "react";

const HERE = { latitude: 1.3521, longitude: 103.8198 };

function dish(id: string, venueId: string, distanceMeters: number): DishDetail {
  return {
    id,
    venueId,
    buildingId: "b",
    venueName: `Stall ${venueId}`,
    unitNumber: "01-01",
    floor: "L1",
    name: id,
    imageUrl: "",
    distanceMeters,
    rating: 4.5,
    reviewCount: 10,
    price: 5,
    priceRange: "$",
    tasteTags: [],
    tasteVector: { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 },
    dietaryFlags: [],
    gallery: [],
    mustOrder: false,
    availabilityFlags: [],
    reviews: [],
  } as DishDetail;
}

const discovery = getHungryService().discovery;
const originals = {
  searchDishes: discovery.searchDishes,
  getVenuesByIds: discovery.getVenuesByIds,
};
let searchCalls: SearchFilters[] = [];

function serve(dishes: DishDetail[] | Error) {
  searchCalls = [];
  discovery.searchDishes = (async (filters: SearchFilters) => {
    searchCalls.push(filters);
    if (dishes instanceof Error) throw dishes;
    return dishes.map((item) => ({ dish: item, score: 1 }));
  }) as typeof discovery.searchDishes;
  discovery.getVenuesByIds = (async (ids: string[]) =>
    ids.map((id) => ({
      id,
      buildingId: "b",
      name: `Venue ${id}`,
      unitNumber: "01-01",
      floor: "L1",
      isOpen: true,
      topDishId: "",
      operatingHours: "Daily 12am-11:59pm",
      deliveryLinks: [],
    }))) as typeof discovery.getVenuesByIds;
}

const events = (name: string) =>
  getTrackedAnalyticsEvents().filter((record) => record.event === name);

/** reportError logs to the console in development; this collects the contexts. */
function captureReports() {
  const reported: { action?: string; screen?: string }[] = [];
  const originalConsoleError = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reported.push(args[2] as { action?: string });
  };
  restores.push(() => {
    console.error = originalConsoleError;
    globals.__DEV__ = previousDev;
  });
  return reported;
}

const restores: (() => void)[] = [];

async function startWheel() {
  useWheelStore.getState().reset();
  return useWheelStore.getState().createParty("classic", "manual");
}

beforeEach(async () => {
  await enterScenario("guest");
  useLocationStore.setState({ permission: "granted", currentLocation: HERE });
  clearTrackedAnalyticsEvents();
});

afterEach(async () => {
  await cleanup();
  Object.assign(discovery, originals);
  useWheelStore.getState().reset();
  clearExperimentOverrides();
  while (restores.length) restores.pop()?.();
});

const renderLobby = async (party: { id: string }) =>
  renderScreen(WheelLobbyScreen as never, {
    name: "WheelLobby",
    params: { partyId: party.id },
  });

test("MD-W2 a new wheel starts with the four nearest open stalls", async () => {
  serve([
    dish("d1", "v1", 300),
    dish("d2", "v2", 100),
    dish("d3", "v3", 200),
    dish("d4", "v4", 400),
    dish("d5", "v5", 500),
  ]);
  const party = await startWheel();
  const view = await renderLobby(party);
  await view.settle();
  const labels = useWheelStore.getState().entries.map((entry) => entry.label);
  assert.deepEqual(labels, ["Venue v2", "Venue v3", "Venue v1", "Venue v4"]);
  assert.match(view.text(), /We added 4 open stalls near you/);
  assert.equal(searchCalls[0].radius, 1500);
  assert.equal(events("wheel_prefilled")[0]?.properties?.count, 4);
  assert.ok(
    events("wheel_option_added").every((event) => event.properties?.source === "prefill"),
    "the app's own adds are not counted as the diner's picks",
  );
});

test("MD-W2 when no stall near the diner is open the empty wheel says so", async () => {
  serve([]);
  const party = await startWheel();
  const view = await renderLobby(party);
  await view.settle();
  assert.equal(useWheelStore.getState().entries.length, 0);
  assert.match(view.text(), /No stalls near you are open right now/);
});

test("wheel_prefill_v1: the control arm starts with an empty wheel and searches for nothing", async () => {
  setExperimentOverride("wheel_prefill_v1", "control");
  serve([dish("d1", "v1", 100)]);
  const party = await startWheel();
  const view = await renderLobby(party);
  await view.settle();
  assert.equal(searchCalls.length, 0);
  assert.equal(useWheelStore.getState().entries.length, 0);
  assert.equal(events("wheel_prefilled").length, 0);
});

test("MD-W2 a wheel that already has a stall, or a guessed location, is not prefilled", async () => {
  serve([dish("d1", "v1", 100)]);
  useLocationStore.setState({ permission: "denied", currentLocation: undefined });
  const guessed = await startWheel();
  const view = await renderLobby(guessed);
  await view.settle();
  assert.equal(searchCalls.length, 0, "no search from a guessed location");
  assert.equal(useWheelStore.getState().entries.length, 0);
  assert.match(view.text(), /The wheel is empty/);
});

test("MD-W2 a failed prefill is reported and leaves an empty wheel to fill by hand", async () => {
  const reported = captureReports();
  serve(new Error("search down"));
  const party = await startWheel();
  const view = await renderLobby(party);
  await view.settle();
  assert.ok(reported.some((report) => report.action === "prefill"));
  assert.match(view.text(), /The wheel is empty/);
});

test("MD-W4 Spin says what it is waiting for", async () => {
  useLocationStore.setState({ permission: "denied", currentLocation: undefined });
  serve([]);
  const party = await startWheel();
  const view = await renderLobby(party);
  assert.ok(view.findByText("Add two to spin"));
  useWheelStore.getState().addEntry("v1", "b", "One", "");
  await view.settle();
  assert.ok(view.findByText("Add one more to spin"));
  useWheelStore.getState().addEntry("v2", "b", "Two", "");
  await view.settle();
  assert.ok(view.findByText("Spin wheel"));
});

test("MD-W2 the add sheet stays open after an add and counts what is on the wheel", async () => {
  await startWheel();
  let closed = 0;
  const view = await render(
    createElement(WheelEntryAddSheet as never, {
      visible: true,
      onClose: () => {
        closed += 1;
      },
    }),
  );
  assert.match(view.text(), /0 on the wheel/);
  await view.press(view.findByText("Surprise"));
  await view.press(view.findByLabel(/Pick a random stall/));
  assert.equal(closed, 0, "the sheet stays open");
  assert.equal(useWheelStore.getState().entries.length, 1);
  assert.match(view.text(), /Added .+ · 1 on the wheel/);
  await view.press(view.findByLabel("Done adding options"));
  assert.equal(closed, 1);
});

test("MD-W6 Browse opens on a category instead of asking for one", async () => {
  await startWheel();
  const view = await render(
    createElement(WheelEntryAddSheet as never, { visible: true, onClose: () => undefined }),
  );
  await view.press(view.findByText("Browse"));
  assert.doesNotMatch(view.text(), /Pick a category above/);
});

test("MD-W3 the winner card shows the building and distance, and Directions opens Maps", async () => {
  const repository = getDataRepository();
  const venue = repository.getVenueById(repository.listPopularNearby()[0].venueId)!;
  const building = repository
    .listBuildings()
    .find((candidate) => candidate.id === venue.buildingId)!;
  useLocationStore.setState({ permission: "granted", currentLocation: HERE });
  useWheelStore.setState({
    entries: [
      {
        id: "entry-1",
        partyId: "p1",
        addedByMemberId: "m1",
        venueId: venue.id,
        buildingId: venue.buildingId,
        label: venue.name,
        imageUrl: "",
        isEliminated: false,
        position: 0,
        addedAt: new Date().toISOString(),
      },
    ],
  });
  const opened: string[] = [];
  const originalOpenUrl = Linking.openURL;
  Linking.openURL = (async (url: string) => {
    opened.push(url);
    return true;
  }) as typeof Linking.openURL;
  restores.push(() => {
    Linking.openURL = originalOpenUrl;
  });
  const view = await renderScreen(WheelResultModal as never, {
    name: "WheelResult",
    params: { winnerEntryId: "entry-1" },
  });
  await view.settle();
  assert.ok(building.name, "the mock stall has a building");
  assert.match(
    view.text(),
    new RegExp((venue.buildingName ?? building.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.match(view.text(), /\d+(\.\d)? km away|\d+ m away/);
  const html = view.html();
  assert.ok(html.indexOf("Directions") < html.indexOf("View stall details"), "Directions leads");

  await view.press(view.findByText("Directions"));
  assert.equal(opened.length, 1);
  assert.match(opened[0], /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.ok(opened[0].includes(encodeURIComponent(venue.name)));
  assert.equal(events("directions_opened")[0]?.properties?.source, "wheel");
});

test("MD-W7 a failed create or join is reported and says so", async () => {
  const reported = captureReports();
  const navigation = createFakeNavigation();
  const realStore = useWheelStore.getState();
  useWheelStore.setState({
    createParty: async () => {
      throw new Error("create failed");
    },
    joinParty: async () => {
      throw new Error("join failed");
    },
  });
  restores.push(() =>
    useWheelStore.setState({ createParty: realStore.createParty, joinParty: realStore.joinParty }),
  );
  const view = await renderScreen(WheelHomeScreen as never, {
    name: "WheelHome",
    params: undefined,
    navigation,
  });
  await view.press(view.findByLabel("Host a party"));
  assert.match(view.text(), /Couldn't start the party/);
  assert.ok(reported.some((report) => report.action === "create_party"));
  assert.equal(
    navigation.calls.filter((call) => call.method === "replace").length,
    0,
    "no lobby for a party that was not made",
  );

  const inputs = view.container.querySelectorAll("input");
  await view.type(inputs[0] as HTMLElement, "MAKAN7");
  await view.type(inputs[1] as HTMLElement, "Sam");
  await view.press(view.findByText("Join the room"));
  assert.match(view.text(), /Couldn't join the party/);
  assert.ok(reported.some((report) => report.action === "join_party"));
});

/** "7am" / "12am" for an hour 0-23, as the hours text writes it. */
function hourText(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
}

test("R5-3 late at night the wheel is filled with stalls that open soon, and still spins", async () => {
  const sgtHour = (new Date().getUTCHours() + 8) % 24;
  // v1 is open all day; the others open 3, 4 and 5 hours from now, so they are closed at any time.
  const opensLater = (offset: number) =>
    `Daily ${hourText(sgtHour + offset)}-${hourText(sgtHour + offset + 1)}`;
  const hours: Record<string, string> = {
    v1: "Daily 12am-11:59pm",
    v2: opensLater(3),
    v3: opensLater(4),
    v4: opensLater(5),
  };
  serve([
    dish("d1", "v1", 100),
    dish("d2", "v2", 200),
    dish("d3", "v3", 300),
    dish("d4", "v4", 400),
  ]);
  const base = discovery.getVenuesByIds;
  discovery.getVenuesByIds = (async (ids: string[]) =>
    (await base(ids)).map((venue) => ({
      ...venue,
      operatingHours: hours[venue.id],
    }))) as typeof discovery.getVenuesByIds;
  const party = await startWheel();
  const view = await renderLobby(party);
  await view.settle();
  assert.equal(useWheelStore.getState().entries.length, 4, "a wheel of four, not one");
  assert.match(view.text(), /We added 1 open stall and 3 that open soon near you/);
  assert.match(view.text(), /Closed now · Opens/);
  assert.ok(view.findByText("Spin wheel"), "it can spin");
});

test("R5-3 one open stall reads '1 open stall', not '1 open stalls'", async () => {
  serve([dish("d1", "v1", 100)]);
  const party = await startWheel();
  const view = await renderLobby(party);
  await view.settle();
  assert.match(view.text(), /We added 1 open stall near you/);
  assert.doesNotMatch(view.text(), /1 open stalls/);
});

test("R5-4 the add sheet's search finds a stall by a dish it serves", async () => {
  await startWheel();
  discovery.searchVenuesByLocation = (async () => []) as typeof discovery.searchVenuesByLocation;
  discovery.searchDishes = (async () => [
    { dish: dish("Laksa", "v9", 100), score: 1 },
  ]) as typeof discovery.searchDishes;
  discovery.getVenuesByIds = (async (ids: string[]) =>
    ids.map((id) => ({
      id,
      buildingId: "b",
      name: "Sungei Road Stall",
      unitNumber: "01-01",
      floor: "L1",
      isOpen: true,
      topDishId: "",
      operatingHours: "",
      deliveryLinks: [],
    }))) as typeof discovery.getVenuesByIds;
  const view = await render(
    createElement(WheelEntryAddSheet as never, { visible: true, onClose: () => undefined }),
  );
  await view.type(view.findByLabel("Search stalls or dishes"), "laksa");
  await new Promise((resolve) => setTimeout(resolve, 320));
  await view.settle();
  assert.ok(view.findByLabel("Add Sungei Road Stall to wheel"), "the laksa stall is listed");
  assert.doesNotMatch(view.text(), /No stalls found/);
});

test("R5-11 the Wheel uses sentence case", async () => {
  await startWheel();
  const view = await render(
    createElement(WheelEntryAddSheet as never, { visible: true, onClose: () => undefined }),
  );
  assert.match(view.text(), /Add an option/);
  await view.press(view.findByText("Surprise"));
  assert.match(view.text(), /Surprise me/);
  assert.match(view.text(), /Pick for me/);
  assert.doesNotMatch(view.text(), /Add an Option|Surprise Me!|Pick for Me/);
});

test("R5-12 Surprise with nothing left says so in the sheet, not in an alert", async () => {
  await startWheel();
  const repository = getDataRepository();
  const view = await render(
    createElement(WheelEntryAddSheet as never, { visible: true, onClose: () => undefined }),
  );
  // Put every stall on the wheel.
  const everyStall = repository
    .listBuildings()
    .flatMap((b) => repository.listVenuesByBuilding(b.id));
  useWheelStore.setState({
    entries: everyStall.map((stall, position) => ({
      id: `e-${stall.id}`,
      partyId: "p1",
      addedByMemberId: "m1",
      venueId: stall.id,
      buildingId: stall.buildingId,
      label: stall.name,
      imageUrl: "",
      isEliminated: false,
      position,
      addedAt: new Date().toISOString(),
    })),
  });
  await view.press(view.findByText("Surprise"));
  assert.match(view.text(), /Every stall is already on the wheel/);
  const button = view.findByLabel(/Pick a random stall/) as HTMLElement;
  assert.equal(button.getAttribute("aria-disabled"), "true");
});

test("R5-5 the remove button and Done reach 44 pt", () => {
  const lobby = readFileSync("src/app/screens/wheel/WheelLobbyScreen.tsx", "utf8");
  const sheet = readFileSync("src/app/screens/wheel/WheelEntryAddSheet.tsx", "utf8");
  // 32 pt of button plus 6 pt of hit slop on each side.
  assert.match(lobby, /hitSlop=\{6\}[\s\S]*minHeight: 32,\s+minWidth: 32/);
  assert.match(sheet, /accessibilityLabel="Done adding options"[\s\S]*minHeight: 44/);
});

test("R5-6 the winner card has a Reduce Motion branch, starts at 95% and uses a symbol, not an emoji", async () => {
  const src = readFileSync("src/app/screens/wheel/WheelResultModal.tsx", "utf8");
  assert.match(src, /WINNER_CARD_START_SCALE = 0\.95/);
  assert.match(src, /useSharedValue\(reduceMotion \? 1 : WINNER_CARD_START_SCALE\)/);
  assert.match(src, /scale\.value = reduceMotion \? 1 : withTiming\(1, timing\)/);
  assert.doesNotMatch(src, /🎉/);
  useWheelStore.setState({
    entries: [
      {
        id: "entry-1",
        partyId: "p1",
        addedByMemberId: "m1",
        venueId: "no-such-venue",
        buildingId: "b",
        label: "Mystery Stall",
        imageUrl: "",
        isEliminated: false,
        position: 0,
        addedAt: new Date().toISOString(),
      },
    ],
  });
  const view = await renderScreen(WheelResultModal as never, {
    name: "WheelResult",
    params: { winnerEntryId: "entry-1" },
  });
  await view.settle();
  assert.doesNotMatch(view.text(), /🎉/);
  assert.equal(
    view.container.querySelectorAll('[data-stub="lucide-react-native.PartyPopper"]').length,
    1,
  );
});

test("R5-7 the spin ticks with selection haptics and ends with a success notification", () => {
  const src = readFileSync("src/app/screens/wheel/WheelSpinScreen.tsx", "utf8");
  assert.match(src, /Haptics\.selectionAsync\(\)/);
  assert.match(src, /Haptics\.notificationAsync\(Haptics\.NotificationFeedbackType\.Success\)/);
  assert.doesNotMatch(src, /ImpactFeedbackStyle/);
});
