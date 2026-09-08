"use client";

export type FilterId =
  | "all"
  | "ptt"
  | "threads"
  | "news";

const CHIPS: { id: FilterId; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "ptt", label: "PTT" },
  { id: "threads", label: "Threads" },
  { id: "news", label: "新聞" },
];

export function FilterChips({
  value,
  onChange,
}: {
  value: FilterId;
  onChange: (v: FilterId) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
      {CHIPS.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "border-river-accent bg-river-accent/15 text-river-accent shadow-glow"
                : "border-river-border bg-river-panel/80 text-river-muted hover:border-river-muted hover:text-river-text"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
