/**
 * Plain-language copy for a failed review or post publish. Known failures (offline, upload,
 * own stall, file too large, unsupported file, refused text) get a clear sentence; anything
 * else gets a generic one. Raw error text such as "Signed upload URL creation failed." never
 * reaches the user. Every message says the draft is kept.
 */

export type PublishKind = "review" | "post";

type ErrorShape = { message?: unknown; code?: unknown; status?: unknown };

const DRAFT_KEPT: Record<PublishKind, string> = {
  review: "Your draft is saved. Try again.",
  post: "Your post is still here. Try again.",
};

type ParsedError = { message: string; code: string; status?: number };

function readError(error: unknown): ParsedError {
  const shape = (typeof error === "object" && error ? error : {}) as ErrorShape;
  return {
    message: typeof shape.message === "string" ? shape.message : String(error ?? ""),
    code: typeof shape.code === "string" ? shape.code : "",
    status: typeof shape.status === "number" ? shape.status : undefined,
  };
}

/** The request limiter refused it (`app_can_make_*`: code rate_limited, HTTP 429). */
function isRateLimited({ message, code, status }: ParsedError): boolean {
  return code === "rate_limited" || status === 429 || /too many requests/i.test(message);
}

/**
 * True when the server wrote the message for the person (text filter, own-stall check) or the
 * limiter refused it: expected outcomes, not faults, so they are not sent to error tracking.
 */
export function isExpectedPublishError(error: unknown): boolean {
  const parsed = readError(error);
  return (
    (parsed.code === "23514" && parsed.message.length > 0) ||
    /cannot review a stall you manage/i.test(parsed.message) ||
    isRateLimited(parsed)
  );
}

/**
 * Copy for a failed edit or delete of the author's own review. A message the server wrote for
 * people (text filter) is shown; raw database or network text never is.
 */
export function describeReviewEditError(error: unknown, action: "save" | "delete"): string {
  const parsed = readError(error);
  const { message, code } = parsed;
  if (code === "23514" && message.length > 0 && message.length <= 160) {
    return /[.!?]$/.test(message) ? message : `${message}.`;
  }
  if (isRateLimited(parsed)) return "You're making changes quickly. Wait a minute and try again.";
  if (/network request failed|failed to fetch|network error|offline|timed out|timeout/i.test(message)) {
    return "You appear to be offline. Try again when you're connected.";
  }
  return action === "save"
    ? "Couldn't save your review. Try again."
    : "Couldn't delete your review. Try again.";
}

export function describePublishError(error: unknown, kind: PublishKind): string {
  const parsed = readError(error);
  const { message, code } = parsed;
  const draftKept = DRAFT_KEPT[kind];

  // The server wrote these for people (text filter, own-stall check).
  if (code === "23514" && message.length > 0 && message.length <= 160) {
    return /[.!?]$/.test(message) ? message : `${message}.`;
  }
  if (/cannot review a stall you manage/i.test(message)) {
    return `You can't review a stall you manage.`;
  }
  if (isRateLimited(parsed)) {
    return `You're posting quickly. Wait a minute, then try again. ${draftKept}`;
  }
  if (code === "metadata_strip_failed") {
    return `We couldn't remove location details from a photo or video, so it wasn't uploaded. Try a different one. ${draftKept}`;
  }
  if (/exceeds .*limit/i.test(message)) {
    return `One of your files is too large. Photos can be up to 10 MB and videos up to 50 MB. ${draftKept}`;
  }
  if (
    /must be (an )?image|must be image\/|supported video|does not match its declared type/i.test(
      message,
    )
  ) {
    return `That file type isn't supported. Use a JPG, PNG, HEIC or WebP photo, or an MP4 or MOV video. ${draftKept}`;
  }
  if (
    /network request failed|failed to fetch|network error|offline|internet connection|timed out|timeout/i.test(
      message,
    )
  ) {
    return `You appear to be offline. ${draftKept}`;
  }
  if (
    code === "upload_failed" ||
    /signed upload|failed to read local media|upload/i.test(message)
  ) {
    return `We couldn't upload your photos. Check your connection. ${draftKept}`;
  }
  return `Something went wrong while publishing. ${draftKept}`;
}
