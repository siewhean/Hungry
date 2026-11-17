import { getDishAreaPage, getPlace } from "./content";

type PlaceRouteCandidate = {
  slug: string;
  type: string;
};

export function backedPlacePath(place: PlaceRouteCandidate) {
  const canonicalPlace = getPlace(place.slug);

  if (!canonicalPlace || canonicalPlace.type !== place.type) {
    return null;
  }

  return canonicalPlace.type === "hawker_centre"
    ? `/hawker-centres/${canonicalPlace.slug}`
    : `/malls/${canonicalPlace.slug}/food`;
}

export function backedDishAreaPath(areaSlug: string, dishSlug: string) {
  const page = getDishAreaPage(areaSlug, dishSlug);

  if (!page) {
    return null;
  }

  return `/singapore/${page.areaSlug}/${page.dishSlug}`;
}
