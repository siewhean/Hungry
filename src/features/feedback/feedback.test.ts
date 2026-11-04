import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
  setAnalyticsEnabled,
} from "@/lib/analytics";
import {
  DAILY_FEEDBACK_LIMIT,
  GLOBAL_PROMPT_GAP_MS,
  PROMPT_COOLDOWN_MS,
  useFeedbackStore,
} from "@/store/useFeedbackStore";

import {
  FEEDBACK_MAX_LENGTH,
  dismissFeedbackPrompt,
  recordFeedbackPromptShown,
  sendFeedback,
  shouldShowFeedbackPrompt,
  submitFeedbackThumb,
  submitFeedbackThumbReason,
} from "./feedback";

beforeEach(() => {
  useFeedbackStore.setState({ settled: {}, lastShownAt: 0, sentAt: [] });
  setAnalyticsEnabled(true);
  clearTrackedAnalyticsEvents();
});

const names = () => getTrackedAnalyticsEvents().map((event) => event.event);

test("a question is not asked again for a month after it is answered, nor two within a day", () => {
  const store = useFeedbackStore.getState();
  const t0 = 10_000_000_000_000;
  assert.equal(store.canAsk("decide_pick", t0), true);
  store.markShown(t0);
  assert.equal(store.canAsk("search_results", t0 + 1000), false, "one question a day");
  assert.equal(store.canAsk("search_results", t0 + GLOBAL_PROMPT_GAP_MS), true);
  store.markSettled("decide_pick", t0);
  assert.equal(store.canAsk("decide_pick", t0 + PROMPT_COOLDOWN_MS - 1), false);
  assert.equal(store.canAsk("decide_pick", t0 + PROMPT_COOLDOWN_MS), true);
});

test("no question is offered while usage analytics is off", () => {
  assert.equal(shouldShowFeedbackPrompt("decide_pick"), true);
  setAnalyticsEnabled(false);
  assert.equal(shouldShowFeedbackPrompt("decide_pick"), false);
});

test("a thumbs down counts at once; the reason is a separate, optional event", () => {
  recordFeedbackPromptShown("search_results");
  submitFeedbackThumb("search_results", "down");
  submitFeedbackThumbReason("search_results", "too_far");
  dismissFeedbackPrompt("decide_pick");
  const events = getTrackedAnalyticsEvents();
  assert.deepEqual(
    events.map((event) => [event.event, event.properties]),
    [
      ["feedback_prompt_shown", { prompt_id: "search_results" }],
      ["feedback_thumb_submitted", { prompt_id: "search_results", rating: "down" }],
      ["feedback_thumb_reason", { prompt_id: "search_results", reason: "too_far" }],
      ["feedback_prompt_dismissed", { prompt_id: "decide_pick" }],
    ],
  );
  assert.equal(useFeedbackStore.getState().canAsk("search_results"), false);
});

test("written feedback is trimmed, capped in length and sent as one event", () => {
  const result = sendFeedback("idea", `  ${"a".repeat(FEEDBACK_MAX_LENGTH + 50)}  `);
  assert.deepEqual(result, { status: "sent" });
  const [event] = getTrackedAnalyticsEvents();
  assert.equal(event?.event, "feedback_submitted");
  assert.equal(event?.properties.category, "idea");
  assert.equal((event?.properties.message as string).length, FEEDBACK_MAX_LENGTH);
});

test("empty feedback sends nothing", () => {
  assert.deepEqual(sendFeedback("bug", "   "), { status: "empty" });
  assert.deepEqual(names(), []);
});

test("with analytics off nothing is sent; the person is given an email instead", () => {
  setAnalyticsEnabled(false);
  const result = sendFeedback("bug", "App crashes on the map");
  assert.equal(result.status, "use_email");
  assert.match(
    result.status === "use_email" ? result.mailto : "",
    /^mailto:usehungrysingapore@gmail\.com\?subject=Hungry%20feedback%3A%20Something%20is%20broken&body=App%20crashes/,
  );
  assert.deepEqual(names(), []);
});

test("written feedback is capped per day", () => {
  for (let i = 0; i < DAILY_FEEDBACK_LIMIT; i += 1) {
    assert.equal(sendFeedback("like", `note ${i}`).status, "sent");
  }
  assert.equal(sendFeedback("like", "one more").status, "too_many");
  assert.equal(getTrackedAnalyticsEvents().length, DAILY_FEEDBACK_LIMIT);
  // A send older than a day stops counting.
  useFeedbackStore.setState({
    sentAt: useFeedbackStore.getState().sentAt.map((at) => at - 86_400_001),
  });
  assert.equal(sendFeedback("like", "tomorrow").status, "sent");
});
