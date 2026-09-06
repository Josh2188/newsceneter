import type { FeedItem, Post, Source } from "./types";

/**
 * Facebook is disabled in the unified river for now.
 * Always returns [] — never injects stub/demo content.
 */
export const facebookSource: Source = {
  id: "facebook",
  label: "Facebook",
  async fetchFeed() {
    return [] as FeedItem[];
  },
  async fetchPost() {
    return null as Post | null;
  },
};
