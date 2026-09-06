# 新河道（NewsCeneter）

多來源社群／新聞瀏覽器：全部來源匯入同一條時間河道（依 createdAt 新到舊）。預設混合流；來源晶片為次要篩選。

## 快速開始

```bash
cd /workspace/newsceneter
npm install
npm run dev
```

開啟 http://127.0.0.1:3000

建置：npm run build
啟動：npm start

## 技術棧
- Next.js App Router + TypeScript + Tailwind CSS
- cheerio 解析 PTT HTML
- 繁體中文 UI

## 架構
- src/lib/sources/types.ts — 型別
- src/lib/sources/ptt.ts — 真實 PTT（含 over18 cookie）
- src/lib/sources/threads.ts — 真實公開頁爬取；facebook|instagram.ts — 已停用
- src/lib/sources/news.ts — 真實台灣 RSS（無 DEMO）
- src/lib/sources/index.ts — fetchRiver 合併
- src/app/api/river、api/post — API
- src/app/page.tsx、post/page.tsx — 頁面

## 如何新增來源
1. 擴充 SourceId
2. 新增 adapter 實作 Source
3. 在 index.ts 註冊
4. 更新 FilterChips 與 badge 色

## 來源狀態
| 來源 | 狀態 |
|------|------|
| PTT | 真實公開 HTML |
| Threads | 真實公開頁爬取（無需 token） |
| Facebook | 停用（不進河道） |
| Instagram | 停用（不進河道） |
| 新聞 | 真實台灣 RSS（無 DEMO 後備） |

## 注意
- 短快取約 45-60 秒，請友善使用來源站
- 河道絕不注入 stub；失敗回傳空陣列
- 不自動進行 git commit 或 push

## 篩選晶片
`全部` · `PTT` · `Threads` · `新聞`

## Threads
1. Googlebot/Chrome UA 抓取 https://www.threads.net/@{username}
2. 解析 HTML 內嵌 mediaData JSON（caption.text / code / like_count / taken_at）
3. permalink: https://www.threads.net/@user/post/{code}
4. 快取 ~60s；env THREADS_USERS 可覆寫預設 zuck,meta,threads

## 新聞 RSS
中央社政治/科技、自由時報、UDN、關鍵評論網（TheNewsLens）。全部失敗回傳 []，無 DEMO。

## 環境變數
見 .env.example（THREADS_USERS）。FB/IG 已停用無需 token。

## 煙霧測試
npm run smoke
