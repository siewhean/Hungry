import {
  isSupabasePublicConfigured,
  supabaseFetchCritical,
  supabaseFetchOnDemand,
} from "@/lib/supabase/server";

// Data for the public preview pages behind links shared from the app
// (usehungry.com/dish/:id, /stall/:id, /portfolio/:id). Reads use the anon key,
// so RLS decides what a signed-out visitor can see.

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SharedDish = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  updatedAt: string | null;
  stall: {
    id: string;
    name: string;
    unitNumber: string;
    floor: string;
    mapsUrl: string | null;
  } | null;
};

export type SharedStall = {
  id: string;
  name: string;
  unitNumber: string;
  floor: string;
  operatingHours: string;
  mapsUrl: string | null;
  dishes: { id: string; name: string; price: number }[];
};

export type SharedPortfolio = {
  id: string;
  name: string;
  description: string | null;
  ownerDisplayName: string | null;
  updatedAt: string | null;
  items: {
    itemType: "dish" | "stall";
    dishId: string | null;
    stallId: string | null;
    name: string | null;
    stallName: string | null;
    price: number | null;
    publicNotes: string | null;
    imageUrl: string | null;
    mapsUrl: string | null;
  }[];
};

type DishRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  media_approved_for_display?: boolean | null;
  updated_at?: string | null;
  venue_id: string;
};

type VenueRow = {
  id: string;
  name: string;
  unit_number: string | null;
  floor: string | null;
  operating_hours: string | null;
  address?: string | null;
  postal_code?: string | null;
  building_id?: string | null;
};

type BuildingRow = {
  id: string;
  name: string | null;
  address: string | null;
  postal_code: string | null;
};

const VENUE_SELECT = "id,name,unit_number,floor,operating_hours,address,postal_code,building_id";

async function fetchRows<T>(table: string, params: Record<string, string>): Promise<T[]> {
  if (!isSupabasePublicConfigured()) return [];
  try {
    const { data } = await supabaseFetchCritical<T[]>(`rest/v1/${table}`, { params });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function mapsSearchUrl(query: string | null | undefined) {
  const trimmed = query?.trim();
  return trimmed
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
    : null;
}

async function fetchBuilding(id: string | null | undefined): Promise<BuildingRow | null> {
  if (!id || !SAFE_ID_PATTERN.test(id)) return null;
  const [building] = await fetchRows<BuildingRow>("buildings", {
    id: `eq.${id}`,
    select: "id,name,address,postal_code",
    limit: "1",
  });
  return building ?? null;
}

function toVenue(row: VenueRow, building: BuildingRow | null) {
  const postalCode = row.postal_code ?? building?.postal_code;
  return {
    id: row.id,
    name: row.name,
    unitNumber: row.unit_number ?? "",
    floor: row.floor ?? "",
    operatingHours: row.operating_hours ?? "",
    mapsUrl: mapsSearchUrl(
      [
        row.name,
        row.unit_number,
        building?.name,
        row.address ?? building?.address,
        postalCode ? `Singapore ${postalCode}` : null,
      ]
        .filter(Boolean)
        .join(", "),
    ),
  };
}

export async function getSharedDish(id: string): Promise<SharedDish | null> {
  if (!SAFE_ID_PATTERN.test(id)) return null;
  const [dish] = await fetchRows<DishRow>("dishes", {
    id: `eq.${id}`,
    select: "id,name,description,price,image_url,media_approved_for_display,updated_at,venue_id",
    limit: "1",
  });
  if (!dish) return null;

  const [venue] = await fetchRows<VenueRow>("venues", {
    id: `eq.${dish.venue_id}`,
    select: VENUE_SELECT,
    limit: "1",
  });
  const building = venue ? await fetchBuilding(venue.building_id) : null;

  return {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    price: Number(dish.price) || 0,
    imageUrl: dish.media_approved_for_display ? dish.image_url : null,
    updatedAt: dish.updated_at ?? null,
    stall: venue ? toVenue(venue, building) : null,
  };
}

export async function getSharedStall(id: string): Promise<SharedStall | null> {
  if (!SAFE_ID_PATTERN.test(id)) return null;
  const [venue] = await fetchRows<VenueRow>("venues", {
    id: `eq.${id}`,
    select: VENUE_SELECT,
    limit: "1",
  });
  if (!venue) return null;
  const building = await fetchBuilding(venue.building_id);

  const dishes = await fetchRows<DishRow>("dishes", {
    venue_id: `eq.${id}`,
    select: "id,name,price",
    order: "review_count.desc",
    limit: "8",
  });

  return {
    ...toVenue(venue, building),
    dishes: dishes.map((dish) => ({
      id: dish.id,
      name: dish.name,
      price: Number(dish.price) || 0,
    })),
  };
}

type PortfolioRpcRow = {
  id: string;
  name: string;
  description: string | null;
  owner_display_name: string | null;
  updated_at: string | null;
  items: {
    item_type: "dish" | "stall";
    dish_id: string | null;
    stall_id: string | null;
    name: string | null;
    stall_name: string | null;
    price: number | string | null;
    public_notes: string | null;
    image_url?: string | null;
    map_query?: string | null;
  }[];
};

export async function getSharedPortfolio(id: string): Promise<SharedPortfolio | null> {
  if (!UUID_PATTERN.test(id) || !isSupabasePublicConfigured()) return null;
  try {
    // Not cached: an owner can make a list private again at any time.
    const { data } = await supabaseFetchOnDemand<PortfolioRpcRow | null>(
      "rest/v1/rpc/get_public_portfolio",
      { method: "POST", body: { p_portfolio_id: id } },
    );
    if (!data || typeof data !== "object") return null;
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      ownerDisplayName: data.owner_display_name,
      updatedAt: data.updated_at,
      items: (data.items ?? []).map((item) => ({
        itemType: item.item_type,
        dishId: item.dish_id,
        stallId: item.stall_id,
        name: item.name,
        stallName: item.stall_name,
        price: item.price === null ? null : Number(item.price),
        publicNotes: item.public_notes,
        imageUrl: item.image_url ?? null,
        mapsUrl: mapsSearchUrl(item.map_query),
      })),
    };
  } catch {
    return null;
  }
}

export type SharedProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  dishesReviewed: number;
  stallsVisited: number;
};

type PublicProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  dishes_reviewed: number | null;
  stalls_visited: number | null;
};

/** usehungry.com/user/:id. public_profiles RLS hides private accounts from signed-out visitors. */
export async function getSharedProfile(id: string): Promise<SharedProfile | null> {
  if (!UUID_PATTERN.test(id) || !isSupabasePublicConfigured()) return null;
  try {
    // Not cached: a person can make their account private at any time.
    const { data } = await supabaseFetchOnDemand<PublicProfileRow[]>("rest/v1/public_profiles", {
      params: {
        id: `eq.${id}`,
        select: "id,display_name,avatar_url,bio,dishes_reviewed,stalls_visited",
        limit: "1",
      },
    });
    const row = Array.isArray(data) ? data[0] : undefined;
    if (!row) return null;
    // Only https avatars are shown; storage paths or other schemes are dropped.
    const avatarUrl = row.avatar_url?.startsWith("https://") ? row.avatar_url : null;
    return {
      id: row.id,
      displayName: row.display_name?.trim() || "Hungry member",
      avatarUrl,
      bio: row.bio?.trim() || null,
      dishesReviewed: Number(row.dishes_reviewed ?? 0),
      stallsVisited: Number(row.stalls_visited ?? 0),
    };
  } catch {
    return null;
  }
}

export function formatPrice(price: number) {
  return `S$${price.toFixed(2)}`;
}

export function formatUpdated(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Singapore",
  });
}

const SHARE_SOURCES = new Set(["whatsapp", "telegram", "system_share", "copy_link"]);

/** The app's ?src= share tag, kept only when it is one the app sets. */
export function readShareSource(value: string | string[] | undefined): string | null {
  const source = Array.isArray(value) ? value[0] : value;
  return source && SHARE_SOURCES.has(source) ? source : null;
}

export function appDeepLink(path: string, source?: string | null) {
  const base = `hungry://${path.replace(/^\//, "")}`;
  return source ? `${base}?src=${source}` : base;
}
