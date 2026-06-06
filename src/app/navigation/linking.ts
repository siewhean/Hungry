import { FEATURE_FLAGS } from "@/constants/featureFlags";

export function createRootLinking(prefix: string) {
  return {
    prefixes: [prefix, "hungry://", "https://hungry.sg"],
    config: {
      screens: {
        AuthStack: {
          screens: {
            Login: "login",
            SignUp: "signup",
            ForgotPassword: "forgot-password",
            ResetPassword: "auth/callback",
            ResetPasswordSuccess: "auth/reset/success",
          },
        },
        DishDetail: "dish/:id",
        StallDetail: "venue/:id",
        Post: "order",
        ...(FEATURE_FLAGS.prototypeRoutesEnabled
          ? { PortfolioPublicView: "portfolio/:portfolioId" }
          : {}),
        ...(FEATURE_FLAGS.merchantCentreEnabled
          ? {
              MerchantTabs: {
                path: "merchant",
                screens: {
                  Dashboard: "",
                  Menu: "menu",
                  Analytics: "analytics",
                  Profile: "profile",
                  VerificationCentre: "verification",
                  MerchantSettings: "settings",
                },
              },
            }
          : {}),
        WheelStack: {
          path: "join/:code",
          screens: {
            WheelHome: "",
          },
        },
      },
    },
  };
}

export function parseOrderDeepLinkQuery(rawPath: string): { venueId?: string } {
  const queryIndex = rawPath.indexOf("?");
  if (queryIndex < 0) {
    return {};
  }

  const query = rawPath.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  const venueId = params.get("venueId") ?? undefined;
  return venueId ? { venueId } : {};
}
