import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getServiceProvider } from "@/lib/services/serviceProvider";
import { CatalogDiscoverHome } from "./CatalogDiscoverHome";
import { DiscoverHomeScreen } from "./DiscoverHomeScreen";

/**
 * Production/staging use the release-versioned catalog. Development can keep
 * the richer legacy prototype surface when the raw catalog flag is disabled.
 */
export function DiscoverEntryScreen() {
  const useCatalog = FEATURE_FLAGS.catalogReadV2 && getServiceProvider().mode === "supabase";
  return useCatalog ? <CatalogDiscoverHome /> : <DiscoverHomeScreen />;
}
