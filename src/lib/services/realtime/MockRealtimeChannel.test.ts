import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import type { WheelChannelEvent, WheelMember } from "@/types/domain";
import type { IRealtimeChannel } from "./IRealtimeChannel";
import { MockRealtimeChannel } from "./MockRealtimeChannel";

const ID = "channel-under-test";
const LATENCY_PADDING_MS = 120;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function member(id: string): WheelMember {
  return { id, name: `Member ${id}`, isPresent: false } as unknown as WheelMember;
}

afterEach(() => MockRealtimeChannel.clearChannel(ID));

test("the mock satisfies the IRealtimeChannel contract the Supabase channel will implement", () => {
  const channel: IRealtimeChannel = new MockRealtimeChannel(ID);
  for (const method of ["subscribe", "broadcast", "track", "unsubscribe"] as const) {
    assert.equal(typeof channel[method], "function");
  }
});

test("subscribe delivers the presence that already exists, as a copy", () => {
  const first = new MockRealtimeChannel(ID);
  first.simulateJoin(member("a"));

  const late = new MockRealtimeChannel(ID);
  let seen: Record<string, WheelMember> = {};
  late.subscribe(
    () => undefined,
    (state) => {
      seen = state;
    },
  );
  assert.deepEqual(Object.keys(seen), ["a"]);
  assert.equal(seen.a.isPresent, true);
  delete seen.a;
  late.simulateJoin(member("b"));
  assert.ok(
    Object.keys(seen).includes("b"),
    "mutating the delivered copy must not corrupt the shared state",
  );
});

test("broadcast reaches every subscriber on the channel after the simulated latency", async () => {
  const sender = new MockRealtimeChannel(ID);
  const receiver = new MockRealtimeChannel(ID);
  const received: WheelChannelEvent[] = [];
  sender.subscribe(
    () => undefined,
    () => undefined,
  );
  receiver.subscribe(
    (event) => received.push(event),
    () => undefined,
  );

  const event = { type: "member_left", memberId: "x" } as WheelChannelEvent;
  sender.broadcast(event);
  assert.equal(received.length, 0, "delivery is asynchronous");
  await wait(LATENCY_PADDING_MS);
  assert.deepEqual(received, [event]);
});

test("channels are isolated from each other", async () => {
  const one = new MockRealtimeChannel(ID);
  const other = new MockRealtimeChannel(`${ID}-other`);
  const received: WheelChannelEvent[] = [];
  other.subscribe(
    (event) => received.push(event),
    () => undefined,
  );
  one.subscribe(
    () => undefined,
    () => undefined,
  );
  one.broadcast({ type: "member_left", memberId: "x" } as WheelChannelEvent);
  await wait(LATENCY_PADDING_MS);
  assert.deepEqual(received, []);
  MockRealtimeChannel.clearChannel(`${ID}-other`);
});

test("simulateJoin and simulateLeave update presence and broadcast the matching events", async () => {
  const channel = new MockRealtimeChannel(ID);
  const events: WheelChannelEvent[] = [];
  let presence: Record<string, WheelMember> = {};
  channel.subscribe(
    (event) => events.push(event),
    (state) => {
      presence = state;
    },
  );

  channel.simulateJoin(member("a"));
  assert.deepEqual(Object.keys(presence), ["a"]);
  channel.simulateLeave("a");
  assert.deepEqual(Object.keys(presence), []);

  await wait(LATENCY_PADDING_MS);
  assert.deepEqual(
    events.map((event) => event.type),
    ["member_joined", "member_left"],
  );
});

test("track marks the member present and tells the subscriber", async () => {
  const channel = new MockRealtimeChannel(ID);
  let presence: Record<string, WheelMember> = {};
  channel.subscribe(
    () => undefined,
    (state) => {
      presence = state;
    },
  );
  channel.track(member("me"));
  await wait(LATENCY_PADDING_MS);
  assert.equal(presence.me?.isPresent, true);
});

test("after unsubscribe a channel no longer receives events", async () => {
  const channel = new MockRealtimeChannel(ID);
  const sender = new MockRealtimeChannel(ID);
  const received: WheelChannelEvent[] = [];
  channel.subscribe(
    (event) => received.push(event),
    () => undefined,
  );
  channel.unsubscribe();
  sender.broadcast({ type: "member_left", memberId: "x" } as WheelChannelEvent);
  await wait(LATENCY_PADDING_MS);
  assert.deepEqual(received, []);
});

test("clearChannel forgets presence so a new channel starts empty", () => {
  new MockRealtimeChannel(ID).simulateJoin(member("a"));
  MockRealtimeChannel.clearChannel(ID);
  let presence: Record<string, WheelMember> = { stale: member("stale") };
  new MockRealtimeChannel(ID).subscribe(
    () => undefined,
    (state) => {
      presence = state;
    },
  );
  assert.deepEqual(presence, {});
});
