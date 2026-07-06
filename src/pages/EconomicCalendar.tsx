import { useMemo } from "react";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import { CalendarDays, ExternalLink } from "lucide-react";

export default function EconomicCalendar() {
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const calendarPrefs = useSettings((s) => s.calendarPrefs);

  // 根据用户偏好映射 TradingView 重要性筛选
  const importanceFilter = useMemo(() => {
    switch (calendarPrefs.importance) {
      case "high_only": return "1";
      case "medium_and_high": return "0,1";
      default: return "-1,0,1";
    }
  }, [calendarPrefs.importance]);

  // 直接构造 TradingView 经济日历 iframe URL
  const locale = language === "zh" ? "zh_CN" : "en";
  const iframeSrc = `https://s.tradingview.com/economic-calendar/?locale=${locale}&importanceFilter=${importanceFilter}`;

  return (
    <Layout title={t.title.calendar}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        {/* 标题栏 */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-4 py-3 shadow-sm">
          <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-semibold text-text">
              {language === "zh" ? "经济日历" : "Economic Calendar"}
            </h1>
            <p className="text-[11px] text-text-muted">
              {language === "zh"
                ? "实时经济事件数据,由 TradingView 提供"
                : "Real-time economic events, powered by TradingView"}
            </p>
          </div>
        </div>

        {/* TradingView 经济日历 iframe */}
        <div className="overflow-hidden rounded-lg border border-border bg-bg-surface shadow-sm" style={{ height: "calc(100vh - 180px)", minHeight: "500px" }}>
          <iframe
            src={iframeSrc}
            title="TradingView Economic Calendar"
            style={{ width: "100%", height: "100%", border: "none" }}
            allow="clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          />
        </div>

        {/* TradingView 版权归属 */}
        <div className="flex items-center justify-end gap-1 text-[10px] text-text-muted">
          <span>{language === "zh" ? "数据来源" : "Powered by"}</span>
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-text-secondary hover:text-text"
          >
            TradingView
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </Layout>
  );
}
