import { useCallback } from "react";

import { resolveLocale, useLanguageStore } from "@/store/useLanguageStore";

import type { LocaleCode } from "./locales";
import { translate, type MessageKey, type TranslateVars } from "./translate";

/** `t("tab.home")` in the chosen language. Re-renders the screen when the language changes. */
export function useTranslation(): {
  t: (key: MessageKey, vars?: TranslateVars) => string;
  locale: LocaleCode;
} {
  const preference = useLanguageStore((state) => state.preference);
  const locale = resolveLocale(preference);
  const t = useCallback(
    (key: MessageKey, vars?: TranslateVars) => translate(locale, key, vars),
    [locale],
  );
  return { t, locale };
}
