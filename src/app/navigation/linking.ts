import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { WEB_BASE_URL } from "@/constants/links";
import { parseFilterIds } from "@/features/search/browseFilters";
import { MERCHANT_LINK_SCREENS } from "@/features/merchant/merchantDeepLinks";
import { parseShareSource, rememberShareAttribution } from "@/features/share/shareAttribution";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { sanitizeSearchQuery } from "@/lib/security/inputSanitization";

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
  index?: number;
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

  if (name === "ReviewDetail" && !isSafeDeepLinkId(next.reviewId)) {
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

  if (name === "UserProfile" && !isSafeDeepLinkId(next.authorId)) {
    return undefined;
  }

  if (name === "WheelStack") {
    // The join code rides on the nested WheelHome route, which is where WheelHome reads it.
    const nested =
      next.params && typeof next.params === "object"
        ? (next.params as Record<string, unknown>)
        : undefined;
    const code = nested?.code ?? next.code;
    if (code !== undefined && !isSafeJoinCode(code)) {
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

/**
 * With double confirmation of an email change, the first of the two links GoTrue sends
 * returns without a code but with "Confirmation link accepted. Please proceed to confirm
 * link sent to the other email". That is progress, not a failure.
 */
export function isPartialEmailChangeConfirmation(rawPath: string): boolean {
  const [beforeHash, hash = ""] = rawPath.split("#");
  const queryIndex = beforeHash.indexOf("?");
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";
  const message =
    new URLSearchParams(query).get("message") ?? new URLSearchParams(hash).get("message");
  return typeof message === "string" && /confirmation link accepted/i.test(message);
}

function createState(name: string, params?: Record<string, unknown>): LinkingState {
  return { routes: [params && Object.keys(params).length > 0 ? { name, params } : { name }] };
}

// Shared content links open on top of Home, so a cold start has a Back button
// (AppHeader shows Back only when navigation.canGoBack()).
function createStateOverHome(name: string, params?: Record<string, unknown>): LinkingState {
  const [target] = createState(name, params).routes;
  return { index: 1, routes: [{ name: "MainTabs", params: { screen: "Home" } }, target] };
}

// `pop` makes the nested AuthStack navigate back to an existing Login/SignUp
// screen instead of pushing a duplicate on every auth deep link.
function createAuthState(screen: string, params?: Record<string, unknown>): LinkingState {
  return createState("AuthStack", params ? { screen, params, pop: true } : { screen, pop: true });
}

/**
 * The Supabase provider renders dish and venue detail from released catalog rows,
 * whose ids copy public.dishes/venues ids.
 * Required lazily so linking stays importable without the service graph.
 */
function isCatalogDeepLinkMode(): boolean {
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
  // The confirmation link of a sign-in email change (the user is already signed in).
  // It has its own path so it never runs the sign-up path ("Email verified. Welcome").
  if (path === "auth/email-change") {
    const { code } = parseAuthCallbackParams(rawPath);
    if (code) return createAuthState("EmailChange", { code });
    return createAuthState(
      "EmailChange",
      isPartialEmailChangeConfirmation(rawPath) ? { otherLinkPending: true } : undefined,
    );
  }
  // OAuth returns are consumed by WebBrowser.openAuthSessionAsync.
  if (path === "auth/oauth") return undefined;
  // Weekly picks push opens https://usehungry.com/home.
  if (path === "home") return createState("MainTabs", { screen: "Home" });
  if (parts[0] === "catalog") {
    const kind = parts[1];
    const id = decodePathSegment(parts[2]);
    return id ? createState("CatalogRawDetail", { kind, id }) : undefined;
  }
  // Lunch and dinner suggestion pushes open https://usehungry.com/decide.
  if (path === "decide") return createStateOverHome("DecideForMeResult", { surface: "push" });
  if (parts[0] === "dish") {
    const dishId = decodePathSegment(parts[1]);
    if (!dishId) return undefined;
    return isCatalogDeepLinkMode()
      ? createStateOverHome("CatalogRawDetail", { kind: "dish", id: dishId })
      : createStateOverHome("DishDetail", { dishId });
  }
  if (parts[0] === "venue" || parts[0] === "stall") {
    const venueId = decodePathSegment(parts[1]);
    if (!venueId) return undefined;
    return isCatalogDeepLinkMode()
      ? createStateOverHome("CatalogRawDetail", { kind: "venue", id: venueId })
      : createStateOverHome("StallDetail", { venueId });
  }
  // Shared reviews: https://usehungry.com/review/:id
  if (FEATURE_FLAGS.reviewCreationEnabled && parts[0] === "review") {
    const reviewId = decodePathSegment(parts[1]);
    return reviewId ? createStateOverHome("ReviewDetail", { reviewId }) : undefined;
  }
  // The post composer, named for what it does. /order is the older name, kept as an alias.
  if (FEATURE_FLAGS.postCreationEnabled && (path === "post" || path === "order")) {
    return createState("Post", parseOrderDeepLinkQuery(rawPath));
  }
  if (FEATURE_FLAGS.activityEnabled && parts[0] === "post") {
    const postId = decodePathSegment(parts[1]);
    return postId ? createStateOverHome("ActivityPostDetail", { postId }) : undefined;
  }
  // Shared profiles: https://usehungry.com/user/:id (the screen loads the public name).
  if (parts[0] === "user") {
    const authorId = decodePathSegment(parts[1]);
    return authorId ? createStateOverHome("UserProfile", { authorId }) : undefined;
  }
  // Shared searches: https://usehungry.com/search?q=laksa&filter=Halal&mode=stalls
  if (path === "search") {
    return createStateOverHome("SearchResults", parseSearchDeepLinkQuery(rawPath));
  }
  if (FEATURE_FLAGS.portfoliosEnabled && parts[0] === "portfolio") {
    const portfolioId = decodePathSegment(parts[1]);
    return portfolioId ? createStateOverHome("PortfolioPublicView", { portfolioId }) : undefined;
  }
  if (FEATURE_FLAGS.merchantCentreEnabled && parts[0] === "merchant") {
    // Merchant notifications link to hungry://merchant/inbox, /analytics and so on.
    const screen =
      parts[1] && Object.prototype.hasOwnProperty.call(MERCHANT_LINK_SCREENS, parts[1])
        ? MERCHANT_LINK_SCREENS[parts[1]]
        : undefined;
    // Over Home so a cold start has a way back to customer mode instead of stranding the user.
    return screen
      ? createStateOverHome("MerchantTabs", { screen })
      : createStateOverHome("MerchantTabs");
  }
  if (FEATURE_FLAGS.hungryWheelEnabled && parts[0] === "join") {
    const code = decodePathSegment(parts[1]);
    return createState(
      "WheelStack",
      code ? { screen: "WheelHome", params: { code } } : { screen: "WheelHome" },
    );
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
  "ReviewDetail",
  "PortfolioPublicView",
  "UserProfile",
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

// Auth screens that only make sense signed out: a signed-in user who opens a "Log in" link
// (or an old confirmation email with no code) would be stranded there, so they go Home.
function isSignedOutOnlyAuthState(state: LinkingState): boolean {
  const activeRoute = state.routes[state.routes.length - 1];
  const params = activeRoute?.params as
    | { screen?: string; params?: Record<string, unknown> }
    | undefined;
  const screen = params?.screen;
  if (screen === "Login" || screen === "SignUp" || screen === "ForgotPassword") return true;
  return screen === "EmailVerification" && !params?.params?.code;
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
      // With Home as the initial route, a [MainTabs, target] link state on a
      // running app becomes a navigate to the target instead of a stack reset.
      initialRouteName: "MainTabs" as const,
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
            EmailChange: "auth/email-change",
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
        ...(FEATURE_FLAGS.postCreationEnabled ? { Post: "post" } : {}),
        ...(FEATURE_FLAGS.reviewCreationEnabled ? { ReviewDetail: "review/:reviewId" } : {}),
        // Social push notifications open the inbox or the follow requests (sign-in required).
        ...(FEATURE_FLAGS.activityEnabled ? { ActivityInbox: "activity" } : {}),
        FollowRequests: "follow-requests",
        UserProfile: "user/:authorId",
        SearchResults: "search",
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
                  CustomerInbox: "inbox",
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
      if (isAuthRouteState(state)) {
        const { isAuthReady, isAuthenticated } = getAuthState();
        if (isAuthReady && isAuthenticated && isSignedOutOnlyAuthState(state)) {
          return createState("MainTabs", { screen: "Home" });
        }
        return state;
      }
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

/**
 * Reads q, filter and mode from a search link; anything unexpected is dropped. The filter
 * allowlist is the set of filter chips on the results screen (one or several, comma
 * separated), so every chip state can be linked and nothing that is not a chip is accepted.
 */
export function parseSearchDeepLinkQuery(rawPath: string): Record<string, unknown> {
  const queryIndex = rawPath.indexOf("?");
  if (queryIndex < 0) return {};
  const params = new URLSearchParams(rawPath.slice(queryIndex + 1).split("#")[0]);
  const query = sanitizeSearchQuery(params.get("q") ?? "", 80);
  const filters = parseFilterIds(params.get("filter") ?? "");
  const mode = params.get("mode");
  return {
    ...(query ? { initialQuery: query } : {}),
    ...(filters.length ? { initialFilter: filters.join(",") } : {}),
    ...(mode === "stalls" || mode === "dishes" ? { browseMode: mode } : {}),
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
