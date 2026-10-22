import assert from "node:assert/strict";
import test from "node:test";
import { userProfile } from "@/lib/services/mock/data";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { resetServiceProvider, setServiceProvider } from "@/lib/services/serviceProvider";
import { hungryService as hungryServiceMock } from "@/lib/services/mock/mockService";
import { singaporeMissionWeekKey, useMissionStore } from "./useMissionStore";

test.afterEach(() => {
  useMissionStore.getState()._reset();
  resetServiceProvider();
});

test("mission cache separates account IDs and Singapore Monday boundaries", () => {
  const before = new Date("2026-10-18T15:59:59Z");
  const monday = new Date("2026-10-18T16:00:00Z");
  assert.equal(singaporeMissionWeekKey(userProfile.id, before), `${userProfile.id}:2026-10-12`);
  assert.equal(singaporeMissionWeekKey(userProfile.id, monday), `${userProfile.id}:2026-10-19`);
  assert.notEqual(
    singaporeMissionWeekKey(userProfile.id, monday),
    singaporeMissionWeekKey("guest-user", monday),
  );
});

test("reset rejects a late mission response from the previous account", async () => {
  let finish: (() => void) | undefined;
  const hold = new Promise<void>((resolve) => {
    finish = resolve;
  });
  setServiceProvider({
    mode: "mock",
    repository: {
      ...dataRepositoryMock,
      listActiveMissions: async () => {
        await hold;
        return [];
      },
      listUserMissionProgress: async () => [],
    },
    service: hungryServiceMock,
    similarityScore: () => 1,
  });
  const loading = useMissionStore.getState().loadMissions(userProfile.id);
  useMissionStore.getState()._reset();
  finish?.();
  await loading;
  assert.equal(useMissionStore.getState().isLoaded, false);
  assert.equal(useMissionStore.getState().loadedKey, null);
});
