import { similarityScore } from "@/lib/ai/similarityScore";
import {
  CatalogAuthenticationRequiredError,
  CatalogSessionInvalidError,
  CatalogUnavailableError,
  classifyCatalogAccessError,
  isCatalogAuthenticationError,
  isCatalogFallbackEligibleError,
  type CatalogPage,
  type catalogRawService,
} from "@/lib/services/catalog";
import { getConfiguredDataSource, setConfiguredDataSource } from "@/lib/services/supabase/client";
import type { DataRepository, HungryService } from "@/lib/services/types";
import type { TasteVector } from "@/types/domain";
import type { CatalogRawService } from "@/lib/services/catalog";

export interface ServiceProvider {
  mode: "mock" | "supabase" | "excel";
  service: HungryService;
  repository: DataRepository;
  similarityScore: (left: TasteVector, right: TasteVector) => number;
}

type CatalogReadService = typeof catalogRawService;
type DiscoveryService = HungryService["discovery"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionStoreState() {
  const { useSessionStore } =
    require("@/store/useSessionStore") as typeof import("@/store/useSessionStore");
  return useSessionStore.getState();
}

function hasValidAuthenticatedSession(): boolean {
  const state = sessionStoreState();
  return Boolean(
    state.isAuthReady &&
    state.isAuthenticated &&
    state.authDataSource === "supabase" &&
    state.authenticatedUserId &&
    UUID_PATTERN.test(state.authenticatedUserId),
  );
}

function requireAuthenticatedCatalogFallbackSession(): void {
  if (!hasValidAuthenticatedSession()) {
    throw new CatalogAuthenticationRequiredError(
      "Sign in with a valid Hungry account before using the food directory.",
    );
  }
}

function expireRejectedSession(error: unknown): void {
  if (!isCatalogAuthenticationError(error)) return;
  const state = sessionStoreState();
  if (state.isAuthenticated) state.expireSession();
}

function requireCatalogRelease<T>(page: CatalogPage<T>): CatalogPage<T> {
  if (!page.releaseId) {
    throw new CatalogUnavailableError("No active Hungry catalog release is available.");
  }
  return page;
}

function requireMapRelease<T extends { releaseId: string }>(value: T): T {
  if (!value.releaseId) {
    throw new CatalogUnavailableError("No active Hungry map catalog is available.");
  }
  return value;
}

async function runAuthenticatedCatalogFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  requireAuthenticatedCatalogFallbackSession();
  try {
    // A successful empty result is authoritative. Fallback is used only for
    // classified availability failures, never to replace legitimate no matches.
    return await primary();
  } catch (error) {
    expireRejectedSession(error);
    if (!isCatalogFallbackEligibleError(error)) throw error;
    requireAuthenticatedCatalogFallbackSession();
    return fallback();
  }
}

export async function runAuthenticatedDiscoveryFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    const classified = classifyCatalogAccessError(error, "rpc");
    expireRejectedSession(classified);
    if (!isCatalogFallbackEligibleError(classified)) throw classified;
    requireAuthenticatedCatalogFallbackSession();
    return fallback();
  }
}

function getExcelDiscoveryService(): DiscoveryService {
  const { excelService } =
    require("@/lib/services/excel/excelService") as typeof import("@/lib/services/excel/excelService");
  return excelService.discovery;
}

function createResilientDiscoveryService(primary: DiscoveryService): DiscoveryService {
  let fallback: DiscoveryService | null = null;
  const getFallback = () => {
    fallback ??= getExcelDiscoveryService();
    return fallback;
  };

  return {
    ...primary,
    async listBuildings(...args) {
      return runAuthenticatedDiscoveryFallback(
        () => primary.listBuildings(...args),
        () => getFallback().listBuildings(...args),
      );
    },
    async countVenuesInArea(...args) {
      return runAuthenticatedDiscoveryFallback(
        () => primary.countVenuesInArea(...args),
        () => getFallback().countVenuesInArea(...args),
      );
    },
    async getVenue(...args) {
      return runAuthenticatedDiscoveryFallback(
        () => primary.getVenue(...args),
        () => getFallback().getVenue(...args),
      );
    },
    async listVenuesByBuilding(...args) {
      return runAuthenticatedDiscoveryFallback(
        () => primary.listVenuesByBuilding(...args),
        () => getFallback().listVenuesByBuilding(...args),
      );
    },
    async getDish(...args) {
      return runAuthenticatedDiscoveryFallback(
        () => primary.getDish(...args),
        () => getFallback().getDish(...args),
      );
    },
    async listDishesByVenue(...args) {
      return runAuthenticatedDiscoveryFallback(
        () => primary.listDishesByVenue(...args),
        () => getFallback().listDishesByVenue(...args),
      );
    },
    async listPopularNearby(...args) {
      return runAuthenticatedDiscoveryFallback(
        () => primary.listPopularNearby(...args),
        () => getFallback().listPopularNearby(...args),
      );
    },
    async listDiscoveryFeedByLocation(...args) {
      return runAuthenticatedDiscoveryFallback(
        () => primary.listDiscoveryFeedByLocation(...args),
        () => getFallback().listDiscoveryFeedByLocation(...args),
      );
    },
    async searchVenuesByLocation(...args) {
      return runAuthenticatedDiscoveryFallback(
        () => primary.searchVenuesByLocation(...args),
        () => getFallback().searchVenuesByLocation(...args),
      );
    },
    async searchDishes(...args) {
      return runAuthenticatedDiscoveryFallback(
        () => primary.searchDishes(...args),
        () => getFallback().searchDishes(...args),
      );
    },
    async decideForMe(...args) {
      return runAuthenticatedDiscoveryFallback(
        () => primary.decideForMe(...args),
        () => getFallback().decideForMe(...args),
      );
    },
  };
}

