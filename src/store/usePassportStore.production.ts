import { create } from "zustand";

import type {
  EarnedPassportStamp,
  PassportCelebrateMarker,
  PassportContributionStats,
  PassportNextStamp,
  PassportProgressEvent,
  PassportStamp,
  UserPassportProgress,
} from "@/types/domain";

interface ProductionPassportState {
  progressMap: Record<string, UserPassportProgress>;
  celebratedStampIds: Record<string, boolean>;
  isComputed: boolean;
  stamps: PassportStamp[];
  events: PassportProgressEvent[];
  isLoaded: boolean;
  getProgress: (_categoryId: string) => UserPassportProgress | null;
  getEarnedCategories: () => UserPassportProgress[];
  getEarnedStamps: () => EarnedPassportStamp[];
  getNextStamp: () => PassportNextStamp | null;
  getNewlyEarnedUncelebratedStamp: () => EarnedPassportStamp | null;
  getCelebrateMarker: () => PassportCelebrateMarker | null;
  getPortfolioContributionStats: () => PassportContributionStats;
  computeProgress: (_triedStallIds: string[]) => void;
  markStampCelebrated: (_stampId: string) => void;
  loadStamps: () => Promise<void>;
  loadEvents: (_categoryId?: string) => Promise<void>;
  recordContribution: (
    _userId: string,
    _eventType: PassportProgressEvent["eventType"],
    _referenceId?: string,
  ) => Promise<void>;
  _reset: () => void;
}

const emptyContributionStats: PassportContributionStats = {
  stallsSubmitted: 0,
  portfolioItemsAdded: 0,
  publicPortfoliosPublished: 0,
  trailsCompleted: 0,
  recentEvents: [],
};

export const usePassportStore = create<ProductionPassportState>()(() => ({
  progressMap: {},
  celebratedStampIds: {},
  isComputed: true,
  stamps: [],
  events: [],
  isLoaded: true,
  getProgress: () => null,
  getEarnedCategories: () => [],
  getEarnedStamps: () => [],
  getNextStamp: () => null,
  getNewlyEarnedUncelebratedStamp: () => null,
  getCelebrateMarker: () => null,
  getPortfolioContributionStats: () => emptyContributionStats,
  computeProgress: () => undefined,
  markStampCelebrated: () => undefined,
  loadStamps: async () => undefined,
  loadEvents: async () => undefined,
  recordContribution: async () => undefined,
  _reset: () => undefined,
}));
