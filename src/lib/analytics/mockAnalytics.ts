import type { AnalyticsEventRecord, AnalyticsEventName, AnalyticsSink } from "./types";
import { sanitizeAnalyticsProperties } from "./privacy";

const MAX_BUFFER_SIZE = 500;
const analyticsBuffer: AnalyticsEventRecord[] = [];
const mockSessionId = `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let sink: AnalyticsSink | null = (event) => {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info(`[analytics] ${event.event}`, event.properties);
  }
};

export function trackAnalyticsEvent(
  event: AnalyticsEventName | (string & {}),
  properties: Record<string, unknown> = {},
  options?: { userId?: string },
): AnalyticsEventRecord {
  const record: AnalyticsEventRecord = {
    event,
    properties: sanitizeAnalyticsProperties(properties),
    session_id: mockSessionId,
    user_id: options?.userId,
    timestamp: new Date().toISOString(),
  };

  analyticsBuffer.push(record);
  if (analyticsBuffer.length > MAX_BUFFER_SIZE) {
    analyticsBuffer.shift();
  }

  try {
    sink?.(record);
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[analytics] sink failed (mock-safe fallback)", error);
    }
  }

  return record;
}

/**
 * Swaps the sink. With `replayBufferedEvents`, events tracked before this sink
 * attached (cold-start launches, shared-link opens) are sent to it in order.
 */
export function setAnalyticsSink(
  nextSink: AnalyticsSink | null,
  options?: { replayBufferedEvents?: boolean },
): void {
  sink = nextSink;
  if (!nextSink || !options?.replayBufferedEvents) {
    return;
  }

  for (const record of [...analyticsBuffer]) {
    try {
      nextSink(record);
    } catch (error) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn("[analytics] sink replay failed (mock-safe fallback)", error);
      }
    }
  }
}

export function getTrackedAnalyticsEvents(): AnalyticsEventRecord[] {
  return [...analyticsBuffer];
}

export function clearTrackedAnalyticsEvents(): void {
  analyticsBuffer.length = 0;
}

export function getAnalyticsSessionId(): string {
  return mockSessionId;
}
