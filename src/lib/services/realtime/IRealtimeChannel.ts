import type { WheelChannelEvent, WheelMember } from "@/types/domain";

export type ChannelEventHandler = (event: WheelChannelEvent) => void;
export type PresenceState = Record<string, WheelMember>;

export interface IRealtimeChannel {
  /** Subscribe to broadcast events and presence changes. */
  subscribe(onEvent: ChannelEventHandler, onPresence: (state: PresenceState) => void): void;
  /** Broadcast an event to all subscribers on this channel. */
  broadcast(event: WheelChannelEvent): void;
  /** Track this client's presence in the channel. */
  track(member: WheelMember): void;
  /** Remove this client from presence and unsubscribe. */
  unsubscribe(): void;
}
