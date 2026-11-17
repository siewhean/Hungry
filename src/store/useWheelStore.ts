import { create, type StateCreator } from "zustand";

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
  return entries.some((existing) => existing.venueId === entry.venueId)
    ? entries
    : [...entries, entry];
}

function dedupeEntries(entries: WheelEntry[]): WheelEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.venueId)) {
      return false;
    }
    seen.add(entry.venueId);
    return true;
  });
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
  addEntry(venueId: string, buildingId: string, label: string, imageUrl: string): void;
  removeEntry(entryId: string): void;
  updateTrigger(triggerMode: WheelTriggerMode, triggerValue?: TriggerValue): void;
  updateEntryLimit(limit: number): void;
  triggerSpin(): void;
  finishSpin(startedAt: number): void;
  prepareNextSpin(): void;
  leaveParty(): void;
  reset(): void;
  closeParty(): void;

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

const wheelState: StateCreator<WheelState> = (set, get) => ({
  ...initialState,

  // ── createParty ────────────────────────────────────────────────────────────

  async createParty(spinMode, triggerMode, triggerValue, dietaryPreferences) {
    get().reset();
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
    channel.subscribe(
      (event) => get()._onEvent(event),
      (state) => get()._onPresence(state),
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

    get().reset();
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
    channel.subscribe(
      (event) => get()._onEvent(event),
      (state) => get()._onPresence(state),
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

  addEntry(venueId, buildingId, label, imageUrl) {
    const { party, myMemberId, entries, _channel } = get();
    if (
      !party ||
      !myMemberId ||
      !_channel ||
      party.status !== "lobby" ||
      mockPartyStore.get(party.code)?.party.status !== "lobby" ||
      entries.some((entry) => entry.venueId === venueId)
    )
      return;

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

  // ── updateTrigger ──────────────────────────────────────────────────────────

  updateTrigger(triggerMode, triggerValue) {
    const { _channel } = get();
    if (!_channel) return;

    set((state) => ({
      party: state.party ? { ...state.party, triggerMode, triggerValue } : state.party,
    }));
    _channel.broadcast({ type: "trigger_update", triggerMode, triggerValue });
  },

  updateEntryLimit(limit) {
    const { _channel } = get();
    if (!_channel) return;
    set((state) => ({
      party: state.party ? { ...state.party, maxEntriesPerMember: limit } : state.party,
    }));
  },

  // ── triggerSpin ─────────────────────────────────────────────────────────────

  triggerSpin() {
    const { party, entries, _channel } = get();
    if (!party || !_channel) return;

    if (party.status === "spinning" || party.hostUserId !== get().myMemberId) return;
    const candidates = dedupeEntries(entries.filter((entry) => !entry.isEliminated));
    if (candidates.length < 2) return;
    const seed = Math.min(candidates.length - 1, Math.floor(Math.random() * candidates.length));
    const startedAt = Date.now();
    const activeEntryIds = entries.filter((e) => !e.isEliminated).map((e) => e.id);

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
            winnerEntryId: candidates[seed].id,
          }
        : null,
    }));
  },

  finishSpin(startedAt) {
    const { party, _channel } = get();
    if (
      !party ||
      party.status !== "spinning" ||
      party.spinStartedAt !== startedAt ||
      !party.winnerEntryId
    )
      return;
    set({ party: { ...party, status: "resolved" } });
    _channel?.broadcast({ type: "party_resolved", winnerEntryId: party.winnerEntryId });
  },

  prepareNextSpin() {
    const { party, myMemberId, _channel } = get();
    if (!party || party.status !== "resolved" || party.hostUserId !== myMemberId) return;
    const nextRound = party.currentRound + 1;
    set({
      party: {
        ...party,
        status: "lobby",
        currentRound: nextRound,
        spinSeed: undefined,
        spinStartedAt: undefined,
        winnerEntryId: undefined,
      },
    });
    _channel?.broadcast({ type: "round_prepared", nextRound });
  },

  // ── leaveParty ──────────────────────────────────────────────────────────────

  leaveParty() {
    const { _channel } = get();
    if (_channel) _channel.unsubscribe();
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
        if ((get().party?.spinStartedAt ?? -1) >= event.startedAt) break;
        set((state) => ({
          party: state.party
            ? {
                ...state.party,
                status: "spinning",
                spinSeed: event.seed,
                spinStartedAt: event.startedAt,
                winnerEntryId:
                  event.activeEntryIds[
                    Math.min(event.activeEntryIds.length - 1, Math.floor(event.seed))
                  ],
              }
            : null,
        }));
        break;
      case "party_resolved":
        if (
          get().party?.status !== "spinning" ||
          get().party?.winnerEntryId !== event.winnerEntryId
        )
          break;
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
      case "round_prepared":
        if (!get().party || event.nextRound <= get().party!.currentRound) break;
        set((state) => ({
          party: state.party
            ? {
                ...state.party,
                status: "lobby",
                currentRound: event.nextRound,
                spinSeed: undefined,
                spinStartedAt: undefined,
                winnerEntryId: undefined,
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
    get()._channel?.unsubscribe();
    set({ ...initialState });
  },

  closeParty() {
    const { party, myMemberId } = get();
    if (!party || party.hostUserId !== myMemberId) return;
    MockRealtimeChannel.clearChannel(`party:${party.id}`);
    mockPartyStore.delete(party.code);
    get().reset();
  },
});

// Merge only the rows changed by this participant, preserving concurrent changes.
function mergeChangedRows<T extends { id: string }>(current: T[], previous: T[], next: T[]): T[] {
  const before = new Map(previous.map((row) => [row.id, row]));
  const after = new Map(next.map((row) => [row.id, row]));
  const removed = new Set(previous.filter((row) => !after.has(row.id)).map((row) => row.id));
  const changed = new Map(
    next.filter((row) => before.get(row.id) !== row).map((row) => [row.id, row]),
  );
  const retained = current
    .filter((row) => !removed.has(row.id))
    .map((row) => changed.get(row.id) ?? row);
  const ids = new Set(retained.map((row) => row.id));
  return [...retained, ...next.filter((row) => !ids.has(row.id) && changed.has(row.id))];
}

// Each store represents a participant; the shared mock record is the lookup snapshot.
export function createWheelStore() {
  const store = create<WheelState>(wheelState);
  store.subscribe((state, previous) => {
    if (!state.party) return;
    const record = mockPartyStore.get(state.party.code);
    if (!record) return;
    // Entry/presence updates from a lagging participant must not restore its old
    // party phase. A delayed previous-round event must not regress it either.
    if (state.party !== previous.party && state.party.currentRound >= record.party.currentRound) {
      const changed = Object.fromEntries(
        Object.entries(state.party).filter(
          ([key, value]) => value !== previous.party?.[key as keyof WheelParty],
        ),
      ) as Partial<WheelParty>;
      const phaseOrder = { lobby: 0, spinning: 1, resolved: 2 };
      if (
        state.party.currentRound === record.party.currentRound &&
        phaseOrder[state.party.status] < phaseOrder[record.party.status]
      ) {
        delete changed.status;
        delete changed.spinSeed;
        delete changed.spinStartedAt;
        delete changed.winnerEntryId;
      }
      record.party = { ...record.party, ...changed };
    }
    if (state.entries !== previous.entries) {
      record.entries = mergeChangedRows(record.entries, previous.entries, state.entries);
    }
    if (state.members !== previous.members) {
      record.members = mergeChangedRows(record.members, previous.members, state.members);
    }
  });
  return store;
}

export const useWheelStore = createWheelStore();
