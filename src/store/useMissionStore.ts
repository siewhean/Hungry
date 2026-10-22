/**
 * useMissionStore — Weekly Discovery Missions
 *
 * Manages the current week's active missions and the user's progress on each.
 * Mission completion triggers Food Cred awards via useFoodCredStore.
 *
 * Repository-backed: mock mode keeps local demo state, while Supabase mode
 * reads `weekly_missions` / `user_mission_progress` and increments through RPC.
 */

import { create } from "zustand";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useFoodCredStore } from "./useFoodCredStore";
import type { MissionType, UserMissionProgress, WeeklyMission } from "@/types/domain";

// ─── State Interface ──────────────────────────────────────────────────────────

interface MissionState {
  missions: WeeklyMission[];
  /** Map of missionId → progress */
  progressMap: Record<string, UserMissionProgress>;
  isLoaded: boolean;
  loadedKey: string | null;
  loadError: boolean;

  // Queries
  getMission: (missionId: string) => WeeklyMission | null;
  getProgress: (missionId: string) => UserMissionProgress | null;
  /** Missions the user has fully completed this week */
  getCompletedMissions: () => WeeklyMission[];
  /** Missions still in progress */
  getActiveMissions: () => WeeklyMission[];

  // Actions
  loadMissions: (userId: string) => Promise<void>;
  /**
   * Increment progress for all active missions matching the given missionType.
   * Automatically completes missions and awards cred when the threshold is reached.
   */
  incrementProgress: (userId: string, missionType: MissionType) => Promise<void>;
  _reset: () => void;
}

export function singaporeMissionWeekKey(userId: string, now = new Date()): string {
  const singapore = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = (singapore.getUTCDay() + 6) % 7;
  singapore.setUTCDate(singapore.getUTCDate() - day);
  return `${userId}:${singapore.toISOString().slice(0, 10)}`;
}
let missionGeneration = 0;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMissionStore = create<MissionState>()((set, get) => ({
  missions: [],
  progressMap: {},
  isLoaded: false,
  loadedKey: null,
  loadError: false,

  getMission: (missionId) => get().missions.find((m) => m.id === missionId) ?? null,

  getProgress: (missionId) => get().progressMap[missionId] ?? null,

  getCompletedMissions: () => get().missions.filter((m) => !!get().progressMap[m.id]?.completedAt),

  getActiveMissions: () => get().missions.filter((m) => !get().progressMap[m.id]?.completedAt),

  loadMissions: async (userId) => {
    const loadedKey = singaporeMissionWeekKey(userId);
    if (get().isLoaded && get().loadedKey === loadedKey) return;
    const generation = ++missionGeneration;
    set({ missions: [], progressMap: {}, isLoaded: false, loadedKey, loadError: false });
    try {
      const repo = getDataRepository();
      const missions: WeeklyMission[] = (await repo.listActiveMissions?.()) ?? [];

      const progressList: UserMissionProgress[] =
        (await repo.listUserMissionProgress?.(userId)) ?? [];

      const progressMap: Record<string, UserMissionProgress> = {};
      for (const p of progressList) {
        progressMap[p.missionId] = p;
      }

      // Seed 0-progress entries for missions with no existing record
      for (const m of missions) {
        if (!progressMap[m.id]) {
          progressMap[m.id] = { userId, missionId: m.id, currentCount: 0 };
        }
      }

      if (generation !== missionGeneration) return;
      set({ missions, progressMap, isLoaded: true });
    } catch (error) {
      if (generation === missionGeneration) set({ loadError: true });
      throw error;
    }
  },

  incrementProgress: async (userId, missionType) => {
    await get().loadMissions(userId);
    const generation = missionGeneration;
    const repo = getDataRepository();
    if (repo.incrementMissionProgress) {
      await repo.incrementMissionProgress(userId, missionType);
      const [missions, progressList, cred] = await Promise.all([
        repo.listActiveMissions?.() ?? Promise.resolve(get().missions),
        repo.listUserMissionProgress?.(userId) ?? Promise.resolve(Object.values(get().progressMap)),
        repo.getUserFoodCred?.(userId) ?? Promise.resolve(null),
      ]);
      const progressMap: Record<string, UserMissionProgress> = {};
      for (const progress of progressList) {
        progressMap[progress.missionId] = progress;
      }
      if (generation !== missionGeneration) return;
      set({ missions, progressMap, isLoaded: true });
      if (cred) {
        useFoodCredStore.setState({
          totalPoints: cred.totalPoints,
          levelIndex: cred.levelIndex,
          isLoaded: true,
        });
      }
      return;
    }

    const { missions, progressMap } = get();
    const matchingMissions = missions.filter(
      (m) => m.missionType === missionType && !progressMap[m.id]?.completedAt,
    );

    if (matchingMissions.length === 0) return;

    const newProgressMap = { ...progressMap };

    for (const mission of matchingMissions) {
      const existing = newProgressMap[mission.id] ?? {
        userId,
        missionId: mission.id,
        currentCount: 0,
      };

      const newCount = existing.currentCount + 1;
      const isNowComplete = newCount >= mission.requirementCount;

      const updated: UserMissionProgress = {
        ...existing,
        currentCount: newCount,
        completedAt: isNowComplete ? new Date().toISOString() : existing.completedAt,
      };

      newProgressMap[mission.id] = updated;

      if (isNowComplete && !existing.completedAt) {
        // Award mission completion cred
        await useFoodCredStore.getState().awardPoints("mission_completed", mission.id);
        // Award mission-specific bonus on top (via direct totalPoints bump)
        if (mission.rewardType === "food_cred" && mission.rewardValue > 0) {
          useFoodCredStore.setState((s) => ({
            totalPoints: s.totalPoints + mission.rewardValue,
            lastEarnedPoints: mission.rewardValue,
          }));
        }

        trackAnalyticsEvent("mission_completed", {
          mission_id: mission.id,
          mission_title: mission.title,
          reward_type: mission.rewardType,
          reward_value: mission.rewardValue,
        });
      }
    }

    if (generation === missionGeneration) set({ progressMap: newProgressMap });
  },

  _reset: () => {
    missionGeneration += 1;
    set({ missions: [], progressMap: {}, isLoaded: false, loadedKey: null, loadError: false });
  },
}));
