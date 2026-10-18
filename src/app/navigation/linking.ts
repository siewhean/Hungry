import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { WEB_BASE_URL } from "@/constants/links";
import { parseShareSource, rememberShareAttribution } from "@/features/share/shareAttribution";
import { trackAnalyticsEvent } from "@/lib/analytics";

const SAFE_DEEP_LINK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_JOIN_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export interface LinkingAuthState {
  isAuthReady: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding?: boolean;
  /** Called with the route a signed-out user was sent to onboarding/Login from. */
  onAuthRedirect?: (route: LinkingRoute) => void;
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

  if (name === "DishDetail" && !isSafeDeepLinkId(next.dishId ?? next.id)) {
    return undefined;
  }

  if (name === "StallDetail" && !isSafeDeepLinkId(next.venueId ?? next.id)) {
    return undefined;
  }

  if (name === "ActivityPostDetail" && !isSafeDeepLinkId(next.postId)) {
    return undefined;
  }

  if (
    name === "CatalogRawDetail" &&
    (!isSafeDeepLinkId(next.id) || (next.kind !== "dish" && next.kind !== "venue"))
  ) {
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

export type AuthCallbackError = "expired" | "invalid";

/**
 * Reads the Supabase PKCE callback params (`?code=` or `?error=&error_code=`)
 * from a deep-link path. Supabase may put errors in the query or the fragment.
 * Only a safe opaque code and a coarse error kind are forwarded to screens.
 */
export function parseAuthCallbackParams(rawPath: string): {
  code?: string;
  error?: AuthCallbackError;
} {
  const [beforeHash, hash = ""] = rawPath.split("#");
  const queryIndex = beforeHash.indexOf("?");
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";
  const queryParams = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);
  const read = (key: string) => queryParams.get(key) ?? hashParams.get(key) ?? undefined;

  const errorValue = read("error");
  const errorCode = read("error_code");
  if (errorValue || errorCode) {
    return { error: errorCode === "otp_expired" ? "expired" : "invalid" };
  }

  const code = read("code");
  if (code === undefined) return {};
  return isSafeDeepLinkId(code) ? { code } : { error: "invalid" };
}

function createState(name: string, params?: Record<string, unknown>): LinkingState {
  return { routes: [params && Object.keys(params).length > 0 ? { name, params } : { name }] };
}

// `pop` makes the nested AuthStack navigate back to an existing Login/SignUp
// screen instead of pushing a duplicate on every auth deep link.
function createAuthState(screen: string, params?: Record<string, unknown>): LinkingState {
  return createState("AuthStack", params ? { screen, params, pop: true } : { screen, pop: true });
}

/**
 * Released catalog reads (catalogReadV2 on the Supabase provider) render dish and
 * venue detail from catalog rows, whose ids copy public.dishes/venues ids.
 * Required lazily so linking stays importable without the service graph.
 */
function isCatalogDeepLinkMode(): boolean {
  if (!FEATURE_FLAGS.catalogReadV2) return false;
  try {
    const { getServiceProvider } =
      require("@/lib/services/serviceProvider") as typeof import("@/lib/services/serviceProvider");
    return getServiceProvider().mode === "supabase";
  } catch {
    return false;
  }
}

function buildStateFromPath(rawPath: string): LinkingState | undefined {
  const [pathWithoutHash] = rawPath.split("#");
  const [pathname] = pathWithoutHash.split("?");
  const path = pathname.replace(/^\/+|\/+$/g, "");
  const parts = path.split("/").filter(Boolean);

  if (path === "login") return createAuthState("Login");
  if (path === "signup") return createAuthState("SignUp");
  if (path === "forgot-password") return createAuthState("ForgotPassword");
  // auth/callback is the pre-split password-reset path, kept for old emails.
  if (path === "auth/reset" || path === "auth/callback") {
    const callback = parseAuthCallbackParams(rawPath);
    return createAuthState(
      "ResetPassword",
      Object.keys(callback).length > 0 ? callback : undefined,
    );
  }
  if (path === "auth/confirm") {
    const callback = parseAuthCallbackParams(rawPath);
    return createAuthState(
      "EmailVerification",
      Object.keys(callback).length > 0 ? callback : undefined,
    );
  }
  // OAuth returns are consumed by WebBrowser.openAuthSessionAsync.
  if (path === "auth/oauth") return undefined;
  if (path === "auth/reset/success") return createAuthState("ResetPasswordSuccess");
  // Weekly picks push opens https://usehungry.com/home (signed-in users only).
  if (path === "home") return createState("MainTabs", { screen: "Home" });
  if (parts[0] === "catalog") {
    const kind = parts[1];
    const id = decodePathSegment(parts[2]);
    return id ? createState("CatalogRawDetail", { kind, id }) : undefined;
  }
  if (parts[0] === "dish") {
    const dishId = decodePathSegment(parts[1]);
    if (!dishId) return undefined;
    return isCatalogDeepLinkMode()
      ? createState("CatalogRawDetail", { kind: "dish", id: dishId })
      : createState("DishDetail", { dishId });
  }
  if (parts[0] === "venue" || parts[0] === "stall") {
    const venueId = decodePathSegment(parts[1]);
    if (!venueId) return undefined;
    return isCatalogDeepLinkMode()
      ? createState("CatalogRawDetail", { kind: "venue", id: venueId })
      : createState("StallDetail", { venueId });
  }
  if (FEATURE_FLAGS.activityEnabled && parts[0] === "post") {
    const postId = decodePathSegment(parts[1]);
    return postId ? createState("ActivityPostDetail", { postId }) : undefined;
  }
  if (FEATURE_FLAGS.postCreationEnabled && path === "order") {
    return createState("Post", parseOrderDeepLinkQuery(rawPath));
  }
  if (FEATURE_FLAGS.portfoliosEnabled && parts[0] === "portfolio") {
    const portfolioId = decodePathSegment(parts[1]);
    return portfolioId ? createState("PortfolioPublicView", { portfolioId }) : undefined;
  }
  if (FEATURE_FLAGS.merchantCentreEnabled && parts[0] === "merchant") {
    return createState("MerchantTabs");
  }
  if (FEATURE_FLAGS.hungryWheelEnabled && parts[0] === "join") {
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

const SHARED_LINK_ROUTES = new Set([
  "DishDetail",
  "StallDetail",
  "CatalogRawDetail",
  "ActivityPostDetail",
  "PortfolioPublicView",
  "WheelStack",
]);

function trackSharedLinkOpened(state: LinkingState, rawPath: string) {
  const route = state.routes[state.routes.length - 1];
  if (!route || !SHARED_LINK_ROUTES.has(String(route.name))) return;
  const source = parseShareSource(rawPath);
  if (source) rememberShareAttribution({ source, route: String(route.name) });
  trackAnalyticsEvent("shared_link_opened", {
    route: String(route.name),
    ...(source ? { share_source: source } : {}),
  });
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
    prefixes: [prefix, "hungry://", WEB_BASE_URL],
    config: {
      screens: {
        AuthStack: {
          screens: {
            Login: "login",
            SignUp: "signup",
            ForgotPassword: "forgot-password",
            // EmailVerification is intentionally not mapped here: auth/confirm is
            // parsed in buildStateFromPath only, so in-app navigation to the
            // verification screen never writes /auth/confirm into the web URL
            // (which would re-open AuthStack when the signed-in navigator mounts).
            ResetPassword: "auth/reset",
            ResetPasswordSuccess: "auth/reset/success",
          },
        },
        MainTabs: {
          screens: {
            Home: "home",
          },
        },
        // Param names match what callers pass (dishId/venueId) so generated URLs
        // never render as /venue/undefined.
        DishDetail: "dish/:dishId",
        StallDetail: "venue/:venueId",
        CatalogRawDetail: "catalog/:kind/:id",
        ...(FEATURE_FLAGS.activityEnabled ? { ActivityPostDetail: "post/:postId" } : {}),
        ...(FEATURE_FLAGS.postCreationEnabled ? { Post: "order" } : {}),
        ...(FEATURE_FLAGS.portfoliosEnabled
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
        ...(FEATURE_FLAGS.hungryWheelEnabled
          ? {
              WheelStack: {
                path: "join/:code",
                screens: { WheelHome: "" },
              },
            }
          : {}),
      },
    },
    getStateFromPath(path: string) {
      const state = sanitizeLinkingState(buildStateFromPath(path));
      if (!state) return undefined;
      if (isAuthRouteState(state)) return state;
      trackSharedLinkOpened(state, path);

      // Mandatory sign-in: no app route opens without an authenticated session.
      // The link is remembered as the return route (Splash and the post-login
      // navigation consume it) instead of being dropped, including on a cold
      // start while auth is still settling.
      const { isAuthReady, isAuthenticated, hasCompletedOnboarding, onAuthRedirect } =
        getAuthState();
      const activeRoute = state.routes[state.routes.length - 1];
      const rememberRoute = (route: LinkingRoute | undefined) => {
        if (!route) return;
        onAuthRedirect?.(route);
        onProtectedRoute?.(route);
      };
      if (!isAuthReady) {
        rememberRoute(activeRoute);
        return undefined;
      }
      if (!isAuthenticated) {
        rememberRoute(activeRoute);
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
