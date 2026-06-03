import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hungryPersistStorage } from "./persistStorage";
import { useActivityStore } from "@/store/useActivityStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import type { Story, StoryContent } from "@/types/domain";

interface StoryState {
  stories: Story[];
  seenStoryIds: Record<string, string>;
  isLoading: boolean;
  error: string | null;

  loadStories: () => Promise<void>;
  likeStory: (storyId: string) => Promise<void>;
  saveStory: (storyId: string) => Promise<void>;
  shareStory: (storyId: string) => Promise<void>;
  addStory: (content: StoryContent) => Promise<void>;
  markSeenForDisplayName: (displayName: string) => void;
}

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

function isFreshStory(story: Story): boolean {
  const createdAt = new Date(story.createdAt).getTime();
  if (!Number.isFinite(createdAt)) return true;
  return Date.now() - createdAt < STORY_TTL_MS;
}

function pruneExpiredStories(stories: Story[]): Story[] {
  return stories.filter(isFreshStory);
}

function isFreshSeenRecord(seenAt: string): boolean {
  const seenTime = new Date(seenAt).getTime();
  if (!Number.isFinite(seenTime)) return false;
  return Date.now() - seenTime < STORY_TTL_MS;
}

function pruneExpiredSeenStoryIds(seenStoryIds: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(seenStoryIds).filter(([, seenAt]) => isFreshSeenRecord(seenAt)),
  );
}

function orderStories(stories: Story[]): Story[] {
  const own: Story[] = [];
  const unseen: Story[] = [];
  const seen: Story[] = [];
  stories.forEach((story) => {
    if (story.isOwn) {
      own.push(story);
      return;
    }
    if (story.hasUnseen) {
      unseen.push(story);
    } else {
      seen.push(story);
    }
  });
  return [...own, ...unseen, ...seen];
}

