export type SourceId = "ptt" | "threads" | "news";

export interface Engagement {
  likes?: number;
  comments?: number;
  pushes?: number;
  boos?: number;
  arrows?: number;
}

export interface FeedItem {
  id: string;
  source: SourceId;
  title: string;
  author: string;
  channel: string;
  createdAt: string;
  preview: string;
  url: string;
  engagement?: Engagement;
  /** Extra route params for detail (e.g. PTT board + article id) */
  detailParams?: Record<string, string>;
  /** Article / post image URLs when known (optional; do not invent). */
  images?: string[];
}

export interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt?: string;
  type?: "push" | "boo" | "arrow" | "comment";
}

export interface Post extends FeedItem {
  body: string;
  comments?: Comment[];
  isStub?: boolean;
}

export type FeedFetchOpts = {
  /** Stabilize any remaining randomness for paginated river slices. */
  seed?: string | number;
};

export interface Source {
  id: SourceId;
  label: string;
  fetchFeed(limit?: number, opts?: FeedFetchOpts): Promise<FeedItem[]>;
  fetchPost?(params: Record<string, string>): Promise<Post | null>;
}
