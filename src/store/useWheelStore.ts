import { create } from "zustand";

import { MockRealtimeChannel } from "@/lib/services/realtime/MockRealtimeChannel";
import type { IRealtimeChannel, PresenceState } from "@/lib/services/realtime/IRealtimeChannel";
import type {
  TriggerValue,
  WheelEntry,
  WheelMember,
  WheelParty,
  WheelSpinMode,
  WheelTriggerMode,
  WheelChannelEvent,
  DietaryFlag,
} from "@/types/domain";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { trackAnalyticsEvent } from "@/lib/analytics";

// ─── Mock Global DB ─────────────────────────────────────────────────────────
// In a real app, this is Supabase or Firebase.
const mockPartyStore = new Map<
  string,
  { party: WheelParty; members: WheelMember[]; entries: WheelEntry[] }
>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 12);
}

function nowIso(): string {
  return new Date().toISOString();
}

function appendEntryUnique(entries: WheelEntry[], entry: WheelEntry): WheelEntry[] {
  return entries.some((existing) => existing.id === entry.id) ? entries : [...entries, entry];
}

function dedupeEntries(entries: WheelEntry[]): WheelEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) {
      return false;
    }
    seen.add(entry.id);
    return true;
  });
}

/**
 * The slices on the wheel: not eliminated, one per id. The wheel drawing and the
 * spin math both use this, so slice indices can never diverge.
 */
export function selectActiveWheelEntries(entries: WheelEntry[]): WheelEntry[] {
  return dedupeEntries(entries).filter((entry) => !entry.isEliminated);
}

/**
 * Maps a spin seed onto a slice index. Seeds are non-negative integers so every
 * client derives the same whole-number winner from the broadcast seed.
 */
export function getSpinWinnerIndex(seed: number, entryCount: number): number {
  if (entryCount <= 0) return -1;
  return Math.abs(Math.floor(seed)) % entryCount;
}

function generateSpinSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

// ─── Store Definition ───────────────────────────────────────────────────────

interface WheelState {
  party: WheelParty | null;
  members: WheelMember[];
  entries: WheelEntry[];
  myMemberId: string | null;
  connectionError: string | null;
  _channel: IRealtimeChannel | null;

  // Actions
  createParty(
    spinMode: WheelSpinMode,
    triggerMode: WheelTriggerMode,
    triggerValue?: TriggerValue,
    dietaryPreferences?: DietaryFlag[],
  ): Promise<WheelParty>;
  joinParty(
    code: string,
    displayName: string,
    avatarUrl?: string,
    dietaryPreferences?: DietaryFlag[],
  ): Promise<void>;
  /** `source` tells a stall the diner picked from one the app put on a new wheel. */
  addEntry(
    venueId: string,
    buildingId: string,
    label: string,
    imageUrl: string,
    source?: "manual" | "prefill",
  ): void;
  removeEntry(entryId: string): void;
  triggerSpin(): void;
  /** Settles a finished spin: classic resolves the winner, elimination drops the landed entry. */
  completeSpin(landedEntryId: string): void;
  /** Returns a resolved/spinning party to the lobby so the next spin starts clean. */
  resetSpin(): void;
  leaveParty(): void;
  reset(): void;

  // Internal — not called directly by UI
  _onEvent(event: WheelChannelEvent): void;
  _onPresence(state: PresenceState): void;
}

const initialState = {
  party: null,
  members: [],
  entries: [],
  myMemberId: null,
  connectionError: null,
  _channel: null,
};

