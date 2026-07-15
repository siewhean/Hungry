import assert from "node:assert/strict";
import test from "node:test";

import type {
  ChannelEventHandler,
  IRealtimeChannel,
  PresenceState,
} from "@/lib/services/realtime/IRealtimeChannel";
import { useWheelStore } from "@/store/useWheelStore";
import type { WheelChannelEvent, WheelEntry, WheelMember, WheelParty } from "@/types/domain";

class RecordingChannel implements IRealtimeChannel {
  readonly events: WheelChannelEvent[] = [];

  subscribe(_onEvent: ChannelEventHandler, _onPresence: (state: PresenceState) => void): void {}

  broadcast(event: WheelChannelEvent): void {
    this.events.push(event);
  }

  track(_member: WheelMember): void {}

  unsubscribe(): void {}
}

function waitForResolution(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

function setupParty(
  id: string,
  spinDurationMs = 0,
): {
  channel: RecordingChannel;
  entries: WheelEntry[];
  party: WheelParty;
} {
  const createdAt = "2026-07-15T00:00:00.000Z";
  const party: WheelParty = {
    id,
    code: id.toUpperCase(),
    hostUserId: `${id}-host`,
    status: "lobby",
    spinMode: "classic",
    triggerMode: "manual",
    spinDurationMs,
    currentRound: 1,
    createdAt,
    expiresAt: "2026-07-15T04:00:00.000Z",
  };
  const host: WheelMember = {
    id: party.hostUserId,
    partyId: party.id,
    displayName: "You",
    isHost: true,
    isPresent: true,
    joinedAt: createdAt,
  };
  const entries: WheelEntry[] = ["First option", "Second option"].map((label, index) => ({
    id: `${id}-entry-${index + 1}`,
    partyId: party.id,
    addedByMemberId: host.id,
    venueId: `venue-${index + 1}`,
    buildingId: "building-1",
    label,
    imageUrl: `${index + 1}.jpg`,
    isEliminated: false,
    position: index,
    addedAt: createdAt,
  }));
  const channel = new RecordingChannel();

  useWheelStore.getState().reset();
  useWheelStore.setState({
    party,
    members: [host],
    entries,
    myMemberId: host.id,
    connectionError: null,
    _channel: channel,
  });

  return { channel, entries, party };
}

test("Wheel spin advances from lobby through spinning to a deterministic winner", async () => {
  const { channel, entries } = setupParty("party-one");

  const originalRandom = Math.random;
  Math.random = () => 0.75;
  try {
    useWheelStore.getState().triggerSpin();

    const spinningParty = useWheelStore.getState().party;
    assert.equal(spinningParty?.status, "spinning");
    assert.equal(spinningParty?.spinSeed, 1);
    assert.equal(spinningParty?.winnerEntryId, entries[1]?.id);

    await waitForResolution();

    const resolvedParty = useWheelStore.getState().party;
    assert.equal(resolvedParty?.status, "resolved");
    assert.equal(resolvedParty?.winnerEntryId, entries[1]?.id);
    assert.deepEqual(
      channel.events.map((event) => event.type),
      ["spin_triggered", "party_resolved"],
    );
  } finally {
    Math.random = originalRandom;
    useWheelStore.getState().reset();
  }
});

test("Wheel accepts a zero seed and resolves the first option", async () => {
  const { entries } = setupParty("party-zero");

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    useWheelStore.getState().triggerSpin();
    assert.equal(useWheelStore.getState().party?.spinSeed, 0);

    await waitForResolution();

    assert.equal(useWheelStore.getState().party?.status, "resolved");
    assert.equal(useWheelStore.getState().party?.winnerEntryId, entries[0]?.id);
  } finally {
    Math.random = originalRandom;
    useWheelStore.getState().reset();
  }
});

test("a pending resolution cannot resolve a replacement party", async () => {
  setupParty("first-party");
  useWheelStore.getState().triggerSpin();
  const { party: replacementParty } = setupParty("replacement-party");

  await waitForResolution();

  assert.equal(useWheelStore.getState().party?.id, replacementParty.id);
  assert.equal(useWheelStore.getState().party?.status, "lobby");
  useWheelStore.getState().reset();
});
