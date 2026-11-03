// The thumbs question and the Send feedback sheet, in a rendered tree. Run with
// `node scripts/test-render.mjs src/components/feedback/feedback.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
  setAnalyticsEnabled,
} from "@/lib/analytics";
import { useFeedbackStore } from "@/store/useFeedbackStore";
import { cleanup, render, settle } from "@/test/render";

import { FeedbackSheet } from "./FeedbackSheet";
import { FeedbackThumbs } from "./FeedbackThumbs";

beforeEach(() => {
  useFeedbackStore.setState({ settled: {}, lastShownAt: 0, sentAt: [] });
  setAnalyticsEnabled(true);
  clearTrackedAnalyticsEvents();
});
afterEach(cleanup);

const tracked = () => getTrackedAnalyticsEvents().map((event) => event.event);
const byLabel = (label: string) =>
  document.body.querySelector(`[aria-label="${label}"]`) as HTMLElement | null;

test("the thumbs question shows once, records the thumb, and thanks the person", async () => {
  const view = await render(<FeedbackThumbs promptId="decide_pick" />);
  assert.match(document.body.textContent ?? "", /Was this a good pick\?/);
  assert.deepEqual(tracked(), ["feedback_prompt_shown"]);

  await view.press(byLabel("Was this a good pick? Yes"));
  assert.match(document.body.textContent ?? "", /Thanks, that helps us/);
  assert.deepEqual(tracked(), ["feedback_prompt_shown", "feedback_thumb_submitted"]);
  assert.equal(getTrackedAnalyticsEvents()[1]?.properties.rating, "up");
});

test("a thumbs down is recorded before any reason, and the reason is optional", async () => {
  const view = await render(<FeedbackThumbs promptId="search_results" />);
  await view.press(byLabel("Did you find what you wanted? No"));
  assert.match(document.body.textContent ?? "", /What was off\?/);
  assert.equal(getTrackedAnalyticsEvents()[1]?.properties.rating, "down");

  await view.press(byLabel("Skip"));
  assert.equal(document.body.textContent?.includes("What was off?"), false);
  assert.deepEqual(tracked(), ["feedback_prompt_shown", "feedback_thumb_submitted"]);
});

test("a reason is sent as its own event", async () => {
  const view = await render(<FeedbackThumbs promptId="search_results" />);
  await view.press(byLabel("Did you find what you wanted? No"));
  await view.press(byLabel("Too far"));
  assert.equal(tracked().at(-1), "feedback_thumb_reason");
  assert.equal(getTrackedAnalyticsEvents().at(-1)?.properties.reason, "too_far");
});

test("Not now closes it and it is not asked again soon", async () => {
  const view = await render(<FeedbackThumbs promptId="decide_pick" />);
  await view.press(byLabel("Not now"));
  assert.equal(document.body.textContent?.includes("Was this a good pick?"), false);
  assert.equal(tracked().at(-1), "feedback_prompt_dismissed");
  await cleanup();
  await render(<FeedbackThumbs promptId="decide_pick" />);
  assert.equal(document.body.textContent?.includes("Was this a good pick?"), false);
});

test("nothing is shown while usage analytics is off", async () => {
  setAnalyticsEnabled(false);
  await render(<FeedbackThumbs promptId="decide_pick" />);
  assert.equal(document.body.textContent?.includes("Was this a good pick?"), false);
});

test("the feedback sheet will not send an empty note, and sends a written one", async () => {
  const view = await render(<FeedbackSheet visible onClose={() => undefined} />);
  await settle();
  const send = byLabel("Send");
  assert.equal(send?.getAttribute("aria-disabled"), "true");

  const field = document.body.querySelector("textarea") as HTMLTextAreaElement;
  await view.type(field, "Love the map, search is slow");
  await view.press(byLabel("Send"));
  assert.match(document.body.textContent ?? "", /Thank you\. We read every note\./);
  assert.equal(tracked().at(-1), "feedback_submitted");
});