export const useWheelStore = create<WheelState>((set, get) => ({
  ...initialState,

  // ── createParty ────────────────────────────────────────────────────────────

  async createParty(spinMode, triggerMode, triggerValue, dietaryPreferences) {
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
      dietaryPreferences,
      joinedAt: now,
    };

    // Register in mock store so other "devices" can look it up by code.
    mockPartyStore.set(code, { party, members: [hostMember], entries: [] });

    const channel = new MockRealtimeChannel(`party:${partyId}`);
    // A closed wheel's channel can still deliver one late callback; it must not touch the next one.
    channel.subscribe(
      (event) => {
        if (get()._channel === channel) get()._onEvent(event);
      },
      (state) => {
        if (get()._channel === channel) get()._onPresence(state);
      },
    );
    channel.track(hostMember);

    set({
      party,
      members: [hostMember],
      entries: [],
      myMemberId: memberId,
      _channel: channel,
    });
    return party;
  },

  // ── joinParty ───────────────────────────────────────────────────────────────

  async joinParty(code, displayName, avatarUrl, dietaryPreferences) {
    if (!FEATURE_FLAGS.wheelPartyEnabled) {
      set({ connectionError: "Group spins are coming soon." });
      return;
    }
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
      dietaryPreferences,
      isHost: false,
      isPresent: true,
      joinedAt: nowIso(),
    };

    const channel = new MockRealtimeChannel(`party:${party.id}`);
    // A closed wheel's channel can still deliver one late callback; it must not touch the next one.
    channel.subscribe(
      (event) => {
        if (get()._channel === channel) get()._onEvent(event);
      },
      (state) => {
        if (get()._channel === channel) get()._onPresence(state);
      },
    );
    channel.track(member);

    // Persist to mock DB
    found.members.push(member);

    set({
      party,
      members: found.members,
      entries: dedupeEntries(found.entries),
      myMemberId: memberId,
      _channel: channel,
    });
  },

  // ── addEntry ───────────────────────────────────────────────────────────────

  addEntry(venueId, buildingId, label, imageUrl, source = "manual") {
    const { party, myMemberId, entries, _channel } = get();
    if (!party || !myMemberId || !_channel) return;

    if (party.maxEntriesPerMember) {
      const myEntriesCount = entries.filter((e) => e.addedByMemberId === myMemberId).length;
      if (myEntriesCount >= party.maxEntriesPerMember) {
        set({
          connectionError: `Limit reached: Max ${party.maxEntriesPerMember} entries per person.`,
        });
        return;
      }
    }

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

    // Broadcast to others
    _channel.broadcast({ type: "entry_added", entry });

    // Update local state immediately
    set((state) => ({ entries: appendEntryUnique(state.entries, entry) }));
    trackAnalyticsEvent("wheel_option_added", {
      party_id: party.id,
      entry_count: get().entries.length,
      source,
    });
  },

  // ── removeEntry ────────────────────────────────────────────────────────────

  removeEntry(entryId) {
    const { _channel } = get();
    if (!_channel) return;

    _channel.broadcast({ type: "entry_removed", entryId });
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== entryId),
    }));
  },

  // ── triggerSpin ─────────────────────────────────────────────────────────────

  triggerSpin() {
    const { party, entries, _channel } = get();
    if (!party || !_channel) return;

    const seed = generateSpinSeed();
    const startedAt = Date.now();
    const activeEntryIds = selectActiveWheelEntries(entries).map((e) => e.id);

    _channel.broadcast({
      type: "spin_triggered",
      seed,
      startedAt,
      activeEntryIds,
    });

    set((state) => ({
      party: state.party
        ? {
            ...state.party,
            status: "spinning",
            spinSeed: seed,
            spinStartedAt: startedAt,
          }
        : null,
    }));
    trackAnalyticsEvent("wheel_spun", {
      party_id: party.id,
      spin_mode: party.spinMode,
      option_count: activeEntryIds.length,
    });
  },

  // ── completeSpin ────────────────────────────────────────────────────────────

  completeSpin(landedEntryId) {
    const { party, entries, myMemberId, _channel } = get();
    if (!party || party.status !== "spinning") return;
    if (!entries.some((e) => e.id === landedEntryId && !e.isEliminated)) return;

    const isHost = party.hostUserId === myMemberId;

    if (party.spinMode === "elimination") {
      const remaining = entries.filter((e) => !e.isEliminated && e.id !== landedEntryId);
      const nextRound = party.currentRound + 1;
      const winnerEntryId = remaining.length === 1 ? remaining[0].id : undefined;

      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === landedEntryId ? { ...e, isEliminated: true } : e,
        ),
        party: state.party
          ? {
              ...state.party,
              status: winnerEntryId ? "resolved" : "lobby",
              currentRound: nextRound,
              winnerEntryId,
              spinSeed: undefined,
              spinStartedAt: undefined,
            }
          : null,
      }));

      if (isHost && _channel) {
        _channel.broadcast({ type: "round_resolved", eliminatedEntryId: landedEntryId, nextRound });
        if (winnerEntryId) _channel.broadcast({ type: "party_resolved", winnerEntryId });
      }
      return;
    }

    set((state) => ({
      party: state.party
        ? {
            ...state.party,
            status: "resolved",
            winnerEntryId: landedEntryId,
            spinSeed: undefined,
            spinStartedAt: undefined,
          }
        : null,
    }));
    if (isHost && _channel) {
      _channel.broadcast({ type: "party_resolved", winnerEntryId: landedEntryId });
    }
  },

  // ── resetSpin ───────────────────────────────────────────────────────────────

  resetSpin() {
    set((state) => ({
      party: state.party
        ? {
            ...state.party,
            status: "lobby",
            winnerEntryId: undefined,
            spinSeed: undefined,
            spinStartedAt: undefined,
          }
        : null,
    }));
  },

  // ── leaveParty ──────────────────────────────────────────────────────────────

  leaveParty() {
    const { _channel, party, myMemberId } = get();
    if (_channel) _channel.unsubscribe();
    if (party) {
      // Drop this member from the shared party; the last one out (or the host) removes it.
      const found = mockPartyStore.get(party.code);
      if (found) {
        found.members = found.members.filter((member) => member.id !== myMemberId);
        if (party.hostUserId === myMemberId || found.members.length === 0) {
          MockRealtimeChannel.clearChannel(`party:${party.id}`);
          mockPartyStore.delete(party.code);
        }
      }
    }
    set({ ...initialState });
  },

  // ── _onEvent (Broadcast Receiver) ──────────────────────────────────────────

  _onEvent(event) {
    switch (event.type) {
      case "entry_added":
        set((state) => ({
          entries: appendEntryUnique(state.entries, event.entry),
        }));
        break;
      case "entry_removed":
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== event.entryId),
        }));
        break;
      case "spin_triggered":
        set((state) => ({
          party: state.party
            ? {
                ...state.party,
                status: "spinning",
                spinSeed: event.seed,
                spinStartedAt: event.startedAt,
              }
            : null,
        }));
        break;
      case "round_resolved":
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === event.eliminatedEntryId ? { ...e, isEliminated: true } : e,
          ),
          party: state.party
            ? {
                ...state.party,
                status: state.party.status === "resolved" ? "resolved" : "lobby",
                currentRound: event.nextRound,
                spinSeed: undefined,
                spinStartedAt: undefined,
              }
            : null,
        }));
        break;
      case "party_resolved":
        set((state) => ({
          party: state.party
            ? {
                ...state.party,
                status: "resolved",
                winnerEntryId: event.winnerEntryId,
              }
            : null,
        }));
        break;
      case "trigger_update":
        set((state) => ({
          party: state.party
            ? {
                ...state.party,
                triggerMode: event.triggerMode,
                triggerValue: event.triggerValue,
              }
            : null,
        }));
        break;
    }
  },

  // ── _onPresence (Member Sync) ───────────────────────────────────────────────

  _onPresence(state) {
    const allMembers = Object.values(state).flat() as WheelMember[];
    set({ members: allMembers });
  },

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
