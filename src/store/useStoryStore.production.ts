import { create } from "zustand";

import type { Story, StoryContent } from "@/types/domain";

interface ProductionStoryState {
  stories: Story[];
  seenStoryIds: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  loadStories: () => Promise<void>;
  likeStory: (_storyId: string) => Promise<void>;
  saveStory: (_storyId: string) => Promise<void>;
  shareStory: (_storyId: string) => Promise<void>;
  addStory: (_content: StoryContent) => Promise<void>;
  markSeenForDisplayName: (_displayName: string) => void;
}

const unavailable = async () => {
  throw new Error("Stories are unavailable in this production release");
};

export const useStoryStore = create<ProductionStoryState>()(() => ({
  stories: [],
  seenStoryIds: {},
  isLoading: false,
  error: null,
  loadStories: async () => undefined,
  likeStory: unavailable,
  saveStory: unavailable,
  shareStory: unavailable,
  addStory: unavailable,
  markSeenForDisplayName: () => undefined,
}));
