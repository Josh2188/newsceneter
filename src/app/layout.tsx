import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "新河道 · NewsCeneter",
  description: "多來源合一的時間河道 — PTT、Threads、新聞",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-16 pt-6">
          <header className="mb-6 border-b border-river-border pb-4">
            <div className="flex items-baseline justify-between gap-3">
              <Link href="/" className="group">
                <h1 className="font-mono text-xl font-bold tracking-tight text-river-text group-hover:text-river-accent">
                  新河道
                </h1>
                <p className="mt-0.5 text-xs text-river-muted">
                  NewsCeneter · 全部來源匯入同一條河
                </p>
              </Link>
              <span className="hidden text-[10px] text-river-muted sm:inline">
                for Josh · TW
              </span>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="mt-10 border-t border-river-border pt-4 text-center text-[10px] text-river-muted/80">
            PTT / Threads / 新聞為真實來源 · FB／IG 已停用 · 請友善使用來源站
          </footer>
        </div>
      </body>
    </html>
  );
}
