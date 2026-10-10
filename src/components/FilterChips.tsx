"use client";

export type FilterId =
  | "all"
  | "ptt"
  | "threads"
  | "news";

const TABS: { id: FilterId; label: string; dot?: string }[] = [
  { id: "all", label: "全部" },
  { id: "ptt", label: "PTT", dot: "bg-river-ptt" },
  { id: "threads", label: "Threads", dot: "bg-river-threads" },
  { id: "news", label: "新聞", dot: "bg-river-news" },
];

/** Underline tabs for source filter (kept name for compatibility). */
export function FilterChips({
  value,
  onChange,
}: {
  value: FilterId;
  onChange: (v: FilterId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="來源篩選"
      className="scrollbar-none -mb-px flex gap-5 overflow-x-auto"
    >
      {TABS.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 text-[0.875rem] font-medium transition-colors ${
              active
                ? "border-river-text text-river-text"
                : "border-transparent text-river-muted hover:text-river-text"
            }`}
          >
            {t.dot && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${t.dot} ${active ? "" : "opacity-70"}`}
                aria-hidden
              />
            )}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
