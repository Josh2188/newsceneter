import type { Metadata } from "next";
import Link from "next/link";
import { ThemeHint } from "@/components/ThemeHint";
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
      <body className="relative">
        <div className="river-aurora" aria-hidden>
          <div className="river-waves" />
        </div>
        <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col px-4 pb-16 pt-5 sm:px-6">
          <header className="glass-header mb-5 rounded-2xl px-4 py-4 sm:px-5">
            <div className="flex items-baseline justify-between gap-3">
              <Link href="/" className="group">
                <h1 className="title-gradient font-mono text-2xl font-bold tracking-tight sm:text-3xl">
                  新河道
                </h1>
                <p className="mt-1 text-xs text-river-muted transition group-hover:text-river-accent/80">
                  NewsCeneter · 全部來源匯入同一條夜河
                </p>
              </Link>
              <ThemeHint />
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="mt-10 border-t border-river-border/60 pt-4 text-center text-[10px] text-river-muted/80">
            PTT / Threads / 新聞為真實來源 · FB／IG 已停用 · 請友善使用來源站
          </footer>
        </div>
      </body>
    </html>
  );
}
