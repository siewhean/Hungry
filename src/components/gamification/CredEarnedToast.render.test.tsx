// The "+N Food Cred" pill: shows each award, and waits while a popup is about to show the
// points itself. Run with `npm run test:render`.
import assert from "node:assert/strict";
import { act, createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { CredEarnedToast } from "@/components/gamification/CredEarnedToast";
import { useFoodCredStore } from "@/store/useFoodCredStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render } from "@/test/render";

beforeEach(() => {
  useFoodCredStore.setState({ totalPoints: 0, lastEarnedPoints: 0 });
  useUIStore.setState({ credHold: null, credReplay: null });
});
afterEach(cleanup);

async function award(points: number) {
  await act(async () => {
    useFoodCredStore.setState((state) => ({
      totalPoints: state.totalPoints + points,
      lastEarnedPoints: points,
    }));
  });
}

test("an award shows the pill", async () => {
  const view = await render(createElement(CredEarnedToast));
  assert.equal(view.findByText(/Food Cred/), null);
  await award(5);
  assert.ok(view.findByText("+5 Food Cred"));
});

test("while held, an award is counted and no pill shows", async () => {
  const view = await render(createElement(CredEarnedToast));
  useUIStore.getState().holdCredToast();
  await award(5);
  await award(3);
  assert.equal(view.findByText(/Food Cred/), null);
  assert.deepEqual(useUIStore.getState().credHold, { points: 8 });
});

test("releasing with show brings the held points back as the pill", async () => {
  const view = await render(createElement(CredEarnedToast));
  useUIStore.getState().holdCredToast();
  await award(5);
  await act(async () => {
    useUIStore.getState().releaseCredToast(true);
  });
  assert.ok(view.findByText("+5 Food Cred"));
  assert.equal(useUIStore.getState().credHold, null);
});

test("releasing without show drops the held points; releasing nothing changes nothing", async () => {
  const view = await render(createElement(CredEarnedToast));
  useUIStore.getState().holdCredToast();
  await award(5);
  await act(async () => {
    useUIStore.getState().releaseCredToast(false);
  });
  assert.equal(view.findByText(/Food Cred/), null);
  assert.equal(useUIStore.getState().credReplay, null);
  useUIStore.getState().releaseCredToast(true);
  assert.equal(useUIStore.getState().credReplay, null, "no hold, nothing to replay");
  useUIStore.getState().addHeldCredPoints(4);
  assert.equal(useUIStore.getState().credHold, null, "points are only counted during a hold");
});

test("a release with no points held shows no pill", async () => {
  const view = await render(createElement(CredEarnedToast));
  useUIStore.getState().holdCredToast();
  await act(async () => {
    useUIStore.getState().releaseCredToast(true);
  });
  assert.equal(view.findByText(/Food Cred/), null);
});
