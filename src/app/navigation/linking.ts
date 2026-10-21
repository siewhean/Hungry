import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { WEB_BASE_URL } from "@/constants/links";
import { MERCHANT_LINK_SCREENS } from "@/features/merchant/merchantDeepLinks";
import { parseShareSource, rememberShareAttribution } from "@/features/share/shareAttribution";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { sanitizeSearchQuery } from "@/lib/security/inputSanitization";

const SAFE_DEEP_LINK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_JOIN_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const PROTECTED_DEEP_LINK_ROUTES = new Set([
  "MerchantTabs",
  "Post",
  "ActivityInbox",
  "ChatDetail",
  "DirectMessages",
  "EditProfile",
  "Favourites",
  "ReviewHistory",
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

  if ((name === "DishDetail" || name === "StallDetail") && !isSafeDeepLinkId(next.id)) {
    return undefined;
  }

  if (name === "ActivityPostDetail" && !isSafeDeepLinkId(next.postId)) {
    return undefined;
  }

  if (name === "ReviewDetail" && !isSafeDeepLinkId(next.reviewId)) {
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

function parseAuthCallbackCode(rawPath: string): Record<string, unknown> | undefined {
  const queryIndex = rawPath.indexOf("?");
  if (queryIndex < 0) return undefined;
  const code = new URLSearchParams(rawPath.slice(queryIndex + 1).split("#")[0]).get("code");
  return code && SAFE_DEEP_LINK_ID_PATTERN.test(code) ? { code } : undefined;
}

// Supabase redirects a dead reset link (expired, already used) to the same URL with
// `error`, `error_code` (e.g. otp_expired) and `error_description` in the query or, for
// older flows, the fragment. Surfacing it lets the screen say so before anything is typed.
function parseAuthCallbackParams(rawPath: string): Record<string, unknown> | undefined {
  const query = rawPath.includes("?") ? rawPath.slice(rawPath.indexOf("?") + 1).split("#")[0] : "";
  const fragment = rawPath.includes("#") ? rawPath.slice(rawPath.indexOf("#") + 1) : "";
  const read = (name: string) =>
    new URLSearchParams(query).get(name) ?? new URLSearchParams(fragment).get(name);
  if (read("error") || read("error_code")) {
    return { linkError: read("error_code") === "otp_expired" ? "expired" : "invalid" };
  }
  return parseAuthCallbackCode(rawPath);
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
    return createAuthState("ResetPassword", parseAuthCallbackParams(rawPath));
  }
  // The confirmation link carries a PKCE code; EmailVerification exchanges it for a
  // session. Without a code there is nothing to exchange, so the user signs in.
  if (path === "auth/confirm") {
    const params = parseAuthCallbackCode(rawPath);
    return params ? createAuthState("EmailVerification", params) : createAuthState("Login");
  }
  // The confirmation link of a sign-in email change (the user is already signed in).
  // It has its own path so it never runs the sign-up path ("Email verified. Welcome").
  if (path === "auth/email-change") {
    return createAuthState("EmailChange", parseAuthCallbackCode(rawPath));
  }
  // OAuth returns are consumed by WebBrowser.openAuthSessionAsync.
  if (path === "auth/oauth") return undefined;
  // Weekly picks push opens https://usehungry.com/home.
  if (path === "home") return createState("MainTabs", { screen: "Home" });
  // Lunch and dinner suggestion pushes open https://usehungry.com/decide.
  if (path === "decide") return createStateOverHome("DecideForMeResult", { surface: "home" });
  if (parts[0] === "dish") {
    const id = decodePathSegment(parts[1]);
    return id ? createStateOverHome("DishDetail", { id }) : undefined;
  }
  if (parts[0] === "venue" || parts[0] === "stall") {
    const id = decodePathSegment(parts[1]);
    return id ? createStateOverHome("StallDetail", { id }) : undefined;
  }
  // Shared reviews: https://usehungry.com/review/:id
  if (parts[0] === "review") {
    const reviewId = decodePathSegment(parts[1]);
    return reviewId ? createStateOverHome("ReviewDetail", { reviewId }) : undefined;
  }
  // The post composer, named for what it does. /order is the older name, kept as an alias.
  if (path === "post" || path === "order") {
    return createState("Post", parseOrderDeepLinkQuery(rawPath));
  }
  if (parts[0] === "post") {
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
    return createStateOverHome("PortfolioPublicView", {
      portfolioId: decodePathSegment(parts[1]),
    });
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
  if (parts[0] === "join") {
    const code = decodePathSegment(parts[1]);
    return createState(
      "WheelStack",
      code ? { screen: "WheelHome", params: { code } } : { screen: "WheelHome" },
    );
  }
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
      // With Home as the initial route, a [MainTabs, target] link state on a
      // running app becomes a navigate to the target instead of a stack reset.
      initialRouteName: "MainTabs" as const,
      screens: {
        AuthStack: {
          screens: {
            Login: "login",
            SignUp: "signup",
            ForgotPassword: "forgot-password",
            ResetPassword: "auth/reset",
            EmailChange: "auth/email-change",
          },
        },
        MainTabs: {
          screens: {
            Home: "home",
          },
        },
        DishDetail: "dish/:id",
        StallDetail: "venue/:id",
        ActivityPostDetail: "post/:postId",
        ReviewDetail: "review/:reviewId",
        UserProfile: "user/:authorId",
        Post: "post",
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
      trackSharedLinkOpened(state, path);

      // On a cold start auth may not be settled yet. Don't drop the link:
      // a restored session opens it (the root auth guard sends the person to
      // Login with it as the return route if the session turns out invalid),
      // and no session sends them to Login with it saved as the return route.
      const { isAuthenticated, onAuthRedirect } = getAuthState();
      if (!isAuthenticated && isProtectedDeepLinkState(state)) {
        const protectedRoute = state.routes[state.routes.length - 1];
        if (protectedRoute) onAuthRedirect?.(protectedRoute);
        return createAuthState("Login");
      }

      return state;
    },
  };
}

const SEARCH_LINK_FILTERS = new Set([
  "All",
  "Local",
  "Halal",
  "Japanese",
  "Western",
  "Noodles",
  "Rice",
  "Spicy",
]);

/** Reads q, filter and mode from a search link; anything unexpected is dropped. */
export function parseSearchDeepLinkQuery(rawPath: string): Record<string, unknown> {
  const queryIndex = rawPath.indexOf("?");
  if (queryIndex < 0) return {};
  const params = new URLSearchParams(rawPath.slice(queryIndex + 1).split("#")[0]);
  const query = sanitizeSearchQuery(params.get("q") ?? "", 80);
  const filter = params.get("filter") ?? "";
  const mode = params.get("mode");
  return {
    ...(query ? { initialQuery: query } : {}),
    ...(SEARCH_LINK_FILTERS.has(filter) ? { initialFilter: filter } : {}),
    ...(mode === "stalls" || mode === "dishes" ? { browseMode: mode } : {}),
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
