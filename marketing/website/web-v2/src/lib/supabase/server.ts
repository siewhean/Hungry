type SupabaseFetchOptions = {
  accessToken?: string;
  body?: unknown;
  cache?: RequestCache;
  policy?: SupabaseCachePolicyType;
  headers?: HeadersInit;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  params?: Record<string, string | number | boolean | undefined | null>;
  revalidateSeconds?: number;
  prefer?: string;
  serviceRole?: boolean;
};

export type SupabaseCachePolicy = {
  cache: RequestCache;
  revalidateSeconds?: number;
};

export const SUPABASE_CACHE_POLICIES = {
  staticRender: {
    cache: "force-cache" as const,
    revalidateSeconds: 3600,
  },
  criticalRender: {
    cache: "force-cache" as const,
    revalidateSeconds: 900,
  },
  onDemand: {
    cache: "no-store" as const,
  },
  mutations: {
    cache: "no-store" as const,
  },
} satisfies Record<string, SupabaseCachePolicy>;

type SupabaseCachePolicyType = keyof typeof SUPABASE_CACHE_POLICIES;

export function getSupabaseCachePolicy(type: SupabaseCachePolicyType) {
  return SUPABASE_CACHE_POLICIES[type];
}

export type SupabaseConfigStatus = {
  anonKeyConfigured: boolean;
  serviceRoleConfigured: boolean;
  urlConfigured: boolean;
};

export type SupabaseUser = {
  id: string;
  email?: string;
};

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  "";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ||
  "";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.HUNGRY_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  "";

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  return {
    anonKeyConfigured: SUPABASE_ANON_KEY.length > 0,
    serviceRoleConfigured: SUPABASE_SERVICE_ROLE_KEY.length > 0,
    urlConfigured: SUPABASE_URL.length > 0,
  };
}

export function isSupabasePublicConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

export function isSupabaseServiceConfigured(): boolean {
  return isSupabasePublicConfigured() && SUPABASE_SERVICE_ROLE_KEY.length > 0;
}

function requireSupabaseUrl() {
  if (!SUPABASE_URL) {
    throw new Error("Supabase URL is not configured for the Hungry website.");
  }
  return SUPABASE_URL.replace(/\/$/, "");
}

function getRequestKey(serviceRole?: boolean) {
  if (serviceRole) {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Supabase service role key is not configured for server-side website access.",
      );
    }
    return SUPABASE_SERVICE_ROLE_KEY;
  }

  if (!SUPABASE_ANON_KEY) {
    throw new Error("Supabase anon/publishable key is not configured for the Hungry website.");
  }
  return SUPABASE_ANON_KEY;
}

