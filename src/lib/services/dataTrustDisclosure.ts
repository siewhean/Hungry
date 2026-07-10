import { getServiceProvider } from "@/lib/services/serviceProvider";

type DataTrustSurface =
  | "merchantAnalytics"
  | "missions"
  | "foodCred"
  | "mapStatus"
  | "waitEstimate";

const LIVE_LABELS: Record<DataTrustSurface, string> = {
  merchantAnalytics: "Live analytics",
  missions: "Live mission progress",
  foodCred: "Live score",
  mapStatus: "Live map status",
  waitEstimate: "Live wait estimate",
};

const PREVIEW_LABELS: Record<DataTrustSurface, string> = {
  merchantAnalytics: "Preview analytics",
  missions: "Preview mission progress",
  foodCred: "Preview score",
  mapStatus: "Preview map status",
  waitEstimate: "Preview wait estimate",
};

export function getDataTrustDisclosure(surface: DataTrustSurface): string {
  return getServiceProvider().mode === "supabase" ? LIVE_LABELS[surface] : PREVIEW_LABELS[surface];
}
