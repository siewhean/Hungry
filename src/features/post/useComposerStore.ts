import { create } from "zustand";

export type PublishingState =
  | "empty"
  | "uploading"
  | "processing"
  | "editing"
  | "draft"
  | "scheduled"
  | "posting"
  | "success"
  | "error"
  | "ai_processing";

export type ComposerTab = "post" | "review";
export type PublishMode = "both" | "post" | "review";

export interface MediaItem {
  id: string;
  uri: string;
  type: "image" | "video";
  width?: number;
  height?: number;
  filterId?: string;
  adjustments?: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
}

interface ComposerState {
  // Navigation
  activeTab: ComposerTab;
  setActiveTab: (tab: ComposerTab) => void;

  // Shared Data
  media: MediaItem[];
  collaborators: string[];
  taggedAccounts: string[];
  location: { id: string; name: string; address?: string } | null;
  foodTags: string[];
  tasteTags: string[];
  useSameCaption: boolean;
  showFoodContextOverlay: boolean;

  // Tab Specific Data
  reviewCaption: string;
  postCaption: string;
  rating: number;
  musicId: string | null;
  selectedTrackName: string | null;
  selectedTrackArtist: string | null;
  musicDuration: number; // in seconds
  musicStartMs: number;
  ctaButton: string | null;
  isSponsored: boolean;
  scheduledTime: Date | null;
  isBusinessMode: boolean;

  // UI State
  publishingState: PublishingState;
  publishingError: string | null;
  showPreview: boolean;
  previewPlatform: "hungry" | "instagram";
  editingMediaId: string | null;
  isAiProcessing: boolean;
  lastPublishRequest: {
    publishMode: PublishMode;
    routeDishId?: string;
    routeVenueId?: string;
  } | null;

  // Actions
  addMedia: (items: MediaItem[]) => void;
  removeMedia: (id: string) => void;
  updateMediaAdjustment: (id: string, adjustments: Partial<MediaItem["adjustments"]>) => void;
  setCaption: (text: string) => void;
  setUseSameCaption: (useSame: boolean) => void;
  setShowFoodContextOverlay: (show: boolean) => void;
  toggleTag: (tag: string, type: "food" | "taste") => void;
  setRating: (rating: number) => void;
  setMusic: (
    id: string | null,
    name?: string | null,
    artist?: string | null,
    duration?: number,
    startMs?: number,
  ) => void;
  setLocation: (loc: ComposerState["location"]) => void;
  setCollaborators: (users: string[]) => void;
  toggleCollaborator: (user: string) => void;
  setPublishingState: (state: PublishingState) => void;
  setShowPreview: (show: boolean) => void;
  setPreviewPlatform: (platform: "hungry" | "instagram") => void;
  setEditingMediaId: (id: string | null) => void;
  setPublishingError: (message: string | null) => void;
  setLastPublishRequest: (request: ComposerState["lastPublishRequest"]) => void;
  setScheduledTime: (date: Date | null) => void;
  setIsBusinessMode: (isBusiness: boolean) => void;
  setCTA: (cta: string | null) => void;
  setIsSponsored: (is: boolean) => void;

  // AI Actions
  generateCaptionIdeas: () => Promise<void>;
  suggestBestTime: () => Promise<void>;
  optimiseCaption: () => Promise<void>;

  reset: () => void;
}

