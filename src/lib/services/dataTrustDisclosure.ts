import { getServiceProvider } from "@/lib/services/serviceProvider";

type DataTrustSurface = "merchantAnalytics" | "missions" | "foodCred" | "waitEstimate";

const LIVE_LABELS: Record<DataTrustSurface, string> = {
  merchantAnalytics: "Live analytics",
  missions: "Live mission progress",
  foodCred: "Live score",
  // venues.live_crowd is a stored listing value, not a live feed.
  waitEstimate: "Listed wait estimate",
};

const PREVIEW_LABELS: Record<DataTrustSurface, string> = {
  merchantAnalytics: "Preview analytics",
  missions: "Preview mission progress",
  foodCred: "Preview score",
  waitEstimate: "Preview wait estimate",
};

export function getDataTrustDisclosure(surface: DataTrustSurface): string {
  return getServiceProvider().mode === "supabase" ? LIVE_LABELS[surface] : PREVIEW_LABELS[surface];
}
