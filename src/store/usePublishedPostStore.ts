import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { StallPost } from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

interface PublishedPostState {
  posts: StallPost[];
  version: number;
  upsertPost: (post: StallPost) => void;
  clearPostsForTest: () => void;
}

function upsert(posts: StallPost[], post: StallPost) {
  const existing = posts.find((candidate) => candidate.id === post.id);
  if (existing && JSON.stringify(existing) === JSON.stringify(post)) {
    return posts;
  }
  return [post, ...posts.filter((candidate) => candidate.id !== post.id)];
}

export const usePublishedPostStore = create<PublishedPostState>()(
  persist(
    (set) => ({
      posts: [],
      version: 0,
      upsertPost: (post) =>
        set((state) => {
          const nextPosts = upsert(state.posts, post);
          if (nextPosts === state.posts) {
            return state;
          }
          return {
            posts: nextPosts,
            version: state.version + 1,
          };
        }),
      clearPostsForTest: () => set((state) => ({ posts: [], version: state.version + 1 })),
    }),
    {
      name: "hungry-published-posts-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({ posts: state.posts }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.version += 1;
        }
      },
    },
  ),
);
