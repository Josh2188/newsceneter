import type { FeedItem, Post, Source } from "./types";

/**
 * Instagram is disabled in the unified river for now.
 * Always returns [] — never injects stub/demo content.
 */
export const instagramSource: Source = {
  id: "instagram",
  label: "Instagram",
  async fetchFeed() {
    return [] as FeedItem[];
  },
  async fetchPost() {
    return null as Post | null;
  },
};
