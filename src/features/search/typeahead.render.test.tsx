// ResultsNotes and useTypeaheadMatches, rendered on their own.
// Run with `node scripts/test-render.mjs src/features/search/typeahead.render.test.tsx`.

import assert from "node:assert/strict";
import { act, createElement, useState } from "react";
import test, { afterEach } from "node:test";

import { ResultsNotes, type ResultsNote } from "@/features/search/ResultsNotes";
import {
  TYPEAHEAD_DISH_LIMIT,
  TYPEAHEAD_STALL_LIMIT,
  useTypeaheadMatches,
  type TypeaheadMatches,
} from "@/features/search/useTypeaheadMatches";
import {
  CatalogRateLimitedError,
  type CatalogPage,
  type CatalogRawDishCard,
  type CatalogRawVenueCard,
} from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { cleanup, render } from "@/test/render";

type Service = ReturnType<typeof getCatalogRawService>;
let restore: (() => void) | undefined;

afterEach(async () => {
  await cleanup();
  restore?.();
  restore = undefined;
});

const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

function stubCatalog(overrides: Partial<Service>) {
  const service = getCatalogRawService();
  const originals = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, service[key as keyof Service]]),
  );
  Object.assign(service, overrides);
  restore = () => Object.assign(service, originals);
}

function page<T>(items: T[]): CatalogPage<T> {
  return {
    items,
    releaseId: "release-1",
    matchCount: items.length,
    totals: { venues: items.length, dishes: items.length },
  };
}

const dish = (id: string) => ({ id, name: `Dish ${id}` }) as CatalogRawDishCard;
const stall = (id: string) => ({ id, name: `Stall ${id}` }) as CatalogRawVenueCard;

// ---- ResultsNotes

const offline: ResultsNote = { id: "offline", text: "Saved copy.", testID: "note-offline" };
const halal: ResultsNote = { id: "halal", text: "Halal tags are not all MUIS-certified." };

test("ResultsNotes draws nothing without notes", async () => {
  const view = await render(createElement(ResultsNotes, { notes: [] }));
  assert.equal(view.findByLabel("Notes about these results"), null);
});

test("ResultsNotes: one note is one line with no +N, and it can be dismissed", async () => {
  const view = await render(createElement(ResultsNotes, { notes: [offline] }));
  assert.ok(view.findByTestId("note-offline"));
  assert.equal(view.findByText(/more/), null);
  await view.press(view.findByLabel("Dismiss notes"));
  assert.equal(view.findByLabel("Notes about these results"), null);
});

test("ResultsNotes: one note at a time, and dismissing it brings up the next", async () => {
  const view = await render(createElement(ResultsNotes, { notes: [offline, halal] }));
  assert.match(view.text(), /Saved copy/);
  assert.doesNotMatch(view.text(), /MUIS/, "the second note waits");
  assert.equal(view.findByText(/more/), null, "no +N more row");
  await view.press(view.findByLabel("Dismiss notes"));
  assert.match(view.text(), /MUIS/);
  assert.doesNotMatch(view.text(), /Saved copy/);
  await view.press(view.findByLabel("Dismiss notes"));
  assert.equal(view.findByLabel("Notes about these results"), null);
});

test("ResultsNotes: a note with an action is one tap target", async () => {
  let pressed = 0;
  const located: ResultsNote = {
    id: "location",
    text: "Location is off.",
    action: {
      label: "Choose",
      accessibilityLabel: "Choose your area",
      onPress: () => (pressed += 1),
    },
  };
  const view = await render(createElement(ResultsNotes, { notes: [located] }));
  await view.press(view.findByLabel("Choose your area"));
  assert.equal(pressed, 1);
});

test("ResultsNotes: a dismissed note stays dismissed until its text changes", async () => {
  function Harness() {
    const [notes, setNotes] = useState<ResultsNote[]>([offline]);
    return createElement(
      "div",
      null,
      createElement(ResultsNotes, { notes }),
      createElement("button", { onClick: () => setNotes([offline]) }, "same"),
      createElement(
        "button",
        { onClick: () => setNotes([{ ...offline, text: "Another." }]) },
        "changed",
      ),
    );
  }
  const view = await render(createElement(Harness));
  await view.press(view.findByLabel("Dismiss notes"));
  assert.equal(view.findByLabel("Notes about these results"), null);
  await view.press(view.findByText("same"));
  assert.equal(view.findByLabel("Notes about these results"), null, "the same note stays away");
  await view.press(view.findByText("changed"));
  assert.ok(view.findByLabel("Notes about these results"), "a note with new text shows again");
});

// ---- useTypeaheadMatches

function Probe({
  query,
  enabled,
  onChange,
}: {
  query: string;
  enabled: boolean;
  onChange: (matches: TypeaheadMatches) => void;
}) {
  const matches = useTypeaheadMatches(query, enabled);
  onChange(matches);
  return createElement(
    "span",
    null,
    `${matches.status}:${matches.dishes.length}:${matches.stalls.length}`,
  );
}

