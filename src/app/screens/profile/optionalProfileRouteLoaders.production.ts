function unavailable(): never {
  throw new Error("[Hungry production configuration] Disabled profile route is unavailable");
}

export const loadChecklistsHomeScreen = unavailable;
export const loadChecklistDetailScreen = unavailable;
export const loadChecklistItemPickerScreen = unavailable;
export const loadPortfoliosHomeScreen = unavailable;
export const loadPortfolioDetailScreen = unavailable;
export const loadPortfolioCreateScreen = unavailable;
export const loadPortfolioEditScreen = unavailable;
export const loadPortfolioItemPickerScreen = unavailable;
export const loadPortfolioCollaboratorsScreen = unavailable;
export const loadPortfolioSearchScreen = unavailable;
export const loadSocialGridScreen = unavailable;
export const loadSocialPostDetailScreen = unavailable;
