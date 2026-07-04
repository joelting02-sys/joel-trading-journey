import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Layout from "@/components/Layout";
import { useSettings, getActiveSopRules } from "@/store/useSettings";
import { sendCalendarSummary } from "@/services/aiService";
import type { CalendarCountryCode, CalendarInstrumentCode } from "@/types";
import {
  CalendarDays,
  RefreshCw,
  AlertCircle,
  Settings as SettingsIcon,
  Trash2,
  Clock,
  Globe,
  TrendingUp,
  Banknote,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function EconomicCalendar() {
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const aiConfigs = useSettings((s) => s.aiConfigs);
  const activeAiConfigId = useSettings((s) => s.activeAiConfigId);
  const calendarPrefs = useSettings((s) => s.calendarPrefs);
  const calendarContent = useSettings((s) => s.calendarContent);
  const calendarUpdatedAt = useSettings((s) => s.calendarUpdatedAt);
  const setCalendarContent = useSettings((s) => s.setCalendarContent);
  const sopSets = useSettings((s) => s.sopSets);
  const activeSopSetId = useSettings((s) => s.activeSopSetId);
  const sopRules = getActiveSopRules({ sopSets, activeSopSetId });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPrefsPanel, setShowPrefsPanel] = useState(false);

  const configured = useMemo(() => {
    const entry = aiConfigs.find((c) => c.id === activeAiConfigId);
    return Boolean(entry?.endpoint && entry?.apiKey && entry?.model);
  }, [aiConfigs, activeAiConfigId]);

  async function handleRefresh() {
    if (loading || !configured) return;
    setLoading(true);
    setError("");
    try {
      const entry = aiConfigs.find((c) => c.id === activeAiConfigId);
      if (!entry) throw new Error(language === "zh" ? "未找到 AI 配置" : "AI config not found");
      const cfg = { endpoint: entry.endpoint, apiKey: entry.apiKey, model: entry.model };
      const raw = await sendCalendarSummary(cfg, calendarPrefs, language, sopRules);
      setCalendarContent(raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setCalendarContent("");
    setError("");
  }

  // 格式化更新时间
  const updatedTimeText = useMemo(() => {
    if (!calendarUpdatedAt) return "";
    try {
      const d = new Date(calendarUpdatedAt);
      return d.toLocaleString(language === "zh" ? "zh-CN" : "en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return calendarUpdatedAt;
    }
  }, [calendarUpdatedAt, language]);

  // 偏好摘要
  const prefsSummary = useMemo(() => {
    const parts: string[] = [];
    const countryLabels: Record<CalendarCountryCode, string> = {
      US: "🇺🇸", EU: "🇪🇺", GB: "🇬🇧", JP: "🇯🇵", AU: "🇦🇺", CA: "🇨🇦", CH: "🇨🇭", CN: "🇨🇳", NZ: "🇳🇿",
    };
    if (calendarPrefs.countries.length > 0) {
      parts.push(calendarPrefs.countries.map((c) => countryLabels[c] ?? c).join(" "));
    }
    if (calendarPrefs.instruments.length > 0) {
      parts.push(calendarPrefs.instruments.join(", "));
    }
    const impText = calendarPrefs.importance === "high_only"
      ? (language === "zh" ? "仅高" : "High")
      : calendarPrefs.importance === "medium_and_high"
        ? (language === "zh" ? "中+高" : "Med+High")
        : (language === "zh" ? "全部" : "All");
    parts.push(impText);
    return parts.join(" · ");
  }, [calendarPrefs, language]);

  if (!configured) {
    return (
      <Layout title={t.title.calendar}>
        <div className="flex h-[calc(100vh-140px)] items-center justify-center">
          <div className="w-full max-w-md rounded-md border border-border bg-bg-surface px-6 py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <AlertCircle className="h-6 w-6 text-warning" />
            </div>
            <h2 className="text-lg font-semibold text-text">
              {language === "zh" ? "请先配置 AI API" : "Configure AI API First"}
            </h2>
            <p className="mt-1.5 text-sm text-text-secondary">
              {language === "zh"
                ? "经济日历需要 AI 生成内容,请先在设置中配置 AI API。"
                : "The calendar requires an AI API. Please configure it in Settings."}
            </p>
            <Link
              to="/settings"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {language === "zh" ? "前往设置" : "Go to Settings"}
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={t.title.calendar}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        {/* 顶部操作栏 */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-surface px-4 py-3 shadow-sm">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
              <h1 className="font-display text-base font-semibold text-text">
                {language === "zh" ? "本周经济日历" : "This Week's Economic Calendar"}
              </h1>
              {updatedTimeText && (
                <span className="flex items-center gap-1 text-[11px] text-text-muted">
                  <Clock className="h-3 w-3" />
                  {language === "zh" ? `更新于 ${updatedTimeText}` : `Updated ${updatedTimeText}`}
                </span>
              )}
            </div>
            {/* 偏好摘要标签 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                {prefsSummary}
              </span>
              {calendarPrefs.includeBankHolidays && (
                <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <Banknote className="h-2.5 w-2.5" />
                  {language === "zh" ? "银行休市" : "Bank Holidays"}
                </span>
              )}
              {calendarPrefs.includeSentiment && (
                <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <TrendingUp className="h-2.5 w-2.5" />
                  {language === "zh" ? "市场情绪" : "Sentiment"}
                </span>
              )}
            </div>
          </div>

          {/* 操作按钮组 */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrefsPanel((v) => !v)}
              title={language === "zh" ? "偏好设置" : "Preferences"}
              className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{language === "zh" ? "偏好" : "Prefs"}</span>
            </button>
            {calendarContent && (
              <button
                type="button"
                onClick={handleClear}
                title={language === "zh" ? "清空内容" : "Clear"}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg-surface text-text-secondary transition-colors hover:bg-loss/5 hover:text-loss"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading
                ? (language === "zh" ? "生成中..." : "Loading...")
                : calendarContent
                  ? (language === "zh" ? "刷新" : "Refresh")
                  : (language === "zh" ? "生成日历" : "Generate")}
            </button>
          </div>
        </div>

        {/* 偏好设置面板(可折叠) */}
        {showPrefsPanel && (
          <PrefsPanel language={language} />
        )}

        {/* 错误提示 */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-loss/30 bg-loss/5 px-4 py-3 text-sm text-loss">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">
                {language === "zh" ? "生成失败" : "Generation Failed"}
              </div>
              <div className="mt-0.5 text-xs opacity-90">{error}</div>
            </div>
          </div>
        )}

        {/* 内容区 */}
        <div className="min-h-[400px] flex-1">
          {loading && !calendarContent ? (
            <LoadingSkeleton language={language} />
          ) : calendarContent ? (
            <div className="rounded-lg border border-border bg-bg-surface px-5 py-4 shadow-sm">
              <div className="prose-calendar max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="mb-3 border-b border-border pb-2 font-display text-lg font-bold text-text">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-2 mt-4 font-display text-base font-semibold text-text">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-1.5 mt-3 flex items-center gap-1.5 font-display text-sm font-semibold text-text">
                        <span className="inline-block h-3 w-1 rounded-full bg-primary" />
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="my-1.5 text-sm leading-relaxed text-text-secondary">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-text">{children}</strong>
                    ),
                    ul: ({ children }) => (
                      <ul className="my-1.5 pl-5 text-sm text-text-secondary [list-style-type:disc]">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="my-1.5 pl-5 text-sm text-text-secondary [list-style-type:decimal]">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-relaxed">{children}</li>
                    ),
                    table: ({ children }) => (
                      <div className="my-3 w-full overflow-x-auto rounded-md border border-border">
                        <table className="w-full border-collapse text-xs">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-bg-elevated">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="border-b border-border px-2.5 py-1.5 text-left font-semibold text-text whitespace-nowrap">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="border-b border-border/50 px-2.5 py-1.5 text-text-secondary">{children}</td>
                    ),
                    tr: ({ children }) => (
                      <tr className="transition-colors hover:bg-bg-elevated/40">{children}</tr>
                    ),
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline">
                        {children}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ),
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      return isBlock ? (
                        <code className="block overflow-x-auto rounded-md bg-bg-elevated px-3 py-2 font-mono text-xs">{children}</code>
                      ) : (
                        <code className="rounded-sm bg-bg-elevated px-1 py-0.5 font-mono text-[11px]">{children}</code>
                      );
                    },
                    blockquote: ({ children }) => (
                      <blockquote className="my-2 border-l-2 border-primary/40 bg-primary/5 px-3 py-1.5 text-sm text-text-secondary italic">{children}</blockquote>
                    ),
                    hr: () => <hr className="my-4 border-border" />,
                  }}
                >
                  {calendarContent}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <EmptyState language={language} onGenerate={handleRefresh} />
          )}
        </div>
      </div>
    </Layout>
  );
}

