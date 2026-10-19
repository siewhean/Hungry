import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

/**
 * Links stored on merchant notifications. Each is a hungry:// path the root linking config
 * maps to a Merchant Centre screen (see MERCHANT_LINK_SCREENS).
 */
export const MERCHANT_DEEP_LINKS = {
  inbox: "hungry://merchant/inbox",
  analytics: "hungry://merchant/analytics",
  settings: "hungry://merchant/settings",
} as const;

/** Path segment after "merchant/" for each Merchant Centre screen reachable by link. */
export const MERCHANT_LINK_SCREENS: Record<string, keyof MerchantTabParamList> = {
  menu: "Menu",
  analytics: "Analytics",
  profile: "Profile",
  verification: "VerificationCentre",
  settings: "MerchantSettings",
  inbox: "CustomerInbox",
};
