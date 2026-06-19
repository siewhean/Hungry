import type { MetadataRoute } from "next";
import { absoluteUrl, publicRoutes } from "./seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes
    .filter((route) => !route.noindex)
    .map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: new Date(route.lastModified),
      changeFrequency: route.path === "/" || route.path === "/singapore" ? "weekly" : "monthly",
      priority: route.priority,
    }));
}
