import { getAccountGeneration } from "@/lib/security/accountScope";
import { create } from "zustand";

import { getHungryService } from "@/lib/services/serviceProvider";
import type { SubmitUserStallSubmissionInput, UserStallSubmission } from "@/types/domain";

let storeEpoch = 0;
const accountStamp = () => `${getAccountGeneration()}:${storeEpoch}`;

interface StallSubmissionState {
  submissions: UserStallSubmission[];
  isLoaded: boolean;
  isSubmitting: boolean;
  loadSubmissions: () => Promise<void>;
  submitStall: (input: SubmitUserStallSubmissionInput) => Promise<UserStallSubmission>;
  _reset: () => void;
}

export const useStallSubmissionStore = create<StallSubmissionState>()((set, get) => ({
  submissions: [],
  isLoaded: false,
  isSubmitting: false,

  loadSubmissions: async () => {
    const stamp = accountStamp();
    const submissions = await getHungryService().contributions.listMyDiscoveredStalls();
    if (stamp === accountStamp()) set({ submissions, isLoaded: true });
  },

  submitStall: async (input) => {
    const stamp = accountStamp();
    if (get().isSubmitting) {
      throw new Error("A stall submission is already in progress.");
    }

    set({ isSubmitting: true });
    try {
      const submission = await getHungryService().contributions.submitDiscoveredStall(input);
      if (stamp !== accountStamp()) throw new Error("Your account changed.");
      set((state) => ({
        submissions: [
          submission,
          ...state.submissions.filter((candidate) => candidate.id !== submission.id),
        ],
        isLoaded: true,
        isSubmitting: false,
      }));
      return submission;
    } catch (error) {
      if (stamp === accountStamp()) set({ isSubmitting: false });
      throw error;
    }
  },

  _reset: () => {
    storeEpoch++;
    set({ submissions: [], isLoaded: false, isSubmitting: false });
  },
}));