// =============== 偏好设置面板(内嵌可折叠) ===============
function PrefsPanel({ language }: { language: "zh" | "en" }) {
  const calendarPrefs = useSettings((s) => s.calendarPrefs);
  const setCalendarPrefs = useSettings((s) => s.setCalendarPrefs);
  const isZh = language === "zh";

  const countryOptions: { code: CalendarCountryCode; flag: string; nameZh: string; nameEn: string }[] = [
    { code: "US", flag: "🇺🇸", nameZh: "美国", nameEn: "United States" },
    { code: "EU", flag: "🇪🇺", nameZh: "欧元区", nameEn: "Eurozone" },
    { code: "GB", flag: "🇬🇧", nameZh: "英国", nameEn: "United Kingdom" },
    { code: "JP", flag: "🇯🇵", nameZh: "日本", nameEn: "Japan" },
    { code: "AU", flag: "🇦🇺", nameZh: "澳大利亚", nameEn: "Australia" },
    { code: "CA", flag: "🇨🇦", nameZh: "加拿大", nameEn: "Canada" },
    { code: "CH", flag: "🇨🇭", nameZh: "瑞士", nameEn: "Switzerland" },
    { code: "CN", flag: "🇨🇳", nameZh: "中国", nameEn: "China" },
    { code: "NZ", flag: "🇳🇿", nameZh: "新西兰", nameEn: "New Zealand" },
  ];

  const instrumentGroups: { group: "forex" | "metals" | "indices"; labelZh: string; labelEn: string; items: { code: CalendarInstrumentCode; label: string }[] }[] = [
    {
      group: "forex",
      labelZh: "外汇",
      labelEn: "Forex",
      items: [
        { code: "EURUSD", label: "EUR/USD" },
        { code: "AUDUSD", label: "AUD/USD" },
        { code: "GBPUSD", label: "GBP/USD" },
        { code: "USDJPY", label: "USD/JPY" },
        { code: "USDCAD", label: "USD/CAD" },
        { code: "EURJPY", label: "EUR/JPY" },
        { code: "GBPJPY", label: "GBP/JPY" },
        { code: "AUDJPY", label: "AUD/JPY" },
        { code: "EURGBP", label: "EUR/GBP" },
      ],
    },
    {
      group: "metals",
      labelZh: "贵金属/工业金属",
      labelEn: "Metals",
      items: [
        { code: "XAUUSD", label: "Gold (XAU/USD)" },
        { code: "XAGUSD", label: "Silver (XAG/USD)" },
        { code: "Copper", label: "Copper" },
      ],
    },
    {
      group: "indices",
      labelZh: "指数",
      labelEn: "Indices",
      items: [
        { code: "US500", label: "S&P 500" },
        { code: "US30", label: "Dow Jones" },
        { code: "NAS100", label: "Nasdaq" },
        { code: "GER40", label: "DAX" },
      ],
    },
  ];

  function toggleCountry(code: CalendarCountryCode) {
    const has = calendarPrefs.countries.includes(code);
    setCalendarPrefs({
      ...calendarPrefs,
      countries: has ? calendarPrefs.countries.filter((c) => c !== code) : [...calendarPrefs.countries, code],
    });
  }

  function toggleInstrument(code: CalendarInstrumentCode) {
    const has = calendarPrefs.instruments.includes(code);
    setCalendarPrefs({
      ...calendarPrefs,
      instruments: has ? calendarPrefs.instruments.filter((c) => c !== code) : [...calendarPrefs.instruments, code],
    });
  }

  return (
    <div className="rounded-lg border border-border bg-bg-surface px-4 py-3 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-text">
        <Globe className="h-3.5 w-3.5 text-primary" />
        {isZh ? "日历偏好(修改后点击「刷新」重新生成)" : "Calendar Preferences (click Refresh after changes)"}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 国家勾选 */}
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-text-secondary">
            {isZh ? "关注国家/地区" : "Focus Countries"}
          </div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {countryOptions.map((c) => {
              const checked = calendarPrefs.countries.includes(c.code);
              return (
                <label
                  key={c.code}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                    checked
                      ? "border-primary/50 bg-primary/5 text-text"
                      : "border-border bg-bg-elevated text-text-muted hover:border-text-muted hover:text-text"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCountry(c.code)}
                    className="h-3 w-3 cursor-pointer accent-primary"
                  />
                  <span className="text-sm leading-none">{c.flag}</span>
                  <span className="font-medium">{isZh ? c.nameZh : c.nameEn}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 品种勾选 */}
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-text-secondary">
            {isZh ? "关注品种" : "Focus Instruments"}
          </div>
          <div className="flex flex-col gap-2">
            {instrumentGroups.map((g) => (
              <div key={g.group}>
                <div className="mb-1 text-[10px] text-text-muted">{isZh ? g.labelZh : g.labelEn}</div>
                <div className="flex flex-wrap gap-1">
                  {g.items.map((inst) => {
                    const checked = calendarPrefs.instruments.includes(inst.code);
                    return (
                      <label
                        key={inst.code}
                        className={`flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition-colors ${
                          checked
                            ? "border-primary/50 bg-primary/5 text-text"
                            : "border-border bg-bg-elevated text-text-muted hover:border-text-muted hover:text-text"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInstrument(inst.code)}
                          className="h-2.5 w-2.5 cursor-pointer accent-primary"
                        />
                        {inst.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 重要性 + 开关 */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-text-secondary">{isZh ? "重要性:" : "Importance:"}</span>
          {[
            { v: "high_only" as const, label: isZh ? "仅高⭐⭐⭐" : "High⭐⭐⭐" },
            { v: "medium_and_high" as const, label: isZh ? "中+高⭐⭐" : "Med+High⭐⭐" },
            { v: "all" as const, label: isZh ? "全部⭐" : "All⭐" },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setCalendarPrefs({ ...calendarPrefs, importance: opt.v })}
              className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                calendarPrefs.importance === opt.v
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-text-muted hover:border-text-muted hover:text-text"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-1 text-[11px] text-text-secondary">
          <input
            type="checkbox"
            checked={calendarPrefs.includeBankHolidays}
            onChange={(e) => setCalendarPrefs({ ...calendarPrefs, includeBankHolidays: e.target.checked })}
            className="h-3 w-3 cursor-pointer accent-primary"
          />
          {isZh ? "银行休市" : "Bank Holidays"}
        </label>
        <label className="flex cursor-pointer items-center gap-1 text-[11px] text-text-secondary">
          <input
            type="checkbox"
            checked={calendarPrefs.includeSentiment}
            onChange={(e) => setCalendarPrefs({ ...calendarPrefs, includeSentiment: e.target.checked })}
            className="h-3 w-3 cursor-pointer accent-primary"
          />
          {isZh ? "市场情绪" : "Sentiment"}
        </label>
      </div>
    </div>
  );
}

// =============== 加载骨架屏 ===============
function LoadingSkeleton({ language }: { language: "zh" | "en" }) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface px-5 py-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium text-text">
          {language === "zh" ? "AI 正在生成本周经济日历..." : "AI is generating this week's calendar..."}
        </span>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="mb-4">
          <div className="mb-2 h-4 w-32 animate-pulse rounded bg-bg-elevated" />
          <div className="space-y-1.5">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-3 w-full animate-pulse rounded bg-bg-elevated/60" style={{ animationDelay: `${i * 100 + j * 50}ms` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============== 空状态 ===============
function EmptyState({ language, onGenerate }: { language: "zh" | "en"; onGenerate: () => void }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-bg-surface/50 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 shadow-sm">
        <CalendarDays className="h-10 w-10 text-primary" />
      </div>
      <h2 className="font-display text-lg font-semibold text-text">
        {language === "zh" ? "经济日历未生成" : "Calendar Not Generated"}
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-text-secondary">
        {language === "zh"
          ? "点击下方按钮,让 AI 根据你的偏好生成本周经济日历。内容会固定保留,直到你手动刷新。"
          : "Click the button below to let AI generate this week's calendar based on your preferences. Content stays until you manually refresh."}
      </p>
      <button
        type="button"
        onClick={onGenerate}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
      >
        <CalendarDays className="h-4 w-4" />
        {language === "zh" ? "生成本周日历" : "Generate Calendar"}
      </button>
      <p className="mt-3 text-[11px] text-text-muted">
        {language === "zh"
          ? "💡 可点击右上角「偏好」调整国家/品种/重要性"
          : "💡 Click 'Prefs' in the top right to adjust countries/instruments/importance"}
      </p>
    </div>
  );
}
