/**
 * useMissionStore — Weekly Discovery Missions
 *
 * Manages the current week's active missions and the user's progress on each.
 * Mission completion triggers Food Cred awards via useFoodCredStore.
 *
 * Production swap:
 *   1. Replace `loadMissions()` with Supabase query on `weekly_missions` + `user_mission_progress`.
 *   2. Replace `incrementProgress()` with a Supabase upsert + RPC for cred award.
 *   3. Weekly rotation handled by a DB cron job / Edge Function.
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

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMissionStore = create<MissionState>()((set, get) => ({
  missions: [],
  progressMap: {},
  isLoaded: false,

  getMission: (missionId) => get().missions.find((m) => m.id === missionId) ?? null,

  getProgress: (missionId) => get().progressMap[missionId] ?? null,

  getCompletedMissions: () => get().missions.filter((m) => !!get().progressMap[m.id]?.completedAt),

  getActiveMissions: () => get().missions.filter((m) => !get().progressMap[m.id]?.completedAt),

  loadMissions: async (userId) => {
    if (get().isLoaded) return;

    const repo = getDataRepository();
    // Production swap: replace with Supabase queries
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

    set({ missions, progressMap, isLoaded: true });
  },

  incrementProgress: async (userId, missionType) => {
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

    set({ progressMap: newProgressMap });

    // TODO (production): supabase.from('user_mission_progress').upsert(...)
  },

  _reset: () => set({ missions: [], progressMap: {}, isLoaded: false }),
}));
