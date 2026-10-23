import type { CatalogPageRequest } from "@/lib/services/catalog";

export type CatalogDiagnosticSource = "supabase" | "excel" | "unknown";
export type CatalogDiagnosticOperation =
  | "discover"
  | "search-dishes"
  | "search-stalls"
  | "browse-dishes"
  | "browse-stalls"
  | "dish-detail"
  | "stall-detail"
  | "venue-menu"
  | "map";

export interface CatalogDiagnosticEvent {
  id: string;
  recordedAt: string;
  operation: CatalogDiagnosticOperation;
  source: CatalogDiagnosticSource;
  releaseId?: string;
  durationMs: number;
  resultCount: number;
  succeeded: boolean;
  fallbackUsed: boolean;
  errorKind?: string;
  request: {
    queryPresent: boolean;
    cursorPresent: boolean;
    radiusMeters?: number;
    cuisineFilterCount: number;
    dietaryFilterCount: number;
    openOnly: boolean;
  };
}

const MAX_EVENTS = 30;
const recentEvents: CatalogDiagnosticEvent[] = [];

function sourceFromReleaseId(releaseId?: string): CatalogDiagnosticSource {
  if (!releaseId) return "unknown";
  return releaseId.startsWith("excel-fallback") ? "excel" : "supabase";
}

export function summarizeCatalogRequest(request: CatalogPageRequest) {
  return {
    queryPresent: Boolean(request.query?.trim()),
    cursorPresent: Boolean(request.cursor),
    radiusMeters: request.radiusMeters,
    cuisineFilterCount: request.cuisineTags?.length ?? 0,
    dietaryFilterCount: request.dietaryFlags?.length ?? 0,
    openOnly: request.openOnly === true,
  };
}

export function recordCatalogDiagnostic(
  input: Omit<CatalogDiagnosticEvent, "id" | "recordedAt" | "source" | "fallbackUsed"> & {
    source?: CatalogDiagnosticSource;
    fallbackUsed?: boolean;
  },
): CatalogDiagnosticEvent {
  const source = input.source ?? sourceFromReleaseId(input.releaseId);
  const event: CatalogDiagnosticEvent = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    recordedAt: new Date().toISOString(),
    source,
    fallbackUsed: input.fallbackUsed ?? source === "excel",
  };
  recentEvents.unshift(event);
  if (recentEvents.length > MAX_EVENTS) recentEvents.splice(MAX_EVENTS);
  return event;
}

export function getCatalogDiagnosticsSnapshot(): CatalogDiagnosticEvent[] {
  return recentEvents.map((event) => ({ ...event, request: { ...event.request } }));
}

export function clearCatalogDiagnostics(): void {
  recentEvents.splice(0, recentEvents.length);
}
