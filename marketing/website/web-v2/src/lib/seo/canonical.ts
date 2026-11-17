export function normalizePath(path: string) {
  if (path === "/") return "/";

  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

export function canonicalUrl(siteUrl: string, path: string) {
  return `${siteUrl.replace(/\/$/, "")}${normalizePath(path)}`;
}
