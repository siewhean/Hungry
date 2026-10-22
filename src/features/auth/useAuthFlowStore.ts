import { create } from "zustand";

/** Completion is a receipt from a successful service call, never a deep-link claim. */
export const useAuthFlowStore = create<{
  passwordResetCompleted: boolean;
  setPasswordResetCompleted: (completed: boolean) => void;
}>((set) => ({
  passwordResetCompleted: false,
  setPasswordResetCompleted: (passwordResetCompleted) => set({ passwordResetCompleted }),
}));
