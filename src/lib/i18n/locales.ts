/** Languages the app is translated into. English is the source and the fallback. */
export const SUPPORTED_LOCALES = ["en", "hi", "ms", "zh"] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: LocaleCode = "en";

/**
 * Languages offered to people. Only the tab bars and Settings are translated so far, so the
 * others stay hidden (sh, 2026-11-04) until every screen is: a phone set to Malay gets English,
 * and Settings shows no Language row. EXPO_PUBLIC_ENABLE_EXTRA_LANGUAGES=1 offers all of them.
 */
const DEFAULT_OFFERED: readonly LocaleCode[] =
  process.env.EXPO_PUBLIC_ENABLE_EXTRA_LANGUAGES === "1" ? SUPPORTED_LOCALES : [DEFAULT_LOCALE];
let offeredLocales: readonly LocaleCode[] = DEFAULT_OFFERED;

export function getOfferedLocales(): readonly LocaleCode[] {
  return offeredLocales;
}

/** Tests only: offer other languages; `undefined` restores the build's list. */
export function setOfferedLocalesForTests(locales: readonly LocaleCode[] | undefined): void {
  offeredLocales = locales ?? DEFAULT_OFFERED;
}

/** A language that is not offered shows as English. */
export function offeredLocale(code: LocaleCode): LocaleCode {
  return offeredLocales.includes(code) ? code : DEFAULT_LOCALE;
}

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
