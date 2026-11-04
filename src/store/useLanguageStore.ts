import { create } from "zustand";
import { persist } from "zustand/middleware";

import { detectDeviceLocale } from "@/lib/i18n/detectDeviceLocale";
import {
  isSupportedLocale,
  offeredLocale,
  type LanguagePreference,
  type LocaleCode,
} from "@/lib/i18n/locales";

import { hungryPersistStorage } from "./persistStorage";

interface LanguageState {
  /** "system" follows the phone's language; anything else is the person's own pick. */
  preference: LanguagePreference;
  setPreference: (preference: LanguagePreference) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      preference: "system",
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: "hungry-language",
      storage: hungryPersistStorage,
      partialize: (state) => ({ preference: state.preference }),
      // A stored value from a build that supported other languages falls back to the phone's.
      merge: (persisted, current) => {
        const stored = (persisted as Partial<LanguageState> | undefined)?.preference;
        return {
          ...current,
          preference: stored === "system" || isSupportedLocale(stored) ? stored : "system",
        };
      },
    },
  ),
);

/** The language to show right now. */
export function resolveLocale(preference: LanguagePreference): LocaleCode {
  return offeredLocale(preference === "system" ? detectDeviceLocale() : preference);
}

/** For code outside React (toasts, alerts). Components should use `useTranslation`. */
export function getActiveLocale(): LocaleCode {
  return resolveLocale(useLanguageStore.getState().preference);
}
