import { SOURCE_BADGE_CLASS, SOURCE_LABEL } from "@/lib/format";

export function SourceBadge({ source }: { source: string }) {
  const cls =
    SOURCE_BADGE_CLASS[source] ||
    "bg-white/10 text-river-muted border-white/10";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${cls}`}
    >
      {SOURCE_LABEL[source] || source}
    </span>
  );
}
