import { canonicalUrl } from "./canonical";
import type { FaqItem, PlaceSeoContent } from "./content";

type JsonLdObject = Record<string, unknown>;

export type BreadcrumbItem = {
  label: string;
  path: string;
};

export type SchemaSiteConfig = {
  contactEmail: string;
  description: string;
  language: string;
  name: string;
  url: string;
};

export function buildOrganizationSchema(config: SchemaSiteConfig): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${config.url}/#organization`,
    name: config.name,
    url: config.url,
    email: config.contactEmail,
    description: config.description,
    areaServed: {
      "@type": "Country",
      name: "Singapore",
    },
    knowsAbout: [
      "Singapore food discovery",
      "hawker stalls",
      "food courts",
      "dish-first food search",
      "merchant menu visibility",
    ],
  };
}

export function buildWebsiteSchema(config: SchemaSiteConfig): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${config.url}/#website`,
    name: config.name,
    url: config.url,
    inLanguage: config.language,
    description: config.description,
    publisher: {
      "@id": `${config.url}/#organization`,
    },
  };
}

export function buildSoftwareApplicationSchema(config: SchemaSiteConfig): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    "@id": `${config.url}/#mobile-application`,
    name: config.name,
    url: config.url,
    applicationCategory: "Food & Drink",
    operatingSystem: "iOS, Android",
    description:
      "A coming-soon Singapore food app for dish search, merchant profiles, menus, photos, and reviews.",
    publisher: {
      "@id": `${config.url}/#organization`,
    },
    areaServed: {
      "@type": "Country",
      name: "Singapore",
    },
  };
}

export function buildGlobalGraph(config: SchemaSiteConfig): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@graph": [
      stripContext(buildOrganizationSchema(config)),
      stripContext(buildWebsiteSchema(config)),
      stripContext(buildSoftwareApplicationSchema(config)),
    ],
  };
}

export function buildBreadcrumbSchema(siteUrl: string, items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: canonicalUrl(siteUrl, item.path),
    })),
  };
}

export function buildItemListSchema(
  siteUrl: string,
  name: string,
  items: { name: string; path: string }[],
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: canonicalUrl(siteUrl, item.path),
    })),
  };
}

export function buildArticleSchema(input: {
  dateModified: string;
  description: string;
  path: string;
  siteName: string;
  siteUrl: string;
  title: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    dateModified: input.dateModified,
    inLanguage: "en-SG",
    mainEntityOfPage: canonicalUrl(input.siteUrl, input.path),
    publisher: {
      "@type": "Organization",
      name: input.siteName,
      url: input.siteUrl,
    },
  };
}

export function buildFAQSchema(faq: FaqItem[]): JsonLdObject | undefined {
  if (faq.length === 0) return undefined;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildLocalBusinessSchema(input: {
  path: string;
  place: PlaceSeoContent;
  siteUrl: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: input.place.name,
    url: canonicalUrl(input.siteUrl, input.path),
    address: input.place.address,
    areaServed: {
      "@type": "Country",
      name: "Singapore",
    },
    description: input.place.description,
  };
}

export function buildFoodEstablishmentSchema(input: {
  path: string;
  place: PlaceSeoContent;
  siteUrl: string;
}): JsonLdObject {
  return {
    ...buildLocalBusinessSchema(input),
    "@type": "FoodEstablishment",
    servesCuisine: "Singapore food",
  };
}

export function buildRestaurantSchema(input: {
  path: string;
  place: PlaceSeoContent;
  siteUrl: string;
}): JsonLdObject {
  return {
    ...buildFoodEstablishmentSchema(input),
    "@type": "Restaurant",
  };
}

export function buildProfilePageSchema(input: {
  description: string;
  name: string;
  path: string;
  siteUrl: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: input.name,
    description: input.description,
    url: canonicalUrl(input.siteUrl, input.path),
  };
}

function stripContext(schema: JsonLdObject): JsonLdObject {
  const result = { ...schema };
  delete result["@context"];
  return result;
}
