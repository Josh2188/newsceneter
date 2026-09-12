import { RiverFeed } from "@/components/RiverFeed";

export default function HomePage() {
  return (
    <div>
      <p className="mb-5 text-sm leading-relaxed text-river-muted">
        預設為
        <strong className="font-medium text-river-text">隨機混流</strong>
        ——每次整理都從 PTT／新聞／Threads 重新抽樣混排，看板與帳號僅作次要篩選。置頂熱訊跑馬燈、精選焦點、夜間漂流——摸一下河道溫度，或隨緣一潛。
      </p>
      <RiverFeed />
    </div>
  );
}
