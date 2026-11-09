// People here: the row on stall and dish pages (PeopleHereRow, usePlacePeople) and the full list
// (PlacePeopleScreen) it opens.
// Run with `node scripts/test-render.mjs src/components/social/peopleHere.render.test.tsx`.
import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { PlacePeopleScreen } from "@/app/screens/profile/PlacePeopleScreen";
import { PeopleHereRow } from "@/components/social/PeopleHereRow";
import { placePeopleSummary } from "@/features/social/usePlacePeople";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { PlacePeople, PlaceRef } from "@/lib/services/types";
import { useSocialStore } from "@/store/useSocialStore";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const restores: (() => void)[] = [];
function stubPeople(result: PlacePeople | Error, calls: [PlaceRef, number | undefined][] = []) {
  const social = getHungryService().social;
  const original = social.getPlacePeople;
  social.getPlacePeople = async (place, limit) => {
    calls.push([place, limit]);
    if (result instanceof Error) throw result;
    return result;
  };
  restores.push(() => {
    social.getPlacePeople = original;
  });
  return calls;
}

const MEI = { userId: "u-mei", displayName: "Mei", isFollowed: true, contributions: 3 };
const ARUN = { userId: "u-arun", displayName: "Arun", isFollowed: false, contributions: 1 };

beforeEach(async () => {
  await enterScenario("user");
  useSocialStore.setState({ followedUserIds: { "u-mei": true }, requestedUserIds: {} });
});
afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()!();
});

test("the summary counts the people you follow against everyone", () => {
  assert.equal(placePeopleSummary([MEI], 1), "1 person you follow");
  assert.equal(placePeopleSummary([MEI, { ...MEI, userId: "x" }], 2), "2 people you follow");
  assert.equal(placePeopleSummary([MEI, ARUN], 6), "1 you follow, 6 in all");
  assert.equal(placePeopleSummary([ARUN], 1), "1 person reviewed or posted here");
  assert.equal(placePeopleSummary([ARUN], 4), "4 people reviewed or posted here");
});

test("People here shows five avatars, followed first, opens a person and See all", async () => {
  const calls = stubPeople({ people: [MEI, ARUN], totalPeople: 8 });
  const opened: string[] = [];
  let seeAll = 0;
  const view = await render(
    createElement(PeopleHereRow, {
      place: { venueId: "venue-1" },
      enabled: true,
      screen: "StallDetail",
      onOpenPerson: (person) => opened.push(person.userId),
      onSeeAll: () => {
        seeAll += 1;
      },
    }),
  );
  assert.deepEqual(calls, [[{ venueId: "venue-1" }, 5]]);
  assert.ok(view.findByText("People here"));
  assert.ok(view.findByText("1 you follow, 8 in all"));
  assert.ok(view.findByText("Following"), "Mei is followed: a label, not a pill");
  assert.ok(view.findByLabel("Follow Arun"));
  assert.equal(view.findByLabel("Follow Mei"), null);
  await view.press(view.findByLabel("Open Arun's profile"));
  assert.deepEqual(opened, ["u-arun"]);
  await view.press(view.findByText("See all 8 people"));
  assert.equal(seeAll, 1);
});

test("People here stays hidden when switched off, when nobody is there, or when the read fails", async () => {
  const calls = stubPeople({ people: [ARUN], totalPeople: 1 });
  const props = {
    place: { dishId: "dish-1" } as PlaceRef,
    screen: "DishDetail",
    onOpenPerson: () => undefined,
    onSeeAll: () => undefined,
  };
  const off = await render(createElement(PeopleHereRow, { ...props, enabled: false }));
  assert.equal(off.findByTestId("people-here"), null);
  assert.equal(calls.length, 0, "no read while switched off");
  await cleanup();

  restores.pop()!();
  stubPeople({ people: [], totalPeople: 0 });
  const nobody = await render(createElement(PeopleHereRow, { ...props, enabled: true }));
  assert.equal(nobody.findByTestId("people-here"), null);
  await cleanup();

  restores.pop()!();
  stubPeople(new Error("timeout"));
  const failed = await render(createElement(PeopleHereRow, { ...props, enabled: true }));
  assert.equal(failed.findByTestId("people-here"), null);
});

test("PlacePeopleScreen lists everyone with Follow pills and opens their profile", async () => {
  const calls = stubPeople({ people: [MEI, ARUN], totalPeople: 14 });
  const view = await renderScreen(PlacePeopleScreen as never, {
    name: "PlacePeople",
    params: { venueId: "venue-1", placeName: "Sungei Road Laksa" },
  });
  assert.deepEqual(calls, [[{ venueId: "venue-1" }, 10]]);
  assert.ok(view.findByText("Who reviewed or posted at Sungei Road Laksa"));
  assert.ok(view.findByText("Following, 3 reviews and posts"));
  assert.ok(view.findByText("1 review or post"));
  assert.ok(view.findByText("And 12 more people."));
  assert.ok(view.findByLabel("Follow Arun"));
  await view.press(view.findByText("Arun"));
  const call = view.navigation.calls.find((entry) => entry.method === "navigate");
  assert.deepEqual(call?.args, ["UserProfile", { authorId: "u-arun", authorName: "Arun" }]);
});

test("PlacePeopleScreen shows the empty art, and Retry after a failed read", async () => {
  stubPeople({ people: [], totalPeople: 0 });
  const empty = await renderScreen(PlacePeopleScreen as never, {
    name: "PlacePeople",
    params: { dishId: "dish-1", placeName: "Laksa" },
  });
  assert.ok(empty.findByText("Who reviewed or posted Laksa"));
  assert.ok(empty.findByText("Nobody here yet"));
  assert.ok(empty.findByTestId("place-people-empty-art"));
  await cleanup();

  restores.pop()!();
  const calls = stubPeople(new Error("timeout"));
  const failed = await renderScreen(PlacePeopleScreen as never, {
    name: "PlacePeople",
    params: { dishId: "dish-1" },
  });
  assert.ok(failed.findByText("Couldn't load people"));
  await failed.press(failed.findByText("Retry"));
  assert.equal(calls.length, 2);
});
