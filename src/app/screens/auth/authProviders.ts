import { Platform } from "react-native";

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { AuthProvider } from "./authCopy";

/**
 * The sign-in providers to show on this device, in button order.
 *
 * Apple follows `oauthProvidersEnabled` (not in production yet). Google follows
 * `googleSignInEnabled` and never shows on iPhone: the App Store requires Sign in with Apple
 * next to any other third-party sign-in (rule 4.8), so iOS offers the email code only until
 * Apple ships. A provider that is not configured is not rendered, so no button can fail.
 */
export function getEnabledAuthProviders(
  platform: string = Platform.OS,
  flags: Pick<
    typeof FEATURE_FLAGS,
    "oauthProvidersEnabled" | "googleSignInEnabled"
  > = FEATURE_FLAGS,
): AuthProvider[] {
  const providers: AuthProvider[] = [];
  if (flags.oauthProvidersEnabled) providers.push("apple");
  if (flags.googleSignInEnabled && platform !== "ios") providers.push("google");
  return providers;
}
