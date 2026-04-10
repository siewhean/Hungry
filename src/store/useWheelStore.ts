import { create } from "zustand";

import { MockRealtimeChannel } from "@/lib/services/realtime/MockRealtimeChannel";
import type { IRealtimeChannel, PresenceState } from "@/lib/services/realtime/IRealtimeChannel";
import type {
  WheelParty,
  WheelMember,
  WheelEntry,
  WheelChannelEvent,
  WheelSpinMode,
  WheelTriggerMode,
  TriggerValue,
} from "@/types/domain";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function nowIso(): string {
  return new Date().toISOString();
}

// In-memory "server" store keyed by party code — lets the mock simulate
// a second device joining the same party within the same JS runtime.
const mockPartyStore = new Map<string, { party: WheelParty; members: WheelMember[]; entries: WheelEntry[] }>();

// ─── State interface ──────────────────────────────────────────────────────────

interface WheelState {
  party?: WheelParty;
  members: WheelMember[];
  entries: WheelEntry[];
  myMemberId?: string;
  isConnected: boolean;
  connectionError?: string;

  // Actions
  createParty(
    spinMode: WheelSpinMode,
    triggerMode: WheelTriggerMode,
    triggerValue?: TriggerValue
  ): Promise<WheelParty>;
  joinParty(code: string, displayName: string, avatarUrl?: string): Promise<void>;
  addEntry(venueId: string, buildingId: string, label: string, imageUrl: string): void;
  removeEntry(entryId: string): void;
  updateTrigger(triggerMode: WheelTriggerMode, triggerValue?: TriggerValue): void;
  triggerSpin(): void;
  leaveParty(): void;
  reset(): void;

