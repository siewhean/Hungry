import { create } from "zustand";

import type { MissionType, UserMissionProgress, WeeklyMission } from "@/types/domain";

interface ProductionMissionState {
  missions: WeeklyMission[];
  progressMap: Record<string, UserMissionProgress>;
  isLoaded: boolean;
  getMission: (_missionId: string) => WeeklyMission | null;
  getProgress: (_missionId: string) => UserMissionProgress | null;
  getCompletedMissions: () => WeeklyMission[];
  getActiveMissions: () => WeeklyMission[];
  loadMissions: (_userId: string) => Promise<void>;
  incrementProgress: (_userId: string, _missionType: MissionType) => Promise<void>;
  _reset: () => void;
}

export const useMissionStore = create<ProductionMissionState>()(() => ({
  missions: [],
  progressMap: {},
  isLoaded: true,
  getMission: () => null,
  getProgress: () => null,
  getCompletedMissions: () => [],
  getActiveMissions: () => [],
  loadMissions: async () => undefined,
  incrementProgress: async () => undefined,
  _reset: () => undefined,
}));