test("useTypeaheadMatches stays idle when disabled and asks for nothing", async () => {
  let calls = 0;
  stubCatalog({
    listDishes: async () => {
      calls += 1;
      return page([dish("1")]);
    },
    listVenues: async () => page([stall("1")]),
  });
  const view = await render(
    createElement(Probe, { query: "la", enabled: false, onChange: () => undefined }),
  );
  await wait(500);
  assert.match(view.text(), /idle:0:0/);
  assert.equal(calls, 0);
});

test("useTypeaheadMatches loads a few dishes and stalls after the typing pause", async () => {
  const asked: [string, number | undefined][] = [];
  stubCatalog({
    listDishes: async (request) => {
      asked.push(["dishes", request.limit]);
      return page([dish("1"), dish("2"), dish("3"), dish("4")]);
    },
    listVenues: async (request) => {
      asked.push(["stalls", request.limit]);
      return page([stall("1"), stall("2"), stall("3")]);
    },
  });
  const view = await render(
    createElement(Probe, { query: "laksa", enabled: true, onChange: () => undefined }),
  );
  assert.match(view.text(), /loading:0:0/);
  await wait(600);
  // The list is cut to the limits even if the service returns more.
  assert.match(view.text(), new RegExp(`ready:${TYPEAHEAD_DISH_LIMIT}:${TYPEAHEAD_STALL_LIMIT}`));
  assert.deepEqual(asked, [
    ["dishes", TYPEAHEAD_DISH_LIMIT],
    ["stalls", TYPEAHEAD_STALL_LIMIT],
  ]);
});

test("useTypeaheadMatches never shows the answer for old text under new text", async () => {
  stubCatalog({
    listDishes: async (request) => page([dish(request.query ?? "")]),
    listVenues: async () => page<CatalogRawVenueCard>([]),
  });
  const seen: string[] = [];
  const view = await render(
    createElement(Probe, {
      query: "lak",
      enabled: true,
      onChange: (matches) => seen.push(`${matches.status}:${matches.dishes[0]?.id ?? ""}`),
    }),
  );
  await wait(600);
  await view.rerender(
    createElement(Probe, {
      query: "laksa",
      enabled: true,
      onChange: (matches) => seen.push(`${matches.status}:${matches.dishes[0]?.id ?? ""}`),
    }),
  );
  // Right after the text changes the old answer is gone and the new one is loading.
  assert.equal(seen.at(-1), "loading:");
  await wait(600);
  assert.equal(seen.at(-1), "ready:laksa");
});

test("useTypeaheadMatches reports a failure once and says so", async () => {
  const errors: unknown[] = [];
  const original = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") errors.push(args[1]);
  };
  try {
    stubCatalog({
      listDishes: async () => {
        throw new Error("down");
      },
      listVenues: async () => page<CatalogRawVenueCard>([]),
    });
    const view = await render(
      createElement(Probe, { query: "laksa", enabled: true, onChange: () => undefined }),
    );
    await wait(600);
    assert.match(view.text(), /error:0:0/);
    assert.deepEqual(
      errors.map((error) => (error as Error).message),
      ["down"],
    );
  } finally {
    console.error = original;
    globals.__DEV__ = previousDev;
  }
});

test("useTypeaheadMatches asks the way the results page does: best match, from the same position", async () => {
  const asked: { sort?: string; latitude?: number; longitude?: number }[] = [];
  stubCatalog({
    listDishes: async (request) => {
      asked.push({
        sort: request.sort,
        latitude: request.coordinate?.latitude,
        longitude: request.coordinate?.longitude,
      });
      return page([dish("1")]);
    },
    listVenues: async (request) => {
      asked.push({
        sort: request.sort,
        latitude: request.coordinate?.latitude,
        longitude: request.coordinate?.longitude,
      });
      return page([stall("1")]);
    },
  });
  await render(createElement(Probe, { query: "laksa", enabled: true, onChange: () => undefined }));
  await wait(600);
  assert.equal(asked.length, 2);
  for (const request of asked) {
    assert.equal(request.sort, "relevance");
    assert.equal(
      typeof request.latitude,
      "number",
      "the dishes and stalls are asked for near the user",
    );
    assert.equal(typeof request.longitude, "number");
  }
});

test("useTypeaheadMatches shows a rate limit as an error but does not report it", async () => {
  const errors: unknown[] = [];
  const original = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") errors.push(args[1]);
  };
  try {
    stubCatalog({
      listDishes: async () => {
        throw new CatalogRateLimitedError();
      },
      listVenues: async () => page<CatalogRawVenueCard>([]),
    });
    const view = await render(
      createElement(Probe, { query: "laksa", enabled: true, onChange: () => undefined }),
    );
    await wait(600);
    assert.match(view.text(), /error:0:0/);
    assert.deepEqual(errors, []);
  } finally {
    console.error = original;
    globals.__DEV__ = previousDev;
  }
});
