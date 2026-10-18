import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { WEB_BASE_URL } from "@/constants/links";
import { trackAnalyticsEvent } from "@/lib/analytics";

const SAFE_DEEP_LINK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_JOIN_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const PROTECTED_DEEP_LINK_ROUTES = new Set([
  "MerchantTabs",
  "Post",
  "ActivityInbox",
  "ActivityPostDetail",
  "ChatDetail",
  "DirectMessages",
  "EditProfile",
  "Favourites",
  "ReviewHistory",
  "Settings",
  "ReviewStack",
  "AddStory",
  "MusicSelection",
  "MerchantClaimExplainer",
  "PassportScreen",
  "MissionsScreen",
  "AdminPortfolioFlags",
]);

interface LinkingAuthState {
  isAuthReady: boolean;
  isAuthenticated: boolean;
  /** Called with the protected route a signed-out user was sent to Login from. */
  onAuthRedirect?: (route: LinkingRoute) => void;
}

interface LinkingRoute {
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

  if (name === "ActivityPostDetail" && !isSafeDeepLinkId(next.postId)) {
    return undefined;
  }

  if (name === "PortfolioPublicView" && !isSafeDeepLinkId(next.portfolioId)) {
    return undefined;
  }

  if (name === "WheelStack") {
    if (next.code !== undefined && !isSafeJoinCode(next.code)) {
      return undefined;
    }
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

// `pop` makes the nested AuthStack navigate back to an existing Login/SignUp
// screen instead of pushing a duplicate on every auth deep link.
function createAuthState(screen: string, params?: Record<string, unknown>): LinkingState {
  return createState("AuthStack", params ? { screen, params, pop: true } : { screen, pop: true });
}

function parseAuthCallbackCode(rawPath: string): Record<string, unknown> | undefined {
  const queryIndex = rawPath.indexOf("?");
  if (queryIndex < 0) return undefined;
  const code = new URLSearchParams(rawPath.slice(queryIndex + 1).split("#")[0]).get("code");
  return code && SAFE_DEEP_LINK_ID_PATTERN.test(code) ? { code } : undefined;
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
    return createAuthState("ResetPassword", parseAuthCallbackCode(rawPath));
  }
  // Supabase confirms the address before redirecting; the user then signs in.
  if (path === "auth/confirm") return createAuthState("Login");
  // OAuth returns are consumed by WebBrowser.openAuthSessionAsync.
  if (path === "auth/oauth") return undefined;
  if (path === "auth/reset/success") return createAuthState("ResetPasswordSuccess");
  if (parts[0] === "dish") {
    const id = decodePathSegment(parts[1]);
    return id ? createState("DishDetail", { id }) : undefined;
  }
  if (parts[0] === "venue" || parts[0] === "stall") {
    const id = decodePathSegment(parts[1]);
    return id ? createState("StallDetail", { id }) : undefined;
  }
  if (parts[0] === "post") {
    const postId = decodePathSegment(parts[1]);
    return postId ? createState("ActivityPostDetail", { postId }) : undefined;
  }
  if (path === "order") return createState("Post", parseOrderDeepLinkQuery(rawPath));
  if (FEATURE_FLAGS.portfoliosEnabled && parts[0] === "portfolio") {
    return createState("PortfolioPublicView", { portfolioId: decodePathSegment(parts[1]) });
  }
  if (FEATURE_FLAGS.merchantCentreEnabled && parts[0] === "merchant") {
    return createState("MerchantTabs");
  }
  if (parts[0] === "join") return createState("WheelStack", { code: decodePathSegment(parts[1]) });
  return undefined;
}

function sanitizeLinkingState(state: LinkingState | undefined) {
  if (!state?.routes?.length) {
    return state;
  }

  const sanitizedRoutes = [];
  for (const route of state.routes) {
    const params = sanitizeRouteParams(String(route.name), route.params);
    if (route.params && !params) {
      return undefined;
    }
    sanitizedRoutes.push(params ? { ...route, params } : { ...route, params: undefined });
  }

  return {
    ...state,
    routes: sanitizedRoutes,
  };
}

const SHARED_LINK_ROUTES = new Set([
  "DishDetail",
  "StallDetail",
  "ActivityPostDetail",
  "PortfolioPublicView",
  "WheelStack",
]);

function trackSharedLinkOpened(state: LinkingState) {
  const route = state.routes[state.routes.length - 1];
  if (!route || !SHARED_LINK_ROUTES.has(String(route.name))) return;
  trackAnalyticsEvent("shared_link_opened", { route: String(route.name) });
}

function isProtectedDeepLinkState(state: LinkingState | undefined): boolean {
  const activeRoute = state?.routes?.[state.routes.length - 1];
  return Boolean(activeRoute && PROTECTED_DEEP_LINK_ROUTES.has(String(activeRoute.name)));
}

export function createRootLinking(
  prefix: string,
  getAuthState: () => LinkingAuthState = () => ({
    isAuthReady: true,
    isAuthenticated: true,
  }),
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
            ResetPassword: "auth/reset",
            ResetPasswordSuccess: "auth/reset/success",
          },
        },
        DishDetail: "dish/:id",
        StallDetail: "venue/:id",
        ActivityPostDetail: "post/:postId",
        Post: "order",
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
        WheelStack: {
          path: "join/:code",
          screens: {
            WheelHome: "",
          },
        },
      },
    },
    getStateFromPath(path: string) {
      const state = sanitizeLinkingState(buildStateFromPath(path));
      if (!state) {
        return undefined;
      }
      trackSharedLinkOpened(state);

      const { isAuthReady, isAuthenticated, onAuthRedirect } = getAuthState();
      if (!isAuthReady && isProtectedDeepLinkState(state)) {
        return undefined;
      }
      if (!isAuthenticated && isProtectedDeepLinkState(state)) {
        const protectedRoute = state.routes[state.routes.length - 1];
        if (protectedRoute) onAuthRedirect?.(protectedRoute);
        return createAuthState("Login");
      }

      return state;
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
  return isSafeDeepLinkId(venueId) ? { venueId } : {};
}
