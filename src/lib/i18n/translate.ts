import { en, type MessageKey } from "./messages/en";
import { hi } from "./messages/hi";
import { ms } from "./messages/ms";
import { zh } from "./messages/zh";
import { DEFAULT_LOCALE, type LocaleCode } from "./locales";

export type { MessageKey };
export type TranslateVars = Record<string, string | number>;

const CATALOGS: Record<LocaleCode, Partial<Record<MessageKey, string>>> = { en, hi, ms, zh };

/**
 * Looks up `key` in the chosen language, falls back to English, and fills `{name}` placeholders.
 * A placeholder with no value is left as written so a missing value shows up in testing.
 */
export function translate(locale: LocaleCode, key: MessageKey, vars?: TranslateVars): string {
  const template = CATALOGS[locale]?.[key] ?? CATALOGS[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
