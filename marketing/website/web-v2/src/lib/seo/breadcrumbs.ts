import type { BreadcrumbItem } from "./schema";

export function breadcrumb(label: string, path: string): BreadcrumbItem {
  return { label, path };
}

export function singaporeBreadcrumbs(label?: string, path?: string): BreadcrumbItem[] {
  const items = [breadcrumb("Home", "/"), breadcrumb("Singapore Food", "/singapore")];

  if (label && path) {
    items.push(breadcrumb(label, path));
  }

  return items;
}
