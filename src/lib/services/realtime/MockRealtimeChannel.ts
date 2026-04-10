/**
 * MockRealtimeChannel
 *
 * Mirrors the IRealtimeChannel API using setTimeout to simulate broadcast
 * latency (~50 ms). Allows the full Hungry Wheel UI to be demo-able on a
 * single device without a live Supabase project.
 *
 * Replace with SupabaseRealtimeChannel when the backend is live — both
 * implement the same IRealtimeChannel interface.
 */

import type { WheelChannelEvent, WheelMember } from "@/types/domain";
import type {
  ChannelEventHandler,
  IRealtimeChannel,
  PresenceState,
} from "./IRealtimeChannel";

const SIMULATED_LATENCY_MS = 50;

/** Shared in-memory bus: channelId → list of subscriber callbacks */
const eventBus = new Map<string, Set<ChannelEventHandler>>();
const presenceBus = new Map<string, PresenceState>();

export class MockRealtimeChannel implements IRealtimeChannel {
  private readonly channelId: string;
  private eventHandler?: ChannelEventHandler;
  private presenceHandler?: (state: PresenceState) => void;

  constructor(channelId: string) {
    this.channelId = channelId;
    if (!eventBus.has(channelId)) eventBus.set(channelId, new Set());
    if (!presenceBus.has(channelId)) presenceBus.set(channelId, {});
  }

  subscribe(
    onEvent: ChannelEventHandler,
    onPresence: (state: PresenceState) => void
  ): void {
    this.eventHandler = onEvent;
    this.presenceHandler = onPresence;
    eventBus.get(this.channelId)!.add(onEvent);
    // Deliver current presence state immediately
    onPresence({ ...presenceBus.get(this.channelId)! });
  }

  broadcast(event: WheelChannelEvent): void {
    const subscribers = eventBus.get(this.channelId);
    if (!subscribers) return;
    setTimeout(() => {
      subscribers.forEach((handler) => handler(event));
    }, SIMULATED_LATENCY_MS);
  }

  track(member: WheelMember): void {
    const state = presenceBus.get(this.channelId)!;
    state[member.id] = { ...member, isPresent: true };
    presenceBus.set(this.channelId, state);
    // Notify all presence handlers
    setTimeout(() => {
      eventBus.get(this.channelId)?.forEach((_, _h) => {
        // presence changes go through the presenceHandler stored on each instance
      });
      this._notifyPresence({ ...state });
    }, SIMULATED_LATENCY_MS);
  }

  /** Simulate another user joining — useful for demos and testing. */
  simulateJoin(member: WheelMember): void {
    const state = presenceBus.get(this.channelId)!;
    state[member.id] = { ...member, isPresent: true };
    presenceBus.set(this.channelId, state);
    this.broadcast({ type: "member_joined", member });
    this._notifyPresence({ ...state });
  }

  /** Simulate another user leaving. */
  simulateLeave(memberId: string): void {
    const state = presenceBus.get(this.channelId)!;
    delete state[memberId];
    presenceBus.set(this.channelId, state);
    this.broadcast({ type: "member_left", memberId });
    this._notifyPresence({ ...state });
  }

  unsubscribe(): void {
    if (this.eventHandler) {
      eventBus.get(this.channelId)?.delete(this.eventHandler);
    }
    // Remove from presence
    const state = presenceBus.get(this.channelId) ?? {};
    presenceBus.set(this.channelId, state);
  }

  private _notifyPresence(state: PresenceState): void {
    this.presenceHandler?.(state);
  }

  /** Clear all in-memory state for a channel (e.g. after party resolves). */
  static clearChannel(channelId: string): void {
    eventBus.delete(channelId);
    presenceBus.delete(channelId);
  }
}
