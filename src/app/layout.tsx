import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ThemeHint } from "@/components/ThemeHint";
import "./globals.css";

export const metadata: Metadata = {
  title: "新河道 · NewsCeneter",
  description: "多來源合一的時間河道 — PTT、Threads、新聞",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#17171a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        <header className="app-header sticky top-0 z-30">
          <div className="mx-auto flex h-12 max-w-feed items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-[1.0625rem] font-semibold tracking-tight text-river-text">
                新河道
              </span>
              <span className="hidden text-[0.75rem] text-river-muted sm:inline">
                NewsCeneter
              </span>
            </Link>
            <ThemeHint />
          </div>
        </header>
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-feed flex-col px-4 pb-12 sm:px-6">
          <main className="flex-1 pt-4 sm:pt-6">{children}</main>
          <footer className="mt-12 border-t border-river-border pt-5 text-center text-[0.75rem] text-river-muted">
            PTT · Threads · 新聞 — 資料取自公開來源，請友善使用來源站
          </footer>
        </div>
      </body>
    </html>
  );
}
