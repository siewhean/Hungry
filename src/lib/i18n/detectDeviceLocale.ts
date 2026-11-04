import { DEFAULT_LOCALE, matchSupportedLocale, type LocaleCode } from "./locales";

/**
 * The phone's language, narrowed to one the app supports. Uses Intl (built into Hermes) so no
 * native module is needed. Falls back to English when the phone language is not supported.
 */
export function detectDeviceLocale(): LocaleCode {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    return matchSupportedLocale(tag) ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
