import type { Metadata } from "next";

export type SeoRouteMetadata = {
  description: string;
  lastModified: string;
  noindex?: boolean;
  path: string;
  priority: number;
  title: string;
};

export type PageMetadataConfig = {
  locale: string;
  name: string;
  openGraphImage: string;
};

export function createSeoMetadata(route: SeoRouteMetadata, config: PageMetadataConfig): Metadata {
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
      locale: config.locale,
      url: route.path,
      siteName: config.name,
      title: route.title,
      description: route.description,
      images: [
        {
          url: config.openGraphImage,
          alt: "Hungry Singapore food discovery app preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: route.title,
      description: route.description,
      images: [config.openGraphImage],
    },
    robots: route.noindex
      ? {
          index: false,
          follow: true,
        }
      : {
          index: true,
          follow: true,
        },
  };
}
