import { SOURCE_DOT_CLASS, SOURCE_LABEL } from "@/lib/format";

/** Quiet source marker: a small colored dot + label. */
export function SourceBadge({
  source,
  tone = "default",
  showLabel = true,
}: {
  source: string;
  tone?: "default" | "onImage";
  showLabel?: boolean;
}) {
  const dot = SOURCE_DOT_CLASS[source] || "bg-river-muted";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 text-[0.75rem] font-medium ${
        tone === "onImage" ? "text-white/85" : "text-river-text/80"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {showLabel && (SOURCE_LABEL[source] || source)}
    </span>
  );
}
