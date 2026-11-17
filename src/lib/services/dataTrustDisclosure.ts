import { getServiceProvider } from "@/lib/services/serviceProvider";

type DataTrustSurface =
  | "merchantAnalytics"
  | "missions"
  | "foodCred"
  | "mapStatus"
  | "waitEstimate";

const SOURCED_LABELS: Record<DataTrustSurface, string> = {
  merchantAnalytics: "Recorded analytics",
  missions: "Recorded mission progress",
  foodCred: "Recorded score",
  mapStatus: "Listed map information",
  waitEstimate: "Wait estimate unavailable",
};

const PREVIEW_LABELS: Record<DataTrustSurface, string> = {
  merchantAnalytics: "Preview analytics",
  missions: "Preview mission progress",
  foodCred: "Preview score",
  mapStatus: "Preview map status",
  waitEstimate: "Preview wait estimate",
};

export function getDataTrustDisclosure(surface: DataTrustSurface): string {
  return getServiceProvider().mode === "supabase"
    ? SOURCED_LABELS[surface]
    : PREVIEW_LABELS[surface];
}