function createMockProvider(): ServiceProvider {
  const { hungryService: mockHungryService } =
    require("@/lib/services/mock/mockService") as typeof import("@/lib/services/mock/mockService");
  const { dataRepositoryMock } =
    require("@/lib/services/mock/repositories") as typeof import("@/lib/services/mock/repositories");
  return {
    mode: "mock",
    service: mockHungryService,
    repository: dataRepositoryMock as DataRepository,
    similarityScore,
  };
}

function createSupabaseProvider(): ServiceProvider {
  let cachedService: HungryService | null = null;
  let cachedRepository: DataRepository | null = null;

  const loadModules = () => {
    if (cachedService && cachedRepository) return;
    const { supabaseRepository } =
      require("@/lib/services/supabase/supabaseRepository") as typeof import("@/lib/services/supabase/supabaseRepository");
    const { supabaseService } =
      require("@/lib/services/supabase/supabaseService") as typeof import("@/lib/services/supabase/supabaseService");
    cachedRepository = supabaseRepository;
    cachedService = {
      ...supabaseService,
      discovery: createResilientDiscoveryService(supabaseService.discovery),
    };
  };

  return {
    mode: "supabase",
    get service() {
      loadModules();
      return cachedService as HungryService;
    },
    get repository() {
      loadModules();
      return cachedRepository as DataRepository;
    },
    similarityScore,
  };
}

function createExcelProvider(): ServiceProvider {
  let cachedService: HungryService | null = null;
  let cachedRepository: DataRepository | null = null;

  const loadModules = () => {
    if (cachedService && cachedRepository) return;
    const { excelRepository } =
      require("@/lib/services/excel/repositories") as typeof import("@/lib/services/excel/repositories");
    const { excelService } =
      require("@/lib/services/excel/excelService") as typeof import("@/lib/services/excel/excelService");
    cachedRepository = excelRepository;
    cachedService = excelService;
  };

  return {
    mode: "excel",
    get service() {
      loadModules();
      return cachedService as HungryService;
    },
    get repository() {
      loadModules();
      return cachedRepository as DataRepository;
    },
    similarityScore,
  };
}

function createProviderFromEnv(): ServiceProvider {
  const dataSource = getConfiguredDataSource();
  if (dataSource === "supabase") return createSupabaseProvider();
  if (dataSource === "excel") return createExcelProvider();
  return createMockProvider();
}

let activeProvider: ServiceProvider | null = null;
let cachedCatalogReadService: CatalogReadService | null = null;

function getActiveProvider(): ServiceProvider {
  if (!activeProvider) activeProvider = createProviderFromEnv();
  return activeProvider;
}

function getExcelCatalogFallbackService(): CatalogReadService {
  const { excelCatalogFallbackService } =
    require("@/lib/services/catalog/excelFallback") as typeof import("@/lib/services/catalog/excelFallback");
  return excelCatalogFallbackService;
}

function isExcelFallbackRelease(releaseId?: string): boolean {
  return Boolean(releaseId?.startsWith("excel-fallback"));
}

/** Excel cursors are offset tokens prefixed with `excel:`; anything else is a live RPC cursor. */
export function isExcelCatalogCursor(cursor?: string): boolean {
  return Boolean(cursor?.startsWith("excel:"));
}

/**
 * Raised when a continuation page of an online cursor chain fails. The caller
 * keeps the rows it already has and offers a retry; the request is never
 * re-served from Excel because an online cursor has no meaning there and would
 * silently restart (and duplicate) the list from a different source.
 */
export class CatalogPaginationError extends CatalogUnavailableError {
  constructor(
    message = "Couldn't load more results. Check your connection and try again.",
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = "CatalogPaginationError";
  }
}

type PagedCatalogRequest = { cursor?: string; releaseId?: string };

/**
 * Routes one paged catalog read so a cursor is only ever sent to the source
 * that issued it:
 * - Excel release or Excel cursor -> Excel only.
 * - Live continuation cursor -> online only; failures surface as a retryable
 *   CatalogPaginationError instead of switching source mid-list.
 * - First page (no cursor) -> online with the classified Excel fallback.
 */
