import { useMemo } from "react";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import { CalendarDays, ExternalLink } from "lucide-react";

export default function EconomicCalendar() {
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const calendarPrefs = useSettings((s) => s.calendarPrefs);

  // Investing.com 官方 embed widget URL（专用域名，不受 X-Frame-Options 限制）
  // 数据来源：英为财情 (Investing.com 中国版)
  const iframeSrc = useMemo(() => {
    // 重要性筛选
    let importanceParam = "";
    switch (calendarPrefs.importance) {
      case "high_only":
        importanceParam = "importance=3";
        break;
      case "medium_and_high":
        importanceParam = "importance=2,3";
        break;
      default:
        importanceParam = "importance=1,2,3";
    }

    // 必填参数：columns / importance / countries
    // 可选参数：calId（特定日历）、lang（语言）
    const params = new URLSearchParams({
      columns: "exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous",
      importance: importanceParam.replace("importance=", ""),
      countries: "25,32,6,37,72,5,22,39,14,10,35,17,43,12,4,26,48,9,68,42,36,56,110",
      calId: "",  // 主日历
      lang: language === "zh" ? "54" : "1",  // 54=简体中文, 1=English
    });

    return `https://sslecal2.forexprostools.com?${params.toString()}`;
  }, [calendarPrefs.importance, language]);

  return (
    <Layout title={t.title.calendar}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        {/* 标题栏 */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-4 py-3 shadow-sm">
          <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-semibold text-text">
              {language === "zh" ? "经济日历" : "Economic Calendar"}
            </h1>
            <p className="text-[11px] text-text-muted">
              {language === "zh"
                ? "实时全球经济事件数据,由英为财情 (Investing.com) 提供"
                : "Real-time global economic events, powered by Investing.com"}
            </p>
          </div>
          {/* 备用入口 */}
          <a
            href="https://cn.investing.com/economic-calendar/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ExternalLink className="h-3 w-3" />
            {language === "zh" ? "新窗口打开" : "Open in new tab"}
          </a>
        </div>

        {/* Investing.com 经济日历 Widget iframe */}
        <div
          className="overflow-hidden rounded-lg border border-border bg-bg-surface shadow-sm"
          style={{ height: "calc(100vh - 180px)", minHeight: "560px" }}
        >
          <iframe
            src={iframeSrc}
            title="Investing.com Economic Calendar"
            style={{ width: "100%", height: "100%", border: "none" }}
            allow="clipboard-write"
            loading="lazy"
          />
        </div>

        {/* 数据来源归属 */}
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>
            {language === "zh"
              ? "数据仅供参考,不构成投资建议"
              : "Data for reference only, not investment advice"}
          </span>
          <div className="flex items-center gap-1">
            <span>{language === "zh" ? "数据来源" : "Powered by"}</span>
            <a
              href="https://www.investing.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-text-secondary hover:text-text"
            >
              Investing.com
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
