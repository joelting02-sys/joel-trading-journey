import { useEffect, useRef, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import { CalendarDays, ExternalLink, Loader2 } from "lucide-react";

export default function EconomicCalendar() {
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const calendarPrefs = useSettings((s) => s.calendarPrefs);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  // 根据用户偏好映射 TradingView 重要性筛选
  const importanceFilter = useMemo(() => {
    switch (calendarPrefs.importance) {
      case "high_only": return "1";
      case "medium_and_high": return "0,1";
      default: return "-1,0,1";
    }
  }, [calendarPrefs.importance]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    setLoading(true);

    // TradingView 经济日历需要这个内部 widget div
    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    // 创建配置 script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embeddable-events.js";
    script.type = "text/javascript";
    script.async = true;
    // TradingView 读取 script 标签内的 JSON 文本作为配置
    script.textContent = JSON.stringify({
      colorTheme: "light",
      isTransparent: false,
      width: "100%",
      height: "100%",
      locale: language === "zh" ? "zh_CN" : "en",
      importanceFilter,
    });
    script.onload = () => setLoading(false);
    container.appendChild(script);

    // 超时兜底:5 秒后隐藏 loading
    const timer = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(timer);
  }, [language, importanceFilter]);

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

        {/* TradingView 经济日历 Widget */}
        <div className="relative rounded-lg border border-border bg-bg-surface shadow-sm" style={{ height: "calc(100vh - 180px)", minHeight: "500px" }}>
          <div
            className="tradingview-widget-container h-full w-full"
            ref={containerRef}
          />
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-surface">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-xs text-text-muted">
                {language === "zh" ? "正在加载经济日历..." : "Loading calendar..."}
              </p>
            </div>
          )}
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
