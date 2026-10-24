import assert from "node:assert/strict";
import test from "node:test";

import { Platform } from "react-native";
import { alertCalls } from "@/test/reactNativeStub";
import { confirmAction } from "./confirmAction";

const platform = Platform as { OS: string };

function confirmSignOut(onConfirm: () => void) {
  confirmAction({
    title: "Sign out",
    message: "You will be signed out.",
    confirmLabel: "Sign out",
    destructive: true,
    onConfirm,
  });
}

test("native: the confirm is an Alert whose destructive button runs the action", () => {
  alertCalls.length = 0;
  let confirmed = 0;
  confirmSignOut(() => {
    confirmed += 1;
  });
  assert.equal(confirmed, 0, "nothing happens before the choice");
  const call = alertCalls.at(-1);
  assert.equal(call?.title, "Sign out");
  const button = call?.buttons?.find((candidate) => candidate.text === "Sign out");
  assert.equal(button?.style, "destructive");
  button?.onPress?.();
  assert.equal(confirmed, 1);
});

test("PROF-V4: on web, where Alert.alert is a no-op, the browser confirm decides", () => {
  const previousOS = platform.OS;
  const globals = globalThis as { confirm?: (message: string) => boolean };
  const previousConfirm = globals.confirm;
  platform.OS = "web";
  try {
    alertCalls.length = 0;
    let confirmed = 0;
    globals.confirm = () => false;
    confirmSignOut(() => {
      confirmed += 1;
    });
    assert.equal(confirmed, 0, "Cancel keeps the user signed in");
    globals.confirm = (message) => message.startsWith("Sign out");
    confirmSignOut(() => {
      confirmed += 1;
    });
    assert.equal(confirmed, 1, "OK signs out");
    assert.equal(alertCalls.length, 0, "no Alert on web");
  } finally {
    platform.OS = previousOS;
    globals.confirm = previousConfirm;
  }
});
