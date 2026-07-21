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
  // Lazy getters prevent expo/react-native modules from loading during
  // Node-based tests that only inspect provider mode.
  let cachedService: HungryService | null = null;
  let cachedRepository: DataRepository | null = null;

  const loadModules = () => {
    if (cachedService && cachedRepository) return;

    const { supabaseRepository } =
      require("@/lib/services/supabase/supabaseRepository") as typeof import("@/lib/services/supabase/supabaseRepository");

    const { supabaseService } =
      require("@/lib/services/supabase/supabaseService") as typeof import("@/lib/services/supabase/supabaseService");

    cachedRepository = supabaseRepository;
    cachedService = supabaseService;
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
  // Match the Supabase provider's lazy loading so choosing mock or Supabase
  // never parses the large generated Excel catalog.
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
  if (!activeProvider) {
    activeProvider = createProviderFromEnv();
  }
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
      if (isExcelFallbackRelease(request.releaseId)) {
        return fallback.getDiscoverSections(request);
      }
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
      if (isExcelFallbackRelease(request.releaseId)) {
        return fallback.listVenueMenu(venueId, request);
      }
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
  activeProvider =
    getConfiguredDataSource() === "mock" ? createMockProvider() : createSupabaseProvider();
  cachedCatalogReadService = null;
}

export function setSupabaseServiceProvider(): void {
  setConfiguredDataSource("supabase");
  activeProvider = createSupabaseProvider();
  cachedCatalogReadService = null;
}

export function setExcelServiceProvider(): void {
  setConfiguredDataSource("excel");
  activeProvider =
    getConfiguredDataSource() === "excel" ? createExcelProvider() : createSupabaseProvider();
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
  if (!cachedCatalogReadService) {
    cachedCatalogReadService = createResilientCatalogReadService();
  }
  return cachedCatalogReadService;
}

export function getDataRepository(): DataRepository {
  return getActiveProvider().repository;
}

export function getSimilarityScore(left: TasteVector, right: TasteVector): number {
  return getActiveProvider().similarityScore(left, right);
}

// Compatibility layer for legacy callsites migrating off direct mock imports.
// Each access resolves the current provider lazily, so provider swaps stay live.
/** @deprecated Use getDataRepository() directly. */
export const dataRepository = new Proxy({} as DataRepository, {
  get(_target, property, receiver) {
    const repository = getDataRepository() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(repository, property, receiver);
    if (typeof value === "function") {
      return value.bind(repository);
    }
    return value;
  },
});
