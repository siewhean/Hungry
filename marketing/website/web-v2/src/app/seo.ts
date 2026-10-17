import type { Metadata } from "next";
import {
  dishAreaPages,
  getArea,
  getDish,
  guidePath,
  seoAreas,
  seoDishes,
  seoGuides,
  seoPlaces,
  SEO_LAST_UPDATED,
} from "@/lib/seo/content";
import { createSeoMetadata, type SeoRouteMetadata } from "@/lib/seo/pageMetadata";
import {
  hasIndexableAreaData,
  hasIndexableDishAreaData,
  hasIndexableDishData,
  hasIndexableGuideData,
  hasIndexablePlaceData,
} from "@/lib/seo/noindex";
import { buildGlobalGraph } from "@/lib/seo/schema";

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hungry.sg";

export const siteConfig = {
  name: "Hungry",
  url: rawSiteUrl.replace(/\/$/, ""),
  title: "Hungry - Singapore Food Discovery",
  description:
    "Hungry helps Singapore diners find dishes faster and helps food businesses keep menus, photos, hours, and profiles up to date.",
  locale: "en_SG",
  language: "en-SG",
  contactEmail: "usehungrysingapore@gmail.com",
  openGraphImage: "/images/food/stalls-restaurants-wide.png",
  keywords: [
    "Hungry",
    "Singapore food discovery app",
    "food discovery Singapore",
    "hawker food Singapore",
    "dish-first food search",
    "restaurant discovery Singapore",
    "food business discovery Singapore",
  ],
};

const staticPublicRoutes = [
  {
    path: "/",
    title: "Hungry | Decide what to eat next in Singapore",
    description:
      "Find hawker food, cafes, restaurants, and home-based food businesses in Singapore by dish, craving, and area.",
    priority: 1,
    lastModified: "2026-05-24",
  },
  {
    path: "/for-foodies",
    title: "Hungry for Foodies | Singapore Food Discovery",
    description:
      "Join the Hungry waitlist to compare dishes, photos, menus, reviews, and opening status before making the trip.",
    priority: 0.9,
    lastModified: "2026-05-24",
  },
  {
    path: "/for-merchants",
    title: "Hungry for Merchants | Merchant Mode for Singapore food businesses",
    description:
      "Join the Hungry merchant waitlist to manage menus, photos, opening hours, verification, customer replies, promotions, and performance.",
    priority: 0.9,
    lastModified: "2026-06-01",
  },
  {
    path: "/about",
    title: "About Hungry | Singapore Food Discovery",
    description:
      "Learn how Hungry helps Singapore diners choose what to eat and helps food businesses keep dish information discoverable.",
    priority: 0.6,
    lastModified: "2026-06-18",
  },
  {
    path: "/join-waitlist",
    title: "Hungry waitlist | Foodie early access and Merchant Mode updates",
    description:
      "Join the Hungry waitlist for foodie early access or merchant onboarding updates.",
    priority: 0.9,
    lastModified: "2026-06-01",
  },
  {
    path: "/privacy",
    title: "Privacy Policy | Hungry",
    description: "Privacy Policy for the Hungry mobile app, merchant tools, and website.",
    priority: 0.4,
    lastModified: "2026-05-18",
  },
  {
    path: "/terms",
    title: "Terms of Service | Hungry",
    description: "Terms of Service for the Hungry app, merchant tools, and website.",
    priority: 0.4,
    lastModified: "2026-05-18",
  },
  {
    path: "/account/delete",
    title: "Delete Your Hungry Account | Hungry",
    description: "How to request deletion of your Hungry account and associated data.",
    priority: 0.5,
    lastModified: "2026-05-18",
  },
  {
    path: "/contact",
    title: "Contact Hungry | Support, Privacy and Merchant Help",
    description:
      "Contact Hungry for support, privacy, account deletion, waitlist, and merchant questions.",
    priority: 0.4,
    lastModified: "2026-06-18",
  },
] satisfies SeoRouteMetadata[];

const seoContentRoutes = [
  {
    path: "/singapore",
    title: "Singapore Food Discovery by Dish, Area and MRT | Hungry",
    description:
      "Browse Hungry pages for Singapore areas, MRT food searches, hawker centres, dishes, dietary needs, budget meals, and late-night supper.",
    priority: 0.95,
    lastModified: SEO_LAST_UPDATED,
  },
  ...seoAreas.map((area) => ({
    path: `/singapore/${area.slug}/food`,
    title: `${area.name} Food Guide: Dishes, Places and MRT Context | Hungry`,
    description: area.summary,
    priority: 0.82,
    lastModified: SEO_LAST_UPDATED,
    noindex: !hasIndexableAreaData(area),
  })),
  ...seoAreas.map((area) => ({
    path: `/singapore/mrt/${area.slug}/food`,
    title: `Food Near ${area.mrtStation} MRT: Dish-First Singapore Guide | Hungry`,
    description: `Find dishes, nearby places, and related Singapore area links around ${area.mrtStation} MRT.`,
    priority: 0.74,
    lastModified: SEO_LAST_UPDATED,
    noindex: !hasIndexableAreaData(area),
  })),
  ...seoDishes.map((dish) => ({
    path: `/dishes/${dish.slug}`,
    title: `${dish.name} in Singapore: Dish-First Food Discovery | Hungry`,
    description: dish.summary,
    priority: 0.78,
    lastModified: SEO_LAST_UPDATED,
    noindex: !hasIndexableDishData(dish),
  })),
  ...dishAreaPages.map((page) => {
    const area = getArea(page.areaSlug);
    const dish = getDish(page.dishSlug);

    if (!area || !dish) {
      throw new Error(`Invalid SEO dish-area route ${page.areaSlug}/${page.dishSlug}`);
    }

    return {
      path: `/singapore/${area.slug}/${dish.slug}`,
      title: `${dish.name} Near ${area.name}: Singapore Dish Discovery | Hungry`,
      description: page.summary,
      priority: 0.68,
      lastModified: SEO_LAST_UPDATED,
      noindex: !hasIndexableDishAreaData(page),
    };
  }),
  ...seoPlaces.map((place) => ({
    path:
      place.type === "hawker_centre"
        ? `/hawker-centres/${place.slug}`
        : `/malls/${place.slug}/food`,
    title: `${place.name}: Food Discovery Context | Hungry`,
    description: place.description,
    priority: place.type === "hawker_centre" ? 0.72 : 0.66,
    lastModified: SEO_LAST_UPDATED,
    noindex: !hasIndexablePlaceData(place),
  })),
  ...seoGuides.map((guide) => ({
    path: guidePath(guide),
    title: `${guide.title} | Hungry`,
    description: guide.description,
    priority: guide.guideType === "tourist" ? 0.8 : 0.7,
    lastModified: SEO_LAST_UPDATED,
    noindex: !hasIndexableGuideData(guide),
  })),
] satisfies SeoRouteMetadata[];

export const publicRoutes: SeoRouteMetadata[] = [...staticPublicRoutes, ...seoContentRoutes];

export type PublicRoute = (typeof publicRoutes)[number];

export function absoluteUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export function createPageMetadata(route: PublicRoute): Metadata {
  return createSeoMetadata(route, siteConfig);
}

export function routeMetadata(path: PublicRoute["path"]) {
  const route = publicRoutes.find((item) => item.path === path);

  if (!route) {
    throw new Error(`Missing SEO route metadata for ${path}`);
  }

  return createPageMetadata(route);
}

export const hungryJsonLd = buildGlobalGraph(siteConfig);
