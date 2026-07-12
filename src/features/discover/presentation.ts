import type { ImageSourcePropType } from "react-native";

type DiscoverCuisineSource = {
  cuisineTags?: readonly string[];
  foodTypeTag?: string;
  name?: string;
  venueName?: string;
};

type DiscoverPriceSource = {
  price: number;
  priceRange?: string;
};

type DiscoverAvailabilitySource = {
  isOpen: boolean;
  operatingHours?: string;
};

type DiscoverCategorySource = DiscoverCuisineSource & {
  dietaryFlags?: readonly string[];
  spicyLevel?: number;
  tasteTags?: readonly string[];
};

type DiscoverImageFrame = { imageUrl: string };

const LOCAL_CUISINE_ALIASES = new Set(["local", "local kopi", "singaporean"]);

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function displayCuisineLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  if (LOCAL_CUISINE_ALIASES.has(normalized)) return "Local";
  if (normalized.startsWith("japanese")) return "Japanese";
  return titleCase(value);
}

function inferCuisineTag(source: DiscoverCuisineSource) {
  const text = [source.foodTypeTag, source.name, source.venueName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/japanese|ramen|sushi|salmon don|teriyaki|monster curry/.test(text)) return "Japanese";
  if (/western|burger|pasta|pizza|tagliatelle|burrata/.test(text)) return "Western";
  if (/korean|bibimbap|kimchi/.test(text)) return "Korean";
  if (/thai|tom yum|pad thai/.test(text)) return "Thai";
  if (/indian|briyani|biryani|prata/.test(text)) return "Indian";
  if (/mala|sichuan|szechuan/.test(text)) return "Chinese";
  if (
    /chicken rice|laksa|satay|kaya|pandan|fish soup|ban mian|bak chor mee|char kway teow|nasi lemak/.test(
      text,
    )
  ) {
    return "Local";
  }
  return undefined;
}

export function getEffectiveCuisineTags(source: DiscoverCuisineSource, limit = 2) {
  const canonicalTags = (source.cuisineTags ?? []).map(displayCuisineLabel).filter(Boolean);
  const inferredTag = inferCuisineTag(source);
  const candidates: string[] = canonicalTags.length
    ? canonicalTags
    : inferredTag
      ? [inferredTag]
      : [];
  const displayOrder = new Map([
    ["Local", 0],
    ["Japanese", 1],
    ["Western", 2],
  ]);
  return Array.from(new Set(candidates))
    .map((tag, index) => ({ index, tag }))
    .sort(
      (left, right) =>
        (displayOrder.get(left.tag) ?? 10) - (displayOrder.get(right.tag) ?? 10) ||
        left.index - right.index,
    )
    .slice(0, limit)
    .map(({ tag }) => tag) as string[];
}

