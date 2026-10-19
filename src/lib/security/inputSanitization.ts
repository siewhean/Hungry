const SCRIPT_TAG_REGEX = /<\s*\/?\s*script\b[^>]*>/gi;
const HTML_TAG_REGEX = /<[^>]+>/g;
const SQL_META_REGEX =
  /\b(select|insert|update|delete|drop|union|truncate|alter|exec|execute)\b|(--|;|\/\*|\*\/)/gi;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function removeDangerousPatterns(value: string): string {
  return value
    .replace(SCRIPT_TAG_REGEX, "")
    .replace(HTML_TAG_REGEX, "")
    .replace(SQL_META_REGEX, "");
}

export function sanitizeSearchQuery(query: string, maxLength = 120): string {
  const sanitized = collapseWhitespace(removeDangerousPatterns(query));
  return sanitized.slice(0, maxLength);
}

/**
 * Clamp in-progress free text without altering what the user typed, so controlled
 * inputs keep spaces, newlines and ordinary words. Sanitize with sanitizeFreeText at submit.
 */
export function clampFreeTextInput(text: string, maxLength: number): string {
  return text.slice(0, maxLength);
}

/**
 * Submit-time cleanup for user free text (reviews, captions). Strips markup, normalises
 * line endings, limits blank-line runs, trims and caps. SQL keywords are left alone:
 * Supabase queries are parameterised, and words like "select" are legitimate prose.
 */
export function sanitizeFreeText(text: string, maxLength: number): string {
  const sanitized = text
    .replace(SCRIPT_TAG_REGEX, "")
    .replace(HTML_TAG_REGEX, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return sanitized.slice(0, maxLength).trim();
}

export const REVIEW_TEXT_MAX_LENGTH = 500;
export const POST_CAPTION_MAX_LENGTH = 280;
