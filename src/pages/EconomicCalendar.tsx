import { useMemo } from "react";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import { CalendarDays, ExternalLink } from "lucide-react";

export default function EconomicCalendar() {
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const calendarPrefs = useSettings((s) => s.calendarPrefs);

  // TradingView 官方经济日历 Widget（支持 iframe 嵌入，稳定可靠）
  // 之前的 Investing.com widget 已被 Cloudflare 拦截（403 + X-Frame-Options），无法在 iframe 中显示
  const iframeSrc = useMemo(() => {
    // 重要性筛选：TradingView 使用 -1(低) / 0(中) / 1(高)
    let importanceFilter = "-1,0,1";
    switch (calendarPrefs.importance) {
      case "high_only":
        importanceFilter = "1";
        break;
      case "medium_and_high":
        importanceFilter = "0,1";
        break;
      default:
        importanceFilter = "-1,0,1";
    }

    const config = {
      colorTheme: "light",
      isTransparent: false,
      width: "100%",
      height: "100%",
      locale: language === "zh" ? "zh_CN" : "en",
      importanceFilter,
      countryFilter:
        "us,eu,cn,jp,gb,au,nz,ca,ch,de,fr,it,es,hk,sg,kr,in,my",
    };

    return `https://s.tradingview.com/embed-widget/events/?locale=${
      language === "zh" ? "zh_CN" : "en"
    }#${encodeURIComponent(JSON.stringify(config))}`;
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
                ? "实时全球经济事件数据,由 TradingView 提供"
                : "Real-time global economic events, powered by TradingView"}
            </p>
          </div>
          {/* 备用入口 */}
          <a
            href={
              language === "zh"
                ? "https://cn.tradingview.com/economic-calendar/"
                : "https://www.tradingview.com/economic-calendar/"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ExternalLink className="h-3 w-3" />
            {language === "zh" ? "新窗口打开" : "Open in new tab"}
          </a>
        </div>

        {/* TradingView 经济日历 Widget iframe */}
        <div
          className="overflow-hidden rounded-lg border border-border bg-bg-surface shadow-sm"
          style={{ height: "calc(100vh - 180px)", minHeight: "560px" }}
        >
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            title="TradingView Economic Calendar"
            style={{ width: "100%", height: "100%", border: "none" }}
            allow="clipboard-write"
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
      </div>
    </Layout>
  );
}
