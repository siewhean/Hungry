import assert from "node:assert/strict";
import test from "node:test";
import { dishes } from "@/lib/services/mock/data";
import { webShareUrl } from "@/constants/links";
import { performShareHandoff } from "./shareHandoff";
const message = dishes[0].name,
  url = webShareUrl("dish", dishes[0].id);
test("failed messaging handoffs and dismissed sheets never report success", async () => {
  const deps = {
    openMessaging: async () => false,
    shareSystem: async () => ({ action: "dismissed" }),
    sharedAction: "shared",
  };
  assert.equal(await performShareHandoff("whatsapp", message, url, deps), false);
  assert.equal(await performShareHandoff("telegram", message, url, deps), false);
  assert.equal(await performShareHandoff("system_share", message, url, deps), false);
  assert.equal(
    await performShareHandoff("system_share", message, url, {
      ...deps,
      shareSystem: async () => ({ action: "shared" }),
    }),
    true,
  );
});
test("system failures propagate to the recoverable caller without success", async () => {
  await assert.rejects(
    () =>
      performShareHandoff("system_share", message, url, {
        openMessaging: async () => false,
        shareSystem: async () => {
          throw new Error("handoff failed");
        },
        sharedAction: "shared",
      }),
    /handoff failed/,
  );
});
