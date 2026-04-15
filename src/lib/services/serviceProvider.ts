import type { TasteVector } from "@/types/domain";
import { hungryService as mockHungryService } from "@/lib/services/mock/mockService";
import {
  mockRepository as mockRepositorySource,
  similarityScore as mockSimilarityScore,
} from "@/lib/services/mock/repositories";
import type { DataRepository, HungryService } from "@/lib/services/types";

const mockRepository: DataRepository = mockRepositorySource;

export interface ServiceProvider {
  mode: "mock" | "api";
  service: HungryService;
  repository: DataRepository;
  similarityScore: (left: TasteVector, right: TasteVector) => number;
}

function createMockProvider(): ServiceProvider {
  return {
    mode: "mock",
    service: mockHungryService,
    repository: mockRepository,
    similarityScore: mockSimilarityScore,
  };
}

// TODO(api): replace with a real provider factory wired to Supabase/REST adapters.
// TODO(api): keep interface stable so UI/store code does not change when backend lands.
let activeProvider: ServiceProvider = createMockProvider();

export function getServiceProvider(): ServiceProvider {
  return activeProvider;
}

export function setServiceProvider(provider: ServiceProvider): void {
  activeProvider = provider;
}

export function resetServiceProvider(): void {
  activeProvider = createMockProvider();
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
