# 新河道（NewsCeneter）

多來源社群／新聞瀏覽器：全部來源匯入同一條時間河道。

目前來源：PTT、Threads、新聞（news）。

Threads 預設追蹤台灣繁中熱門／活躍帳號（可透過 `THREADS_USERS` 覆寫）。Vercel 等資料中心 IP 可能被 Meta 封鎖而改用內建快取；本機執行 `npx tsx scripts/refresh-threads-cache.ts` 可更新 `src/data/threads-cache.json`。
