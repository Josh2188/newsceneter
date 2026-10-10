import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="mb-2 text-lg font-semibold text-river-text">找不到內容</p>
      <p className="mb-6 text-sm text-river-muted">文章可能已刪除，或參數無效。</p>
      <Link href="/" className="text-sm text-river-accent hover:underline">
        ← 返回河道
      </Link>
    </div>
  );
}