export function formatDiscoverDistance(distanceMeters?: number) {
  if (!Number.isFinite(distanceMeters) || !distanceMeters || distanceMeters <= 0) return undefined;
  if (distanceMeters < 1_000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1_000).toFixed(1)} km`;
}

export function formatDiscoverPrice(source: DiscoverPriceSource) {
  const priceRange = source.priceRange?.trim();
  if (priceRange && !/^S\$?0(?:\.0+)?$/i.test(priceRange)) return priceRange;
  if (!Number.isFinite(source.price) || source.price <= 0) return "Price unavailable";
  return `S$${source.price.toFixed(2)}`;
}

export function getDiscoverAvailabilityLabel(source: DiscoverAvailabilitySource) {
  if (!source.operatingHours?.trim()) return "Hours unavailable";
  return source.isOpen ? "Open" : "Closed";
}

export function matchesDiscoverCategory(source: DiscoverCategorySource, category: string) {
  const normalizedCategory = category.trim().toLowerCase();
  if (!normalizedCategory || normalizedCategory === "all") return true;
  if (normalizedCategory === "halal") return source.dietaryFlags?.includes("halal") ?? false;
  if (normalizedCategory === "spicy") {
    return (
      (source.spicyLevel ?? 0) >= 6 ||
      (source.tasteTags ?? []).some((tag) => tag.toLowerCase() === "spicy")
    );
  }

  const cuisineTags = getEffectiveCuisineTags(source).map((tag) => tag.toLowerCase());
  if (["local", "japanese", "western"].includes(normalizedCategory)) {
    return cuisineTags.includes(normalizedCategory);
  }

  const foodText = [source.foodTypeTag, source.name].filter(Boolean).join(" ").toLowerCase();
  if (normalizedCategory === "noodles") {
    return /noodle|mee|ramen|laksa|pasta|ban mian/.test(foodText);
  }
  if (normalizedCategory === "rice") {
    return /rice|nasi|don|briyani|biryani/.test(foodText);
  }
  if (normalizedCategory === "dessert") {
    return /dessert|cake|kueh|ice cream|pudding/.test(foodText);
  }
  return false;
}

export function getUsableDiscoverImageFrames<T extends DiscoverImageFrame>(
  frames: readonly T[],
  isUsableImageUrl: (imageUrl: string) => boolean,
) {
  const seenUrls = new Set<string>();
  return frames.filter((frame) => {
    if (!isUsableImageUrl(frame.imageUrl) || seenUrls.has(frame.imageUrl)) return false;
    seenUrls.add(frame.imageUrl);
    return true;
  });
}

export type DishFallbackImageKey =
  | "bak-chor-mee"
  | "bibimbap"
  | "burger"
  | "char-kway-teow"
  | "chicken-rice"
  | "fish-soup"
  | "generic"
  | "japanese-curry"
  | "kaya-toast"
  | "korean-stew"
  | "laksa"
  | "mala"
  | "nasi-briyani"
  | "nasi-lemak"
  | "pandan-cake"
  | "pasta"
  | "pizza"
  | "ramen"
  | "roti-prata"
  | "satay";

export function getDishFallbackImageKey(source: DiscoverCuisineSource): DishFallbackImageKey {
  const text = [source.foodTypeTag, source.name, source.venueName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/laksa/.test(text)) return "laksa";
  if (/chicken rice/.test(text)) return "chicken-rice";
  if (/char kway teow/.test(text)) return "char-kway-teow";
  if (/bak chor mee|ban mian/.test(text)) return "bak-chor-mee";
  if (/fish soup/.test(text)) return "fish-soup";
  if (/kaya toast/.test(text)) return "kaya-toast";
  if (/pandan|cake/.test(text)) return "pandan-cake";
  if (/satay/.test(text)) return "satay";
  if (/nasi lemak/.test(text)) return "nasi-lemak";
  if (/briyani|biryani/.test(text)) return "nasi-briyani";
  if (/prata/.test(text)) return "roti-prata";
  if (/mala/.test(text)) return "mala";
  if (/bibimbap/.test(text)) return "bibimbap";
  if (/korean/.test(text)) return "korean-stew";
  if (/japanese curry|monster curry/.test(text)) return "japanese-curry";
  if (/ramen|salmon don|sushi|japanese/.test(text)) return "ramen";
  if (/burger/.test(text)) return "burger";
  if (/pizza|burrata/.test(text)) return "pizza";
  if (/pasta|tagliatelle/.test(text)) return "pasta";
  return "generic";
}

export function getDishFallbackImageSource(source: DiscoverCuisineSource): ImageSourcePropType {
  switch (getDishFallbackImageKey(source)) {
    case "bak-chor-mee":
      return require("../../assets/discover/bak-chor-mee-topdown.png");
    case "bibimbap":
      return require("../../assets/onboarding/food/bibimbap.png");
    case "burger":
      return require("../../assets/onboarding/food/burger.png");
    case "char-kway-teow":
      return require("../../assets/discover/char-kway-teow-topdown.png");
    case "chicken-rice":
      return require("../../assets/discover/chicken-rice-topdown.png");
    case "fish-soup":
      return require("../../assets/onboarding/food/fish-soup.png");
    case "japanese-curry":
      return require("../../assets/onboarding/food/japanese-curry.png");
    case "kaya-toast":
      return require("../../assets/onboarding/food/kaya-toast.png");
    case "korean-stew":
      return require("../../assets/onboarding/food/korean-stew.png");
    case "laksa":
      return require("../../assets/discover/laksa-topdown.png");
    case "mala":
      return require("../../assets/onboarding/food/mala-xiang-guo.png");
    case "nasi-briyani":
      return require("../../assets/onboarding/food/nasi-briyani.png");
    case "nasi-lemak":
      return require("../../assets/onboarding/food/nasi-lemak.png");
    case "pandan-cake":
      return require("../../assets/onboarding/food/pandan-cake.png");
    case "pasta":
      return require("../../assets/onboarding/food/pasta.png");
    case "pizza":
      return require("../../assets/onboarding/food/pizza.png");
    case "ramen":
      return require("../../assets/onboarding/food/ramen.png");
    case "roti-prata":
      return require("../../assets/onboarding/food/roti-prata.png");
    case "satay":
      return require("../../assets/onboarding/food/satay.png");
    default:
      return require("../../assets/discover/dishes-card-wide.png");
  }
}
