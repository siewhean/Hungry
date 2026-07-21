import type { TasteVector } from "@/types/domain";
import { getConfiguredDataSource, setConfiguredDataSource } from "@/lib/services/supabase/client";
import { similarityScore } from "@/lib/ai/similarityScore";
import type { DataRepository, HungryService } from "@/lib/services/types";
import type { catalogRawService } from "@/lib/services/catalog";

export interface ServiceProvider {
  mode: "mock" | "supabase" | "excel";
  service: HungryService;
  repository: DataRepository;
  similarityScore: (left: TasteVector, right: TasteVector) => number;
}

type CatalogReadService = typeof catalogRawService;
type DiscoveryService = HungryService["discovery"];

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
      try {
        const result = await primary.listBuildings(...args);
        return result.length ? result : getFallback().listBuildings(...args);
      } catch {
        return getFallback().listBuildings(...args);
      }
    },
    async countVenuesInArea(...args) {
      try {
        const result = await primary.countVenuesInArea(...args);
        return result && result > 0 ? result : getFallback().countVenuesInArea(...args);
      } catch {
        return getFallback().countVenuesInArea(...args);
      }
    },
    async getVenue(...args) {
      try {
        const result = await primary.getVenue(...args);
        return result ?? getFallback().getVenue(...args);
      } catch {
        return getFallback().getVenue(...args);
      }
    },
    async listVenuesByBuilding(...args) {
      try {
        const result = await primary.listVenuesByBuilding(...args);
        return result.length ? result : getFallback().listVenuesByBuilding(...args);
      } catch {
        return getFallback().listVenuesByBuilding(...args);
      }
    },
    async getDish(...args) {
      try {
        const result = await primary.getDish(...args);
        return result ?? getFallback().getDish(...args);
      } catch {
        return getFallback().getDish(...args);
      }
    },
    async listDishesByVenue(...args) {
      try {
        const result = await primary.listDishesByVenue(...args);
        return result.length ? result : getFallback().listDishesByVenue(...args);
      } catch {
        return getFallback().listDishesByVenue(...args);
      }
    },
    async listPopularNearby(...args) {
      try {
        const result = await primary.listPopularNearby(...args);
        return result.length ? result : getFallback().listPopularNearby(...args);
      } catch {
        return getFallback().listPopularNearby(...args);
      }
    },
    async listDiscoveryFeedByLocation(...args) {
      try {
        const result = await primary.listDiscoveryFeedByLocation(...args);
        return result?.venues.length || result?.results.length
          ? result
          : getFallback().listDiscoveryFeedByLocation(...args);
      } catch {
        return getFallback().listDiscoveryFeedByLocation(...args);
      }
    },
    async searchVenuesByLocation(...args) {
      try {
        const result = await primary.searchVenuesByLocation(...args);
        return result?.length ? result : getFallback().searchVenuesByLocation(...args);
      } catch {
        return getFallback().searchVenuesByLocation(...args);
      }
    },
    async searchDishes(...args) {
      try {
        const result = await primary.searchDishes(...args);
        return result.length ? result : getFallback().searchDishes(...args);
      } catch {
        return getFallback().searchDishes(...args);
      }
    },
    async decideForMe(...args) {
      try {
        const result = await primary.decideForMe(...args);
        return result ?? getFallback().decideForMe(...args);
      } catch {
        return getFallback().decideForMe(...args);
      }
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

function createResilientCatalogReadService(): CatalogReadService {
  const { catalogRawService: primary } =
    require("@/lib/services/catalog") as typeof import("@/lib/services/catalog");
  const fallback = getExcelCatalogFallbackService();

  return {
    clearCache() {
      primary.clearCache();
      fallback.clearCache();
    },
    async listDishes(request) {
      if (isExcelFallbackRelease(request.releaseId)) return fallback.listDishes(request);
      try {
        const result = await primary.listDishes(request);
        return result.items.length || result.releaseId ? result : fallback.listDishes(request);
      } catch {
        return fallback.listDishes(request);
      }
    },
    async getDiscoverSections(request) {
      if (isExcelFallbackRelease(request.releaseId)) return fallback.getDiscoverSections(request);
      try {
        const result = await primary.getDiscoverSections(request);
        const hasItems = Object.values(result.sections).some((items) => items.length > 0);
        return hasItems || result.releaseId ? result : fallback.getDiscoverSections(request);
      } catch {
        return fallback.getDiscoverSections(request);
      }
    },
    async listVenues(request) {
      if (isExcelFallbackRelease(request.releaseId)) return fallback.listVenues(request);
      try {
        const result = await primary.listVenues(request);
        return result.items.length || result.releaseId ? result : fallback.listVenues(request);
      } catch {
        return fallback.listVenues(request);
      }
    },
    async getDish(id, releaseId) {
      if (isExcelFallbackRelease(releaseId)) return fallback.getDish(id, releaseId);
      try {
        return await primary.getDish(id, releaseId);
      } catch {
        return fallback.getDish(id, releaseId);
      }
    },
    async getVenue(id, releaseId) {
      if (isExcelFallbackRelease(releaseId)) return fallback.getVenue(id, releaseId);
      try {
        return await primary.getVenue(id, releaseId);
      } catch {
        return fallback.getVenue(id, releaseId);
      }
    },
    async listVenueMenu(venueId, request = {}) {
      if (isExcelFallbackRelease(request.releaseId)) return fallback.listVenueMenu(venueId, request);
      try {
        const result = await primary.listVenueMenu(venueId, request);
        return result.items.length || result.releaseId
          ? result
          : fallback.listVenueMenu(venueId, request);
      } catch {
        return fallback.listVenueMenu(venueId, request);
      }
    },
    async getMapViewport(request) {
      if (isExcelFallbackRelease(request.releaseId)) return fallback.getMapViewport(request);
      try {
        const result = await primary.getMapViewport(request);
        return result.items.length || result.releaseId ? result : fallback.getMapViewport(request);
      } catch {
        return fallback.getMapViewport(request);
      }
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

/**
 * Release-versioned catalog reads use Supabase first and fall back to the
 * bundled, rights-reviewed Excel catalog when the online catalog is unavailable.
 * The fallback is read-only: profile, social, review, and merchant writes remain
 * on their configured service provider and never silently become fixture writes.
 */
export function getCatalogRawService(): CatalogReadService | null {
  const providerMode = getActiveProvider().mode;
  if (providerMode === "mock") return null;
  if (providerMode === "excel") return getExcelCatalogFallbackService();
  if (!cachedCatalogReadService) cachedCatalogReadService = createResilientCatalogReadService();
  return cachedCatalogReadService;
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