async function runPagedCatalogRead<T>(
  request: PagedCatalogRequest,
  primary: () => Promise<CatalogPage<T>>,
  fallback: () => Promise<CatalogPage<T>>,
): Promise<CatalogPage<T>> {
  if (isExcelFallbackRelease(request.releaseId) || isExcelCatalogCursor(request.cursor)) {
    requireAuthenticatedCatalogFallbackSession();
    return fallback();
  }
  if (request.cursor) {
    requireAuthenticatedCatalogFallbackSession();
    try {
      return requireCatalogRelease(await primary());
    } catch (error) {
      expireRejectedSession(error);
      if (!isCatalogFallbackEligibleError(error)) throw error;
      throw new CatalogPaginationError(undefined, error);
    }
  }
  return runAuthenticatedCatalogFallback(
    async () => requireCatalogRelease(await primary()),
    fallback,
  );
}

export function createResilientCatalogReadService(
  primary: CatalogReadService = (
    require("@/lib/services/catalog") as typeof import("@/lib/services/catalog")
  ).catalogRawService,
  fallback: CatalogReadService = getExcelCatalogFallbackService(),
): CatalogReadService {
  return {
    clearCache() {
      primary.clearCache();
      fallback.clearCache();
    },
    async listDishes(request) {
      return runPagedCatalogRead(
        request,
        () => primary.listDishes(request),
        () => fallback.listDishes(request),
      );
    },
    async listVenues(request) {
      return runPagedCatalogRead(
        request,
        () => primary.listVenues(request),
        () => fallback.listVenues(request),
      );
    },
    async getDish(id, releaseId) {
      if (isExcelFallbackRelease(releaseId)) {
        requireAuthenticatedCatalogFallbackSession();
        return fallback.getDish(id, releaseId);
      }
      return runAuthenticatedCatalogFallback(
        () => primary.getDish(id, releaseId),
        () => fallback.getDish(id, releaseId),
      );
    },
    async getVenue(id, releaseId) {
      if (isExcelFallbackRelease(releaseId)) {
        requireAuthenticatedCatalogFallbackSession();
        return fallback.getVenue(id, releaseId);
      }
      return runAuthenticatedCatalogFallback(
        () => primary.getVenue(id, releaseId),
        () => fallback.getVenue(id, releaseId),
      );
    },
    async listVenueMenu(venueId, request = {}) {
      return runPagedCatalogRead(
        request,
        () => primary.listVenueMenu(venueId, request),
        () => fallback.listVenueMenu(venueId, request),
      );
    },
    async getMapViewport(request) {
      if (isExcelFallbackRelease(request.releaseId)) {
        requireAuthenticatedCatalogFallbackSession();
        return fallback.getMapViewport(request);
      }
      return runAuthenticatedCatalogFallback(
        async () => requireMapRelease(await primary.getMapViewport(request)),
        () => fallback.getMapViewport(request),
      );
    },
  };
}

export function getServiceProvider(): ServiceProvider {
  return getActiveProvider();
}

export function setServiceProvider(provider: ServiceProvider): void {
  setConfiguredDataSource();
  activeProvider = provider;
  cachedCatalogReadService = null;
}

export function setMockServiceProvider(): void {
  setConfiguredDataSource("mock");
  activeProvider = createProviderFromEnv();
  cachedCatalogReadService = null;
}

export function setSupabaseServiceProvider(): void {
  setConfiguredDataSource("supabase");
  activeProvider = createProviderFromEnv();
  cachedCatalogReadService = null;
}

export function setExcelServiceProvider(): void {
  setConfiguredDataSource("excel");
  activeProvider = createProviderFromEnv();
  cachedCatalogReadService = null;
}

export function resetServiceProvider(): void {
  setConfiguredDataSource();
  activeProvider = null;
  cachedCatalogReadService = null;
}

export function getHungryService(): HungryService {
  return getActiveProvider().service;
}

let localCatalog: { provider: ServiceProvider; service: CatalogRawService } | null = null;

/**
 * The paged catalog behind Search, Browse, the map and catalog detail. Supabase
 * serves authenticated, release-versioned RPCs (with the strictly classified
 * Excel fallback); Excel is reachable only through the authenticated, read-only
 * catalog wrapper; mock serves the same contract from its local repository.
 */
export function getCatalogRawService(): CatalogRawService {
  const provider = getActiveProvider();
  if (provider.mode === "supabase") {
    if (!cachedCatalogReadService) cachedCatalogReadService = createResilientCatalogReadService();
    return cachedCatalogReadService;
  }
  if (provider.mode === "excel") {
    requireAuthenticatedCatalogFallbackSession();
    return getExcelCatalogFallbackService();
  }
  if (localCatalog?.provider !== provider) {
    const { createLocalCatalogService } =
      require("@/lib/services/mock/catalogMockService") as typeof import("@/lib/services/mock/catalogMockService");
    localCatalog = { provider, service: createLocalCatalogService(provider.repository) };
  }
  return localCatalog.service;
}

export function getDataRepository(): DataRepository {
  return getActiveProvider().repository;
}

export function getSimilarityScore(left: TasteVector, right: TasteVector): number {
  return getActiveProvider().similarityScore(left, right);
}

/** @deprecated Use getDataRepository() directly. */
export const dataRepository = new Proxy({} as DataRepository, {
  get(_target, property, receiver) {
    const repository = getDataRepository() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(repository, property, receiver);
    if (typeof value === "function") return value.bind(repository);
    return value;
  },
});
