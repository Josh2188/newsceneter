import { RiverFeed } from "@/components/RiverFeed";

export default function HomePage() {
  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-river-muted">
        預設為<strong className="font-medium text-river-text">混合時間流</strong>
        ，看板／來源僅作次要篩選。點卡片查看全文。摸一下河道溫度、抓同題合流，或隨緣一潛——看你今天想漂多遠。
      </p>
      <RiverFeed />
    </div>
  );
}
