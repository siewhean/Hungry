import type { TasteVector } from "@/types/domain";
import { getConfiguredDataSource, setConfiguredDataSource } from "@/lib/services/supabase/client";
import { similarityScore } from "@/lib/ai/similarityScore";
import type { DataRepository, HungryService } from "@/lib/services/types";

export interface ServiceProvider {
  mode: "mock" | "supabase";
  service: HungryService;
  repository: DataRepository;
  similarityScore: (left: TasteVector, right: TasteVector) => number;
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

function createProviderFromEnv(): ServiceProvider {
  return getConfiguredDataSource() === "supabase" ? createSupabaseProvider() : createMockProvider();
}

let activeProvider: ServiceProvider | null = null;

function getActiveProvider(): ServiceProvider {
  if (!activeProvider) {
    activeProvider = createProviderFromEnv();
  }
  return activeProvider;
}

export function getServiceProvider(): ServiceProvider {
  return getActiveProvider();
}

export function setServiceProvider(provider: ServiceProvider): void {
  setConfiguredDataSource();
  activeProvider = provider;
}

export function setMockServiceProvider(): void {
  setConfiguredDataSource("mock");
  activeProvider = createMockProvider();
}

export function setSupabaseServiceProvider(): void {
  setConfiguredDataSource("supabase");
  activeProvider = createSupabaseProvider();
}

export function resetServiceProvider(): void {
  setConfiguredDataSource();
  activeProvider = null;
}

export function getHungryService(): HungryService {
  return getActiveProvider().service;
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
