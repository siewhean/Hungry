import type { Metadata } from "next";

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hungry.sg";

export const siteConfig = {
  name: "Hungry",
  url: rawSiteUrl.replace(/\/$/, ""),
  title: "Hungry - Singapore Food Discovery",
  description:
    "Hungry is a Singapore food discovery app for diners and food businesses — discover dishes faster and manage menus, photos, hours, and profiles with Merchant Mode.",
  locale: "en_SG",
  language: "en-SG",
  contactEmail: "hello@hungry.sg",
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
} as const;

export const publicRoutes = [
  {
    path: "/",
    title: "Hungry | Decide what to eat next in Singapore",
    description:
      "The food discovery app for Singapore. Find hawker food, cafes, restaurants, and home-based food businesses by dish, craving, and local context.",
    priority: 1,
    lastModified: "2026-05-24",
  },
  {
    path: "/for-foodies",
    title: "Hungry for Foodies | Singapore Food Discovery",
    description:
      "Join the Hungry waitlist for a Singapore food discovery app that helps foodies compare dishes, photos, menus, reviews, and opening status before the trip.",
    priority: 0.9,
    lastModified: "2026-05-24",
  },
  {
    path: "/for-merchants",
    title: "Hungry for Merchants | Merchant Mode for Singapore food businesses",
    description:
      "Join the Hungry merchant waitlist for Merchant Mode — manage menus, photos, opening hours, verification, customer replies, promotions, and performance.",
    priority: 0.9,
    lastModified: "2026-06-01",
  },
  {
    path: "/join-waitlist",
    title: "Hungry waitlist | Foodie early access and Merchant Mode updates",
    description:
      "Join the Hungry waitlist for foodie early access or Merchant Mode updates for Singapore food businesses.",
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
] as const;

export type PublicRoute = (typeof publicRoutes)[number];

export function absoluteUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export function createPageMetadata(route: PublicRoute): Metadata {
  return {
    title: {
      absolute: route.title,
    },
    description: route.description,
    alternates: {
      canonical: route.path,
    },
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      url: route.path,
      siteName: siteConfig.name,
      title: route.title,
      description: route.description,
      images: [
        {
          url: siteConfig.openGraphImage,
          alt: "Hungry Singapore food discovery app preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: route.title,
      description: route.description,
      images: [siteConfig.openGraphImage],
    },
  };
}

export function routeMetadata(path: PublicRoute["path"]) {
  const route = publicRoutes.find((item) => item.path === path);

  if (!route) {
    throw new Error(`Missing SEO route metadata for ${path}`);
  }

  return createPageMetadata(route);
}

export const hungryJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
      email: siteConfig.contactEmail,
      description: siteConfig.description,
      areaServed: {
        "@type": "Country",
        name: "Singapore",
      },
      knowsAbout: [
        "Singapore food discovery",
        "hawker stalls",
        "food courts",
        "restaurant discovery",
        "dish-first food search",
        "merchant menu visibility",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      name: siteConfig.name,
      url: siteConfig.url,
      inLanguage: siteConfig.language,
      description: siteConfig.description,
      publisher: {
        "@id": `${siteConfig.url}/#organization`,
      },
    },
    {
      "@type": "MobileApplication",
      "@id": `${siteConfig.url}/#mobile-application`,
      name: siteConfig.name,
      url: siteConfig.url,
      applicationCategory: "Food & Drink",
      operatingSystem: "iOS, Android",
      description:
        "A coming-soon Singapore food discovery app built around dishes, cravings, merchant profiles, menus, photos, reviews, and local food context.",
      publisher: {
        "@id": `${siteConfig.url}/#organization`,
      },
      areaServed: {
        "@type": "Country",
        name: "Singapore",
      },
    },
  ],
} as const;
