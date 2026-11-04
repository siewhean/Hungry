import { en } from "@/lib/i18n/messages/en";

const COPY = en as Record<string, string>;

/**
 * Source-contract tests check the words a screen shows. Screens now read their words through
 * `t("key")`, so this puts the English text back into the source before a test matches on it:
 * `label={t("settings.row.contact")}` reads as `label="Contact us"`.
 */
export function withEnglishCopy(source: string): string {
  const text = (key: string, whole: string) => (key in COPY ? JSON.stringify(COPY[key]) : whole);
  return source
    .replace(/=\{t\("([\w.]+)"\)\}/g, (whole, key: string) => `=${text(key, whole)}`)
    .replace(/\bt\("([\w.]+)"\)/g, (whole, key: string) => text(key, whole));
}
