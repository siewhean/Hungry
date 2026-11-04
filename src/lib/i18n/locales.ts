/** Languages the app is translated into. English is the source and the fallback. */
export const SUPPORTED_LOCALES = ["en", "hi", "ms", "zh"] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: LocaleCode = "en";

/** What the person chose: one language, or "system" to follow the phone. */
export type LanguagePreference = LocaleCode | "system";

/** Each language is named in itself, so a person can find theirs whatever the app is showing. */
export const LOCALE_NATIVE_NAMES: Record<LocaleCode, string> = {
  en: "English",
  hi: "हिन्दी",
  ms: "Bahasa Melayu",
  zh: "简体中文",
};

export function isSupportedLocale(value: unknown): value is LocaleCode {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Maps a BCP 47 tag such as "zh-Hans-SG", "ms_MY" or "hi-IN" to a supported language,
 * or null when the app has no translation for it.
 */
export function matchSupportedLocale(tag: string | null | undefined): LocaleCode | null {
  if (!tag) return null;
  const language = tag.trim().toLowerCase().replace(/_/g, "-").split("-")[0];
  return isSupportedLocale(language) ? language : null;
}
