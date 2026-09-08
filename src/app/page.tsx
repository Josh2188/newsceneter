import { RiverFeed } from "@/components/RiverFeed";

export default function HomePage() {
  return (
    <div>
      <p className="mb-5 text-sm leading-relaxed text-river-muted">
        預設為
        <strong className="font-medium text-river-text">混合時間流</strong>
        ，看板／來源僅作次要篩選。置頂熱訊跑馬燈、精選焦點、夜間漂流——摸一下河道溫度，或隨緣一潛。
      </p>
      <RiverFeed />
    </div>
  );
}