function buildUrl(path: string, params?: SupabaseFetchOptions["params"]) {
  const url = new URL(`${requireSupabaseUrl()}/${path.replace(/^\//, "")}`);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getRequestCacheLabel(cache: RequestCache) {
  if (cache === "default") return "default";
  if (cache === "force-cache") return "force-cache";
  if (cache === "no-store") return "no-store";
  if (cache === "reload") return "reload";
  if (cache === "no-cache") return "no-cache";
  if (cache === "only-if-cached") return "only-if-cached";
  return "custom";
}

function getResponseCacheHint(response: Response) {
  const cacheHeader = response.headers.get("x-nextjs-cache");
  if (cacheHeader) return cacheHeader;
  const vercelCache = response.headers.get("x-vercel-cache");
  if (vercelCache) return vercelCache;
  const age = response.headers.get("age");
  if (age) return `age:${age}`;
  const cacheControl = response.headers.get("cache-control");
  return cacheControl ? `control:${cacheControl}` : "unavailable";
}

export async function supabaseFetch<T>(
  path: string,
  {
    accessToken,
    body,
    cache,
    policy = "onDemand",
    headers,
    method = "GET",
    params,
    revalidateSeconds,
    prefer,
    serviceRole = false,
  }: SupabaseFetchOptions = {},
): Promise<{ data: T; response: Response }> {
  const startedAt = globalThis.performance?.now() ?? Date.now();
  const resolvedPolicy = getSupabaseCachePolicy(policy);
  const effectiveCache: RequestCache = cache ?? resolvedPolicy.cache;
  const effectiveRevalidateSeconds =
    revalidateSeconds ??
    ("revalidateSeconds" in resolvedPolicy ? resolvedPolicy.revalidateSeconds : undefined);
  const requestKey = getRequestKey(serviceRole);
  const authorization = accessToken ?? requestKey;
  const next = effectiveRevalidateSeconds ? { revalidate: effectiveRevalidateSeconds } : undefined;
  const cacheHeader = effectiveCache;
  const response = await fetch(buildUrl(path, params), {
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: effectiveCache,
    next,
    headers: {
      apikey: requestKey,
      Authorization: `Bearer ${authorization}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
      ...headers,
    },
    method,
  });

  if (process.env.NODE_ENV === "development") {
    const durationMs = Math.round((globalThis.performance?.now() ?? Date.now()) - startedAt);
    console.debug(
      `[WebsiteData] ${method} ${path} cache=${getRequestCacheLabel(cacheHeader)} revalidate=${
        effectiveRevalidateSeconds ?? "-"
      } durationMs=${durationMs} cacheState=${getResponseCacheHint(response)}`,
    );
  }

  const payload = await readResponseBody(response);
  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : typeof payload === "string"
          ? payload
          : response.statusText;
    throw new Error(`Supabase ${method} ${path} failed: ${detail}`);
  }

  return { data: payload as T, response };
}

export async function supabaseFetchStatic<T>(
  path: string,
  options: Omit<SupabaseFetchOptions, "cache" | "revalidateSeconds"> = {},
) {
  return supabaseFetch<T>(path, {
    ...options,
    ...SUPABASE_CACHE_POLICIES.staticRender,
  });
}

export async function supabaseFetchCritical<T>(
  path: string,
  options: Omit<SupabaseFetchOptions, "cache" | "revalidateSeconds"> = {},
) {
  return supabaseFetch<T>(path, {
    ...options,
    ...SUPABASE_CACHE_POLICIES.criticalRender,
  });
}

export async function supabaseFetchOnDemand<T>(
  path: string,
  options: Omit<SupabaseFetchOptions, "cache" | "revalidateSeconds"> = {},
) {
  return supabaseFetch<T>(path, {
    ...options,
    ...SUPABASE_CACHE_POLICIES.onDemand,
  });
}

export async function supabaseCount(
  table: string,
  params: SupabaseFetchOptions["params"] = {},
  options: Pick<SupabaseFetchOptions, "accessToken" | "serviceRole"> = {},
): Promise<number> {
  const { response } = await supabaseFetch<unknown>(`rest/v1/${table}`, {
    ...options,
    headers: { Range: "0-0" },
    params: { select: "id", ...params },
    prefer: "count=exact",
  });
  const contentRange = response.headers.get("content-range") ?? "";
  const total = Number(contentRange.split("/").at(-1));
  return Number.isFinite(total) ? total : 0;
}

export async function signInWithPassword(email: string, password: string) {
  if (!isSupabasePublicConfigured()) {
    throw new Error("Supabase Auth is not configured for the Hungry website.");
  }

  const response = await fetch(buildUrl("auth/v1/token", { grant_type: "password" }), {
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = await readResponseBody(response);
  if (!response.ok) {
    throw new Error("Invalid merchant email or password.");
  }
  return payload as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    user?: SupabaseUser;
  };
}

export async function signUpWithPassword({
  businessName,
  email,
  name,
  password,
  redirectTo,
}: {
  businessName?: string;
  email: string;
  name?: string;
  password: string;
  redirectTo?: string;
}) {
  if (!isSupabasePublicConfigured()) {
    throw new Error("Supabase Auth is not configured for the Hungry website.");
  }

  const response = await fetch(
    buildUrl("auth/v1/signup", redirectTo ? { redirect_to: redirectTo } : undefined),
    {
      body: JSON.stringify({
        data: {
          business_name: businessName,
          full_name: name,
          signup_source: "merchant_portal",
        },
        email,
        password,
      }),
      cache: "no-store",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = await readResponseBody(response);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "msg" in payload
        ? String((payload as { msg?: unknown }).msg)
        : "Unable to create merchant account.";
    throw new Error(message);
  }
  return payload as {
    access_token?: string;
    user?: SupabaseUser;
  };
}

export async function sendPasswordResetEmail(email: string, redirectTo?: string) {
  if (!isSupabasePublicConfigured()) {
    throw new Error("Supabase Auth is not configured for the Hungry website.");
  }

  const response = await fetch(
    buildUrl("auth/v1/recover", redirectTo ? { redirect_to: redirectTo } : undefined),
    {
      body: JSON.stringify({ email }),
      cache: "no-store",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error("Unable to send reset instructions.");
  }
}

export async function getUserFromAccessToken(accessToken: string): Promise<SupabaseUser> {
  const { data } = await supabaseFetch<SupabaseUser>("auth/v1/user", {
    accessToken,
  });
  if (!data?.id) {
    throw new Error("Supabase user session is invalid.");
  }
  return data;
}
