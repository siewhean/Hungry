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
  stall: { id: string; name: string; unitNumber: string; floor: string } | null;
};

export type SharedStall = {
  id: string;
  name: string;
  unitNumber: string;
  floor: string;
  operatingHours: string;
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
};

async function fetchRows<T>(table: string, params: Record<string, string>): Promise<T[]> {
  if (!isSupabasePublicConfigured()) return [];
  try {
    const { data } = await supabaseFetchCritical<T[]>(`rest/v1/${table}`, { params });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function toVenue(row: VenueRow) {
  return {
    id: row.id,
    name: row.name,
    unitNumber: row.unit_number ?? "",
    floor: row.floor ?? "",
    operatingHours: row.operating_hours ?? "",
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
    select: "id,name,unit_number,floor,operating_hours",
    limit: "1",
  });

  return {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    price: Number(dish.price) || 0,
    imageUrl: dish.media_approved_for_display ? dish.image_url : null,
    updatedAt: dish.updated_at ?? null,
    stall: venue ? toVenue(venue) : null,
  };
}

export async function getSharedStall(id: string): Promise<SharedStall | null> {
  if (!SAFE_ID_PATTERN.test(id)) return null;
  const [venue] = await fetchRows<VenueRow>("venues", {
    id: `eq.${id}`,
    select: "id,name,unit_number,floor,operating_hours",
    limit: "1",
  });
  if (!venue) return null;

  const dishes = await fetchRows<DishRow>("dishes", {
    venue_id: `eq.${id}`,
    select: "id,name,price",
    order: "review_count.desc",
    limit: "8",
  });

  return {
    ...toVenue(venue),
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
      })),
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

export function appDeepLink(path: string) {
  return `hungry://${path.replace(/^\//, "")}`;
}
