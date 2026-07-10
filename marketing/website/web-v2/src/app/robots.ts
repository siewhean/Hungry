import type { MetadataRoute } from "next";
import { absoluteUrl } from "./seo";

const aiAndSearchCrawlers = [
  "Googlebot",
  "Google-Extended",
  "Bingbot",
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/console/", "/merchant/", "/_next/"],
      },
      ...aiAndSearchCrawlers.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/api/", "/console/", "/merchant/", "/_next/"],
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