  // Internal — not called directly by UI
  _channel?: IRealtimeChannel;
  _handleEvent(event: WheelChannelEvent): void;
  _handlePresence(state: PresenceState): void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const initialState = {
  party: undefined,
  members: [] as WheelMember[],
  entries: [] as WheelEntry[],
  myMemberId: undefined,
  isConnected: false,
  connectionError: undefined,
  _channel: undefined,
} as const;

export const useWheelStore = create<WheelState>((set, get) => ({
  ...initialState,

  // ── Event handler (channel → store) ────────────────────────────────────────

  _handleEvent(event: WheelChannelEvent) {
    set((state) => {
      switch (event.type) {
        case "entry_added":
          return { entries: [...state.entries, event.entry] };

        case "entry_removed":
          return { entries: state.entries.filter((e) => e.id !== event.entryId) };

        case "spin_triggered": {
          const activeEntryIds = new Set(event.activeEntryIds);
          const activeEntries = state.entries.filter((e) => activeEntryIds.has(e.id));
          const winnerIndex = event.seed % activeEntries.length;
          const winnerEntry = activeEntries[winnerIndex];
          return {
            party: state.party
              ? {
                  ...state.party,
                  status: "spinning",
                  spinSeed: event.seed,
                  spinStartedAt: event.startedAt,
                }
              : state.party,
            // Expose the computed winner entry ID immediately so animation
            // layer can derive final rotation without re-computing.
            entries: state.entries.map((e) =>
              e.id === winnerEntry?.id ? e : e
            ),
          };
        }

        case "round_resolved":
          return {
            party: state.party
              ? {
                  ...state.party,
                  status: "lobby",
                  currentRound: event.nextRound,
                }
              : state.party,
            entries: state.entries.map((e) =>
              e.id === event.eliminatedEntryId
                ? { ...e, isEliminated: true, eliminatedInRound: state.party?.currentRound }
                : e
            ),
          };

        case "party_resolved":
          return {
            party: state.party
              ? { ...state.party, status: "resolved", winnerEntryId: event.winnerEntryId }
              : state.party,
          };

        case "trigger_update":
          return {
            party: state.party
              ? { ...state.party, triggerMode: event.triggerMode, triggerValue: event.triggerValue }
              : state.party,
          };

        case "member_joined":
          if (state.members.some((m) => m.id === event.member.id)) return state;
          return { members: [...state.members, event.member] };

        case "member_left":
          return { members: state.members.filter((m) => m.id !== event.memberId) };

        default:
          return state;
      }
    });
  },

  // ── Presence handler ────────────────────────────────────────────────────────

  _handlePresence(presenceState: PresenceState) {
    set((state) => ({
      members: state.members.map((m) => ({
        ...m,
        isPresent: m.id in presenceState,
      })),
    }));
  },

  // ── createParty ─────────────────────────────────────────────────────────────

  async createParty(spinMode, triggerMode, triggerValue) {
    const partyId = generateId();
    const code = generateCode();
    const memberId = generateId();
    const now = nowIso();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    const party: WheelParty = {
      id: partyId,
      code,
      hostUserId: memberId,
      status: "lobby",
      spinMode,
      triggerMode,
      triggerValue,
      spinDurationMs: 4000,
      currentRound: 1,
      createdAt: now,
      expiresAt,
    };

    const hostMember: WheelMember = {
      id: memberId,
      partyId,
      displayName: "You",
      isHost: true,
      isPresent: true,
      joinedAt: now,
    };

    // Register in mock store so other "devices" can look it up by code.
    mockPartyStore.set(code, { party, members: [hostMember], entries: [] });

    const channel = new MockRealtimeChannel(`party:${partyId}`);
    channel.subscribe(
      (event) => get()._handleEvent(event),
      (state) => get()._handlePresence(state)
    );
    channel.track(hostMember);

    set({
      party,
      members: [hostMember],
      entries: [],
      myMemberId: memberId,
      isConnected: true,
      connectionError: undefined,
      _channel: channel,
    });

    return party;
  },

  // ── joinParty ───────────────────────────────────────────────────────────────

  async joinParty(code, displayName, avatarUrl) {
    const found = mockPartyStore.get(code.toUpperCase());
    if (!found) {
      set({ connectionError: `No party found with code ${code}` });
      return;
    }

    const { party } = found;
    const memberId = generateId();
    const member: WheelMember = {
      id: memberId,
      partyId: party.id,
      displayName,
      avatarUrl,
      isHost: false,
      isPresent: true,
      joinedAt: nowIso(),
    };

    // Register in mock store.
    found.members.push(member);

    const channel = new MockRealtimeChannel(`party:${party.id}`);
    channel.subscribe(
      (event) => get()._handleEvent(event),
      (state) => get()._handlePresence(state)
    );
    channel.track(member);

    // Broadcast join to all other subscribers on this channel.
    channel.broadcast({ type: "member_joined", member });

    set({
      party,
      members: [...found.members],
      entries: [...found.entries],
      myMemberId: memberId,
      isConnected: true,
      connectionError: undefined,
      _channel: channel,
    });
  },

  // ── addEntry ────────────────────────────────────────────────────────────────

  addEntry(venueId, buildingId, label, imageUrl) {
    const { party, myMemberId, entries, _channel } = get();
    if (!party || !myMemberId || !_channel) return;

    const entry: WheelEntry = {
      id: generateId(),
      partyId: party.id,
      addedByMemberId: myMemberId,
      venueId,
      buildingId,
      label,
      imageUrl,
      isEliminated: false,
      position: entries.length,
      addedAt: nowIso(),
    };

    // Optimistic update for the local client.
    set((state) => ({ entries: [...state.entries, entry] }));
    // Broadcast to all others.
    _channel.broadcast({ type: "entry_added", entry });

    // Sync to mock store.
    const storeEntry = mockPartyStore.get(party.code);
    if (storeEntry) storeEntry.entries.push(entry);
  },

  // ── removeEntry ─────────────────────────────────────────────────────────────

  removeEntry(entryId) {
    const { party, _channel } = get();
    if (!party || !_channel) return;

    set((state) => ({ entries: state.entries.filter((e) => e.id !== entryId) }));
    _channel.broadcast({ type: "entry_removed", entryId });

    const storeEntry = mockPartyStore.get(party.code);
    if (storeEntry) {
      storeEntry.entries = storeEntry.entries.filter((e) => e.id !== entryId);
    }
  },

  // ── updateTrigger ───────────────────────────────────────────────────────────

  updateTrigger(triggerMode, triggerValue) {
    const { _channel } = get();
    if (!_channel) return;
    set((state) => ({
      party: state.party ? { ...state.party, triggerMode, triggerValue } : state.party,
    }));
    _channel.broadcast({ type: "trigger_update", triggerMode, triggerValue });
  },

  // ── triggerSpin ─────────────────────────────────────────────────────────────

  triggerSpin() {
    const { party, entries, _channel } = get();
    if (!party || !_channel) return;
    if (party.status !== "lobby") return;

    const activeEntries = entries.filter((e) => !e.isEliminated);
    if (activeEntries.length < 2) return;

    // Mock "server": generate a seed and broadcast to all clients including self.
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) | 0;
    const startedAt = Date.now();
    const activeEntryIds = activeEntries.map((e) => e.id);

    _channel.broadcast({ type: "spin_triggered", seed, startedAt, activeEntryIds });

    // After spin duration, auto-resolve in mock mode.
    const winnerIndex = ((seed % activeEntries.length) + activeEntries.length) % activeEntries.length;
    const winner = activeEntries[winnerIndex];

    setTimeout(() => {
      const currentState = get();
      if (!currentState.party || currentState.party.status !== "spinning") return;

      if (party.spinMode === "classic" || activeEntries.length <= 2) {
        _channel.broadcast({ type: "party_resolved", winnerEntryId: winner.id });
      } else {
        // Elimination mode: eliminate the loser (not the winner) in this round.
        // Loser = any non-winner active entry picked by round-robin.
        const loserIndex = (winnerIndex + 1) % activeEntries.length;
        const loser = activeEntries[loserIndex];
        _channel.broadcast({
          type: "round_resolved",
          eliminatedEntryId: loser.id,
          nextRound: party.currentRound + 1,
        });
      }
    }, party.spinDurationMs + 200);
  },

  // ── leaveParty ──────────────────────────────────────────────────────────────

  leaveParty() {
    const { party, myMemberId, _channel } = get();
    if (_channel) {
      if (party && myMemberId) {
        _channel.broadcast({ type: "member_left", memberId: myMemberId });
      }
      _channel.unsubscribe();
    }
    if (party) {
      MockRealtimeChannel.clearChannel(`party:${party.id}`);
      mockPartyStore.delete(party.code);
    }
    set({ ...initialState });
  },

  // ── reset ───────────────────────────────────────────────────────────────────

  reset() {
    const { _channel, party } = get();
    if (_channel) _channel.unsubscribe();
    if (party) {
      MockRealtimeChannel.clearChannel(`party:${party.id}`);
      mockPartyStore.delete(party.code);
    }
    set({ ...initialState });
  },
}));