export const useStoryStore = create<StoryState>()(
  persist(
    (set, get) => ({
      stories: [],
      seenStoryIds: {},
      isLoading: false,
      error: null,

      loadStories: async () => {
        set({ isLoading: true, error: null });
        try {
          const stories = await getHungryService().social.getStories();
          const { seenStoryIds } = get();
          const freshSeenStoryIds = pruneExpiredSeenStoryIds(seenStoryIds);
          const freshStories = pruneExpiredStories(stories).map((story) =>
            freshSeenStoryIds[story.id] ? { ...story, hasUnseen: false } : story,
          );
          set({
            stories: orderStories(freshStories),
            seenStoryIds: freshSeenStoryIds,
            isLoading: false,
          });
        } catch {
          set({ error: "Failed to load stories", isLoading: false });
        }
      },

      likeStory: async (storyId: string) => {
        const { stories } = get();
        const { profile } = useProfileStore.getState();
        const { addActivityUpdate } = useActivityStore.getState();
        const targetStory = stories.find((story) => story.id === storyId);
        const shouldNotifyLike =
          targetStory && !targetStory.interaction.liked && !targetStory.isOwn;
        const isOwnStory =
          targetStory?.isOwn || (!!targetStory?.authorId && targetStory.authorId === profile.id);
        const isPrivateStory = targetStory?.authorProfileVisibility === "private";

        // Optimistic update
        const previousStories = [...stories];
        const newStories = stories.map((s) => {
          if (s.id === storyId) {
            return {
              ...s,
              interaction: {
                ...s.interaction,
                liked: !s.interaction.liked,
                likeCount: s.interaction.liked
                  ? s.interaction.likeCount - 1
                  : s.interaction.likeCount + 1,
              },
            };
          }
          return s;
        });
        set({ stories: newStories });

        try {
          await getHungryService().social.likeStory(storyId);
          if (shouldNotifyLike && !isOwnStory && !isPrivateStory && targetStory?.authorId) {
            addActivityUpdate({
              kind: "like",
              postId: storyId,
              actorId: profile.id,
              recipientUserId: targetStory.authorId,
              actorName: profile.displayName || "You",
              text: "liked your story",
              target: targetStory?.displayName ?? "story",
              time: "now",
            });
          }
        } catch (e) {
          // Revert
          set({ stories: previousStories });
          throw e;
        }
      },

      saveStory: async (storyId: string) => {
        const { stories } = get();
        const now = new Date().toISOString();

        // Optimistic update
        const previousStories = [...stories];
        const newStories = stories.map((s) => {
          if (s.id === storyId) {
            const nextSaved = !s.interaction.saved;
            return {
              ...s,
              interaction: {
                ...s.interaction,
                saved: nextSaved,
                savedAt: nextSaved ? now : undefined,
              },
            };
          }
          return s;
        });
        set({ stories: newStories });

        try {
          await getHungryService().social.saveStory(storyId);
        } catch (e) {
          // Revert
          set({ stories: previousStories });
          throw e;
        }
      },

      shareStory: async (storyId: string) => {
        const { stories } = get();
        const { profile } = useProfileStore.getState();
        const { addActivityUpdate } = useActivityStore.getState();
        const targetStory = stories.find((story) => story.id === storyId);
        const isOwnStory =
          targetStory?.isOwn || (!!targetStory?.authorId && targetStory.authorId === profile.id);
        const isPrivateStory = targetStory?.authorProfileVisibility === "private";
        if (!targetStory) {
          throw new Error("Story not found");
        }

        const previousStories = [...stories];
        const newStories = stories.map((s) => {
          if (s.id === storyId) {
            return {
              ...s,
              interaction: {
                ...s.interaction,
                shareCount: s.interaction.shareCount + 1,
              },
            };
          }
          return s;
        });
        set({ stories: newStories });
        const shouldNotifyShare = !isOwnStory && !isPrivateStory && targetStory.authorId;

        try {
          await getHungryService().social.shareStory(storyId);
          if (shouldNotifyShare) {
            addActivityUpdate({
              kind: "share",
              postId: storyId,
              actorId: profile.id,
              recipientUserId: targetStory.authorId,
              actorName: profile.displayName || "You",
              text: "shared your story",
              target: targetStory.displayName ?? "story",
              time: "now",
            });
          }
        } catch (e) {
          set({ stories: previousStories });
          throw e;
        }
      },

      addStory: async (content: StoryContent) => {
        try {
          const newStory = await getHungryService().social.addStory(content);
          const { stories } = get();
          const freshStories = pruneExpiredStories(stories);
          const yourStoryIndex = freshStories.findIndex((s) => s.isOwn);

          const newStories = [...freshStories];
          if (yourStoryIndex >= 0) {
            newStories[yourStoryIndex] = newStory;
          } else {
            newStories.unshift(newStory);
          }

          set({ stories: orderStories(newStories) });
        } catch (e) {
          throw e;
        }
      },
      markSeenForDisplayName: (displayName: string) => {
        const { stories, seenStoryIds } = get();
        const freshStories = pruneExpiredStories(stories);
        const freshSeenStoryIds = pruneExpiredSeenStoryIds(seenStoryIds);
        const didPruneSeenStoryIds =
          Object.keys(freshSeenStoryIds).length !== Object.keys(seenStoryIds).length;
        const matchingStories = freshStories.filter((s) => s.displayName === displayName);
        const hasUnseen = matchingStories.some((s) => s.displayName === displayName && s.hasUnseen);
        if (!hasUnseen && matchingStories.every((story) => freshSeenStoryIds[story.id])) {
          if (didPruneSeenStoryIds) {
            set({ seenStoryIds: freshSeenStoryIds });
          }
          return;
        }

        const seenAt = new Date().toISOString();
        const nextSeenStoryIds = { ...freshSeenStoryIds };
        matchingStories.forEach((story) => {
          nextSeenStoryIds[story.id] = seenAt;
        });

        const newStories = freshStories.map((s) => {
          if (s.displayName !== displayName || !s.hasUnseen) return s;
          return { ...s, hasUnseen: false };
        });
        set({ stories: orderStories(newStories), seenStoryIds: nextSeenStoryIds });
      },
    }),
    {
      name: "hungry-stories-v1",
      storage: hungryPersistStorage,
    },
  ),
);
