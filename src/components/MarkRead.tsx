"use client";

import { useEffect } from "react";
import { markRead } from "@/lib/readIds";

/** Marks a feed item as read when the detail page mounts. */
export function MarkRead({ id }: { id: string }) {
  useEffect(() => {
    if (id) markRead(id);
  }, [id]);
  return null;
}
