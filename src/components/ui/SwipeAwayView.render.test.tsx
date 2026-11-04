// A banner that can be swiped away: it renders what is inside, keeps taps working, and does not
// call onDismiss by itself. Run with
// `HUNGRY_DATA_SOURCE=mock node scripts/test-render.mjs src/components/ui/SwipeAwayView.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { Pressable } from "react-native";

import { AppText, SwipeAwayView } from "@/components/ui";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

test("it shows its content and a tap inside still works", async () => {
  let taps = 0;
  let dismissed = 0;
  const view = await render(
    <SwipeAwayView onDismiss={() => (dismissed += 1)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry connection"
        onPress={() => (taps += 1)}
      >
        <AppText>{"You're offline."}</AppText>
      </Pressable>
    </SwipeAwayView>,
  );
  assert.ok(view.findByText("You're offline."));
  await view.press(view.findByLabel("Retry connection"));
  assert.equal(taps, 1);
  assert.equal(dismissed, 0, "a tap never dismisses it");
});
