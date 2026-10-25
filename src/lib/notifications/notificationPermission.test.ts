import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { resolveNotificationPermission } from "./notificationPermission";

const results = () =>
  getTrackedAnalyticsEvents().filter((record) => record.event === "notification_permission_result");

beforeEach(() => clearTrackedAnalyticsEvents());

function permissions(existing: { granted: boolean; status: string }, answer = existing) {
  let prompts = 0;
  return {
    prompts: () => prompts,
    getPermissions: async () => existing,
    requestPermissions: async () => {
      prompts += 1;
      return answer;
    },
  };
}

test("SET-V3: a launch with permission already granted reads it without tracking a prompt result", async () => {
  const phone = permissions({ granted: true, status: "granted" });
  assert.equal(await resolveNotificationPermission({ askPermission: false, ...phone }), "granted");
  assert.equal(await resolveNotificationPermission({ askPermission: true, ...phone }), "granted");
  assert.equal(phone.prompts(), 0);
  assert.equal(results().length, 0);
});

test("a real prompt tracks its outcome once", async () => {
  const phone = permissions(
    { granted: false, status: "undetermined" },
    {
      granted: false,
      status: "denied",
    },
  );
  assert.equal(await resolveNotificationPermission({ askPermission: true, ...phone }), "denied");
  assert.equal(phone.prompts(), 1);
  assert.deepEqual(
    results().map((record) => record.properties),
    [{ status: "denied" }],
  );
});

test("without permission and without leave to ask, nothing is asked or tracked", async () => {
  const phone = permissions({ granted: false, status: "undetermined" });
  assert.equal(await resolveNotificationPermission({ askPermission: false, ...phone }), null);
  assert.equal(phone.prompts(), 0);
  assert.equal(results().length, 0);
});
