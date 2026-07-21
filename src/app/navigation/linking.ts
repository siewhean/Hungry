import { FEATURE_FLAGS } from "@/constants/featureFlags";

const SAFE_DEEP_LINK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_JOIN_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export interface LinkingAuthState {
  isAuthReady: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding?: boolean;
}

export interface LinkingRoute {
  name: string;
  params?: Record<string, unknown>;
}

interface LinkingState {
  routes: LinkingRoute[];
}

function isSafeDeepLinkId(value: unknown): value is string {
  return typeof value === "string" && SAFE_DEEP_LINK_ID_PATTERN.test(value);
}

function isSafeJoinCode(value: unknown): value is string {
  return typeof value === "string" && SAFE_JOIN_CODE_PATTERN.test(value);
}

function sanitizeRouteParams(name: string, params: unknown): Record<string, unknown> | undefined {
  const next =
    params && typeof params === "object" ? { ...(params as Record<string, unknown>) } : {};

  if ((name === "DishDetail" || name === "StallDetail") && !isSafeDeepLinkId(next.id)) {
    return undefined;
  }

  if (name === "PortfolioPublicView" && !isSafeDeepLinkId(next.portfolioId)) {
    return undefined;
  }

  if (name === "WheelStack" && next.code !== undefined && !isSafeJoinCode(next.code)) {
    return undefined;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function decodePathSegment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function createState(name: string, params?: Record<string, unknown>): LinkingState {
  return { routes: [params && Object.keys(params).length > 0 ? { name, params } : { name }] };
}

function buildStateFromPath(rawPath: string): LinkingState | undefined {
  const [pathWithoutHash] = rawPath.split("#");
  const [pathname] = pathWithoutHash.split("?");
  const path = pathname.replace(/^\/+|\/+$/g, "");
  const parts = path.split("/").filter(Boolean);

  if (path === "login") return createState("AuthStack", { screen: "Login" });
  if (path === "signup") return createState("AuthStack", { screen: "SignUp" });
  if (path === "forgot-password") return createState("AuthStack", { screen: "ForgotPassword" });
  if (path === "auth/callback") return createState("AuthStack", { screen: "ResetPassword" });
  if (path === "auth/reset/success") {
    return createState("AuthStack", { screen: "ResetPasswordSuccess" });
  }
  if (parts[0] === "dish") {
    const id = decodePathSegment(parts[1]);
    return id ? createState("DishDetail", { id }) : undefined;
  }
  if (parts[0] === "venue") {
    const id = decodePathSegment(parts[1]);
    return id ? createState("StallDetail", { id }) : undefined;
  }
  if (path === "order") return createState("Post", parseOrderDeepLinkQuery(rawPath));
  if (FEATURE_FLAGS.prototypeRoutesEnabled && parts[0] === "portfolio") {
    const portfolioId = decodePathSegment(parts[1]);
    return portfolioId ? createState("PortfolioPublicView", { portfolioId }) : undefined;
  }
  if (FEATURE_FLAGS.merchantCentreEnabled && parts[0] === "merchant") {
    return createState("MerchantTabs");
  }
  if (parts[0] === "join") {
    const code = decodePathSegment(parts[1]);
    return code ? createState("WheelStack", { code }) : undefined;
  }
  return undefined;
}

function sanitizeLinkingState(state: LinkingState | undefined) {
  if (!state?.routes?.length) return state;

  const sanitizedRoutes: LinkingRoute[] = [];
  for (const route of state.routes) {
    const params = sanitizeRouteParams(String(route.name), route.params);
    if (route.params && !params) return undefined;
    sanitizedRoutes.push(params ? { ...route, params } : { ...route, params: undefined });
  }

  return { ...state, routes: sanitizedRoutes };
}

function isAuthRouteState(state: LinkingState | undefined): boolean {
  const activeRoute = state?.routes?.[state.routes.length - 1];
  return activeRoute?.name === "AuthStack";
}

function signedOutState(hasCompletedOnboarding: boolean | undefined): LinkingState {
  return hasCompletedOnboarding
    ? createState("AuthStack", { screen: "Login" })
    : createState("OnboardingStack", { screen: "OnboardingWelcome" });
}

export function createRootLinking(
  prefix: string,
  getAuthState: () => LinkingAuthState = () => ({
    isAuthReady: true,
    isAuthenticated: true,
    hasCompletedOnboarding: true,
  }),
  onProtectedRoute?: (route: LinkingRoute) => void,
) {
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
          screens: { WheelHome: "" },
        },
      },
    },
    getStateFromPath(path: string) {
      const state = sanitizeLinkingState(buildStateFromPath(path));
      if (!state) return undefined;
      if (isAuthRouteState(state)) return state;

      const { isAuthReady, isAuthenticated, hasCompletedOnboarding } = getAuthState();
      if (!isAuthReady) return undefined;
      if (!isAuthenticated) {
        const activeRoute = state.routes[state.routes.length - 1];
        if (activeRoute) onProtectedRoute?.(activeRoute);
        return signedOutState(hasCompletedOnboarding);
      }

      return state;
    },
  };
}

export function parseOrderDeepLinkQuery(rawPath: string): { venueId?: string } {
  const queryIndex = rawPath.indexOf("?");
  if (queryIndex < 0) return {};
  const query = rawPath.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  const venueId = params.get("venueId") ?? undefined;
  return isSafeDeepLinkId(venueId) ? { venueId } : {};
}
