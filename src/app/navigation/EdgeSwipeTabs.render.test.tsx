import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement, type ReactNode } from "react";
import { Text } from "react-native";

import { cleanup, render } from "@/test/render";

import { EdgeSwipePages } from "./EdgeSwipeTabs";

afterEach(cleanup);

const NAMES = ["Discover", "Create", "Review", "Profile", "Home"];
const routes = NAMES.map((name) => ({ key: `${name}-key`, name }));
const descriptors = Object.fromEntries(
  routes.map((route) => [
    route.key,
    { render: () => createElement(Text, null, `${route.name} page`) },
  ]),
);
const jumps: string[] = [];

function pages(index: number, extra: { mountAllPages?: boolean } = {}) {
  return createElement(EdgeSwipePages, {
    state: {
      key: "tabs",
      index,
      routes,
      routeNames: NAMES,
      type: "tab",
      stale: false,
      history: [],
    },
    navigation: { jumpTo: (name: string) => jumps.push(name) },
    descriptors,
    tabBar: (): ReactNode => createElement(Text, null, "the bar"),
    pageCount: 4,
    mountAllPages: extra.mountAllPages ?? false,
    reduceMotion: false,
  } as never);
}

test("the page on show and the bar render; the rest wait until the pages are warm", async () => {
  const view = await render(pages(0));
  assert.match(view.text(), /Discover page/);
  assert.match(view.text(), /the bar/);
  assert.doesNotMatch(view.text(), /Review page/);
  await view.rerender(pages(0, { mountAllPages: true }));
  assert.match(view.text(), /Create page/);
  assert.match(view.text(), /Review page/);
  assert.match(view.text(), /Profile page/);
  assert.doesNotMatch(view.text(), /Home page/, "a route after the pages is not a page");
});

test("a page that has been visited stays mounted when another opens", async () => {
  const view = await render(pages(0));
  await view.rerender(pages(2));
  assert.match(view.text(), /Review page/);
  assert.match(view.text(), /Discover page/, "the page left behind stays for the next drag");
});
