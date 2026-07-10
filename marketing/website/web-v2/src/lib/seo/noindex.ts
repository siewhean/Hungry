import type {
  AreaSeoContent,
  DishAreaSeoContent,
  DishSeoContent,
  GuideSeoContent,
  PlaceSeoContent,
} from "./content";

export function hasIndexableAreaData(area: AreaSeoContent) {
  return area.venues.length >= 2 && area.dishSlugs.length >= 2 && area.faq.length >= 2;
}

export function hasIndexableDishData(dish: DishSeoContent) {
  return dish.areaSlugs.length >= 3 && dish.faq.length >= 2;
}

export function hasIndexableDishAreaData(page: DishAreaSeoContent) {
  return page.visibleVenues.length >= 1 && page.faq.length >= 2;
}

export function hasIndexablePlaceData(place: PlaceSeoContent) {
  return Boolean(place.address) && place.dishSlugs.length >= 2 && place.faq.length >= 2;
}

export function hasIndexableGuideData(guide: GuideSeoContent) {
  return guide.sections.length >= 3 && guide.faq.length >= 2;
}
