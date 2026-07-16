import { similarityScore } from "@/lib/ai/similarityScore";
import { getConfiguredDataSource, setConfiguredDataSource } from "@/lib/services/supabase/client";
import type { DataRepository, HungryService } from "@/lib/services/types";
import type { TasteVector } from "@/types/domain";

export interface ServiceProvider {
  mode: "mock" | "supabase" | "excel";
  service: HungryService;
  repository: DataRepository;
  similarityScore: (left: TasteVector, right: TasteVector) => number;
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

function rejectNonProductionProvider(mode: "mock" | "excel"): never {
  throw new Error(`[Hungry production configuration] ${mode} data is unavailable in production`);
}

let activeProvider: ServiceProvider | null = null;

function getActiveProvider(): ServiceProvider {
  if (!activeProvider) {
    if (getConfiguredDataSource() !== "supabase") {
      throw new Error("[Hungry production configuration] Supabase data source is required");
    }
    activeProvider = createSupabaseProvider();
  }
  return activeProvider;
}

export function getServiceProvider(): ServiceProvider {
  return getActiveProvider();
}

export function setServiceProvider(provider: ServiceProvider): void {
  if (provider.mode !== "supabase") {
    rejectNonProductionProvider(provider.mode);
  }
  setConfiguredDataSource("supabase");
  activeProvider = provider;
}

export function setMockServiceProvider(): never {
  return rejectNonProductionProvider("mock");
}

export function setSupabaseServiceProvider(): void {
  setConfiguredDataSource("supabase");
  activeProvider = createSupabaseProvider();
}

export function setExcelServiceProvider(): never {
  return rejectNonProductionProvider("excel");
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

/** @deprecated Use getDataRepository() directly. */
export const dataRepository = new Proxy({} as DataRepository, {
  get(_target, property, receiver) {
    const repository = getDataRepository() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(repository, property, receiver);
    return typeof value === "function" ? value.bind(repository) : value;
  },
});