export const useComposerStore = create<ComposerState>((set, get) => ({
  activeTab: "post",
  setActiveTab: (activeTab) => set({ activeTab }),

  media: [],
  collaborators: [],
  taggedAccounts: [],
  location: null,
  foodTags: [],
  tasteTags: [],
  useSameCaption: false,
  showFoodContextOverlay: true,

  reviewCaption: "",
  postCaption: "",
  rating: 0,
  musicId: null,
  selectedTrackName: null,
  selectedTrackArtist: null,
  musicDuration: 30,
  musicStartMs: 0,
  ctaButton: null,
  isSponsored: false,
  scheduledTime: null,
  isBusinessMode: false,

  publishingState: "empty",
  publishingError: null,
  showPreview: false,
  previewPlatform: "hungry",
  editingMediaId: null,
  isAiProcessing: false,
  lastPublishRequest: null,

  addMedia: (items) =>
    set((state) => ({ media: [...state.media, ...items], publishingState: "editing" })),
  removeMedia: (id) =>
    set((state) => ({
      media: state.media.filter((m) => m.id !== id),
      publishingState: state.media.length <= 1 ? "empty" : state.publishingState,
    })),
  updateMediaAdjustment: (id, adjustments) =>
    set((state) => ({
      media: state.media.map((m) =>
        m.id === id
          ? {
              ...m,
              adjustments: {
                ...(m.adjustments || { brightness: 1, contrast: 1, saturation: 1 }),
                ...adjustments,
              },
            }
          : m,
      ),
    })),
  setCaption: (text) =>
    set((state) => {
      if (state.useSameCaption) {
        return { postCaption: text, reviewCaption: text.slice(0, 500) };
      }
      return state.activeTab === "post"
        ? { postCaption: text }
        : { reviewCaption: text.slice(0, 500) };
    }),
  setUseSameCaption: (useSameCaption) =>
    set((state) => {
      if (!useSameCaption) return { useSameCaption };

      // Sync based on where we are
      const syncedCaption = state.activeTab === "post" ? state.reviewCaption : state.postCaption;

      return {
        useSameCaption,
        postCaption: syncedCaption,
        reviewCaption: syncedCaption.slice(0, 500),
      };
    }),
  setShowFoodContextOverlay: (showFoodContextOverlay) => set({ showFoodContextOverlay }),
  toggleTag: (tag, type) =>
    set((state) => {
      const field = type === "food" ? "foodTags" : "tasteTags";
      const list = state[field];
      return { [field]: list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag] };
    }),
  setRating: (rating) => set({ rating }),
  setMusic: (
    musicId,
    selectedTrackName = null,
    selectedTrackArtist = null,
    musicDuration = 30,
    musicStartMs = 0,
  ) => set({ musicId, selectedTrackName, selectedTrackArtist, musicDuration, musicStartMs }),
  setLocation: (location) => set({ location }),
  setCollaborators: (collaborators) => set({ collaborators }),
  toggleCollaborator: (user) =>
    set((state) => ({
      collaborators: state.collaborators.includes(user)
        ? state.collaborators.filter((u) => u !== user)
        : [...state.collaborators, user],
    })),
  setPublishingState: (publishingState) => set({ publishingState }),
  setShowPreview: (showPreview) => set({ showPreview }),
  setPreviewPlatform: (previewPlatform) => set({ previewPlatform }),
  setEditingMediaId: (editingMediaId) => set({ editingMediaId }),
  setPublishingError: (publishingError) => set({ publishingError }),
  setLastPublishRequest: (lastPublishRequest) => set({ lastPublishRequest }),
  setScheduledTime: (scheduledTime) => set({ scheduledTime }),
  setIsBusinessMode: (isBusinessMode) => set({ isBusinessMode }),
  setCTA: (ctaButton) => set({ ctaButton }),
  setIsSponsored: (isSponsored) => set({ isSponsored }),

  generateCaptionIdeas: async () => {
    set({ isAiProcessing: true, publishingState: "ai_processing" });
    // Mock API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const ideas = [
      "Still thinking about this meal... 🤤✨",
      "The kind of meal you dream about for weeks. #foodie #hungry",
      "Hidden gem found! You guys HAVE to try this. 📍🍴",
      "Good food = Good mood. Case in point: this dish. 📸🥘",
      "Proof that heaven is a place on earth, and it's served on this plate. 🌟",
    ];

    const randomCaption = ideas[Math.floor(Math.random() * ideas.length)];
    get().setCaption(randomCaption);

    set({ isAiProcessing: false, publishingState: "editing" });
  },

  suggestBestTime: async () => {
    set({ isAiProcessing: true, publishingState: "ai_processing" });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Suggest 2 hours from now
    const bestTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    set({ scheduledTime: bestTime });

    set({ isAiProcessing: false, publishingState: "editing" });
  },

  optimiseCaption: async () => {
    set({ isAiProcessing: true, publishingState: "ai_processing" });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const currentCaption = get().postCaption;
    const emojis = ["🔥", "✨", "🙌", "🍱", "🥢"];
    const hashtags = ["#HungryApp", "#SGFoodie", "#Gourmet"];

    const optimised = `${currentCaption} ${emojis.join("")}\n\n${hashtags.join(" ")}`;
    get().setCaption(optimised);

    set({ isAiProcessing: false, publishingState: "editing" });
  },

  reset: () =>
    set({
      media: [],
      collaborators: [],
      taggedAccounts: [],
      location: null,
      foodTags: [],
      tasteTags: [],
      useSameCaption: false,
      showFoodContextOverlay: true,
      reviewCaption: "",
      postCaption: "",
      rating: 0,
      musicId: null,
      selectedTrackName: null,
      selectedTrackArtist: null,
      ctaButton: null,
      isSponsored: false,
      scheduledTime: null,
      isBusinessMode: false,
      publishingState: "empty",
      showPreview: false,
      isAiProcessing: false,
      publishingError: null,
      lastPublishRequest: null,
    }),
}));
