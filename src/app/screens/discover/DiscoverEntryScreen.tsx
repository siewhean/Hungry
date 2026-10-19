import { getServiceProvider } from "@/lib/services/serviceProvider";
import { CatalogDiscoverHome } from "./CatalogDiscoverHome";
import { DiscoverHomeScreen } from "./DiscoverHomeScreen";

/**
 * The Supabase provider (production/staging) uses the release-versioned catalog
 * Discover; mock and Excel keep the local Discover surface.
 */
export function DiscoverEntryScreen() {
  const useCatalog = getServiceProvider().mode === "supabase";
  return useCatalog ? <CatalogDiscoverHome /> : <DiscoverHomeScreen />;
}
