export const loadChecklistsHomeScreen = () =>
  (
    require("@/app/screens/checklist/ChecklistsHomeScreen") as typeof import("@/app/screens/checklist/ChecklistsHomeScreen")
  ).ChecklistsHomeScreen;
export const loadChecklistDetailScreen = () =>
  (
    require("@/app/screens/checklist/ChecklistDetailScreen") as typeof import("@/app/screens/checklist/ChecklistDetailScreen")
  ).ChecklistDetailScreen;
export const loadChecklistItemPickerScreen = () =>
  (
    require("@/app/screens/checklist/ChecklistItemPickerScreen") as typeof import("@/app/screens/checklist/ChecklistItemPickerScreen")
  ).ChecklistItemPickerScreen;
export const loadPortfoliosHomeScreen = () =>
  (
    require("@/app/screens/portfolio/PortfoliosHomeScreen") as typeof import("@/app/screens/portfolio/PortfoliosHomeScreen")
  ).PortfoliosHomeScreen;
export const loadPortfolioDetailScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioDetailScreen") as typeof import("@/app/screens/portfolio/PortfolioDetailScreen")
  ).PortfolioDetailScreen;
export const loadPortfolioCreateScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioCreateScreen") as typeof import("@/app/screens/portfolio/PortfolioCreateScreen")
  ).PortfolioCreateScreen;
export const loadPortfolioEditScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioEditScreen") as typeof import("@/app/screens/portfolio/PortfolioEditScreen")
  ).PortfolioEditScreen;
export const loadPortfolioItemPickerScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioItemPickerScreen") as typeof import("@/app/screens/portfolio/PortfolioItemPickerScreen")
  ).PortfolioItemPickerScreen;
export const loadPortfolioCollaboratorsScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioCollaboratorsScreen") as typeof import("@/app/screens/portfolio/PortfolioCollaboratorsScreen")
  ).PortfolioCollaboratorsScreen;
export const loadPortfolioSearchScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioSearchScreen") as typeof import("@/app/screens/portfolio/PortfolioSearchScreen")
  ).PortfolioSearchScreen;
export const loadSocialGridScreen = () =>
  (
    require("@/app/screens/profile/SocialGridScreen") as typeof import("@/app/screens/profile/SocialGridScreen")
  ).SocialGridScreen;
export const loadSocialPostDetailScreen = () =>
  (
    require("@/app/screens/profile/SocialPostDetailScreen") as typeof import("@/app/screens/profile/SocialPostDetailScreen")
  ).SocialPostDetailScreen;
