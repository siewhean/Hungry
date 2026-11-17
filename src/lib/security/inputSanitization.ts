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

export function sanitizeFreeText(text: string, maxLength: number): string {
  const sanitized = collapseWhitespace(removeDangerousPatterns(text));
  return sanitized.slice(0, maxLength);
}

export const REVIEW_TEXT_MAX_LENGTH = 500;
export const POST_CAPTION_MAX_LENGTH = 280;
