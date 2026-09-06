/** Format time for Asia/Taipei display. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "剛剛";
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export const SOURCE_LABEL: Record<string, string> = {
  ptt: "PTT",
  threads: "Threads",
  facebook: "FB",
  instagram: "IG",
  news: "新聞",
};

export const SOURCE_BADGE_CLASS: Record<string, string> = {
  ptt: "bg-river-ptt/15 text-river-ptt border-river-ptt/30",
  threads: "bg-river-threads/15 text-river-threads border-river-threads/30",
  facebook: "bg-river-facebook/15 text-river-facebook border-river-facebook/30",
  instagram: "bg-river-instagram/15 text-river-instagram border-river-instagram/30",
  news: "bg-river-news/15 text-river-news border-river-news/30",
};
