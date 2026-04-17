import type { TasteVector } from "@/types/domain";
import { hungryService as mockHungryService } from "@/lib/services/mock/mockService";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { supabaseRepository } from "@/lib/services/supabase/supabaseRepository";
import { supabaseService } from "@/lib/services/supabase/supabaseService";
import { similarityScore } from "@/lib/ai/similarityScore";
import type { DataRepository, HungryService } from "@/lib/services/types";

const defaultMockDataRepository: DataRepository = dataRepositoryMock;

export interface ServiceProvider {
  mode: "mock" | "supabase";
  service: HungryService;
  repository: DataRepository;
  similarityScore: (left: TasteVector, right: TasteVector) => number;
}

function createMockProvider(): ServiceProvider {
  return {
    mode: "mock",
    service: mockHungryService,
    repository: defaultMockDataRepository,
    similarityScore,
  };
}

function createSupabaseProvider(): ServiceProvider {
  return {
    mode: "supabase",
    service: supabaseService,
    repository: supabaseRepository,
    similarityScore,
  };
}

function createProviderFromEnv(): ServiceProvider {
  return getConfiguredDataSource() === "supabase" ? createSupabaseProvider() : createMockProvider();
}

let activeProvider: ServiceProvider = createProviderFromEnv();

export function getServiceProvider(): ServiceProvider {
  return activeProvider;
}

export function setServiceProvider(provider: ServiceProvider): void {
  activeProvider = provider;
}

export function resetServiceProvider(): void {
  activeProvider = createProviderFromEnv();
}

export function getHungryService(): HungryService {
  return activeProvider.service;
}

export function getDataRepository(): DataRepository {
  return activeProvider.repository;
}

export function getSimilarityScore(left: TasteVector, right: TasteVector): number {
  return activeProvider.similarityScore(left, right);
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
