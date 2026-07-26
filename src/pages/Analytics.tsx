import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend } from "chart.js";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, CircleDollarSign, Gauge, Target, TrendingDown, TrendingUp } from "lucide-react";
import Layout from "@/components/Layout";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";
import { filterTradesByAccount } from "@/utils/tradeMetrics";
import { formatSignedCurrencyConverted } from "@/utils/currency";
import { calcAnalyticsMetrics, calcDayOfWeekPerformance, calcDirectionStats, calcMonthlyPerformance, calcPnlDistribution, calcSymbolPerformance } from "@/utils/analytics";
import { buildUnderwaterCurve } from "@/utils/drawdown";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend);

const GREEN = "#087f5b";
const GREEN_SOFT = "#20c997";
const RED = "#c92a2a";
const AMBER = "#d97706";
const PURPLE = "#7048e8";
const GRID = "rgba(33, 37, 41, .07)";
const MONO = "'JetBrains Mono', monospace";

const chartBase = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index" as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#212529",
      titleColor: "#ced4da",
      bodyColor: "#f8f9fa",
      padding: 12,
      cornerRadius: 6,
      titleFont: { family: MONO, size: 10 },
      bodyFont: { family: MONO, size: 12, weight: "600" as const },
    },
  },
  scales: {
    x: { grid: { display: false }, border: { display: false }, ticks: { color: "#868e96", font: { family: MONO, size: 10 } } },
    y: { grid: { color: GRID }, border: { display: false }, ticks: { color: "#868e96", font: { family: MONO, size: 10 }, padding: 8 } },
  },
};

const money = (value: number, currency: string) => formatSignedCurrencyConverted(value, currency, 0);
const pct = (value: number) => `${value.toFixed(2)}%`;

function Panel({ title, eyebrow, icon: Icon, children, className = "" }: { title: string; eyebrow?: string; icon: typeof Activity; children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-xl border border-border/70 bg-bg-surface ${className}`}>
    <div className="flex items-start justify-between border-b border-border/60 px-5 py-4">
      <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-[.14em] text-text-muted">{eyebrow}</div><h2 className="text-sm font-semibold text-text">{title}</h2></div>
      <Icon className="h-4 w-4 text-text-muted" />
    </div>
    {children}
  </section>;
}

export default function Analytics() {
  const allTrades = useTradeStore((s) => s.trades);
  const accounts = useTradeStore((s) => s.accounts);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const currency = useSettings((s) => s.currency);
  const account = accounts.find((item) => item.id === activeAccountId);
  const trades = useMemo(() => filterTradesByAccount(allTrades, activeAccountId), [allTrades, activeAccountId]);

  const model = useMemo(() => {
    const metrics = calcAnalyticsMetrics(trades, account?.balance);
    const monthly = calcMonthlyPerformance(trades);
    const distribution = calcPnlDistribution(trades);
    const symbols = calcSymbolPerformance(trades);
    const directions = calcDirectionStats(trades);
    const weekdays = calcDayOfWeekPerformance(trades);
    const underwater = account ? buildUnderwaterCurve(trades, account) : null;
    return { metrics, monthly, distribution, symbols, directions, weekdays, underwater };
  }, [trades, account]);

  const { metrics, monthly, distribution, symbols, directions, weekdays, underwater } = model;
  const drawdownPoints = underwater?.points ?? [];
  const maxAbsPnl = Math.max(...symbols.map((row) => Math.abs(row.pnl)), 1);
  const labels = {
    zh: language === "zh",
    title: language === "zh" ? "数据分析" : "Analytics",
    overview: language === "zh" ? "账户表现总览" : "Account performance overview",
    risk: language === "zh" ? "风险状态" : "Risk state",
    drawdown: language === "zh" ? "回撤曲线" : "Drawdown curve",
    drawdownHint: language === "zh" ? "从账户起始余额开始，按净盈亏计算" : "From starting balance, based on net P&L",
    equity: language === "zh" ? "当前权益" : "Current equity",
    netPnl: language === "zh" ? "净盈亏" : "Net P&L",
    maxDd: language === "zh" ? "最大回撤" : "Max drawdown",
    currentDd: language === "zh" ? "当前回撤" : "Current drawdown",
    recovery: language === "zh" ? "平均恢复" : "Avg recovery",
    trades: language === "zh" ? "已平仓交易" : "Closed trades",
    monthly: language === "zh" ? "月度盈亏与累计" : "Monthly P&L and cumulative",
    winRate: language === "zh" ? "胜率" : "Win rate",
    distribution: language === "zh" ? "盈亏分布" : "P&L distribution",
    direction: language === "zh" ? "多空表现" : "Long / short",
    weekday: language === "zh" ? "星期表现" : "Weekday performance",
    symbols: language === "zh" ? "品种表现" : "Symbol performance",
  };

  const monthlyData = {
    labels: monthly.map((item) => item.month),
    datasets: [
      { type: "bar" as const, label: labels.netPnl, data: monthly.map((item) => item.pnl), backgroundColor: (ctx: any) => (ctx.parsed?.y ?? 0) >= 0 ? GREEN_SOFT : RED, borderRadius: 4, maxBarThickness: 26, yAxisID: "y" },
      { type: "line" as const, label: "Cumulative", data: monthly.map((item) => item.cumulative), borderColor: PURPLE, backgroundColor: "transparent", pointRadius: 3, pointBackgroundColor: "#fff", pointBorderColor: PURPLE, borderWidth: 2, tension: .28, yAxisID: "y1" },
    ],
  } as any;
  const drawdownData = {
    labels: drawdownPoints.map((item) => item.date),
    datasets: [{ label: labels.drawdown, data: drawdownPoints.map((item) => item.drawdownPct), borderColor: RED, backgroundColor: "rgba(201,42,42,.10)", fill: true, pointRadius: 0, borderWidth: 2, tension: .25 }],
  } as any;
  const distributionData = { labels: distribution.map((item) => item.range), datasets: [{ data: distribution.map((item) => item.count), backgroundColor: [RED, "#ff8787", "#69db7c", GREEN, "#74c0fc", PURPLE], borderRadius: 4, maxBarThickness: 28 }] } as any;
  const directionData = { labels: [language === "zh" ? "做多" : "Long", language === "zh" ? "做空" : "Short"], datasets: [{ data: [directions.long.count, directions.short.count], backgroundColor: [GREEN, RED], borderWidth: 0 }] } as any;

  if (!metrics.totalTrades) return <Layout title={labels.title}><div className="rounded-xl border border-dashed border-border px-6 py-20 text-center"><Activity className="mx-auto mb-3 h-7 w-7 text-text-muted" /><p className="mb-3 text-sm text-text-secondary">{t.dashboard.noTrades}</p><Link to="/new-trade" className="text-sm font-semibold text-primary hover:underline">{t.nav.newTrade}</Link></div></Layout>;

  const riskTone = Math.abs(metrics.maxDrawdownPercent) <= 5 ? "text-primary" : Math.abs(metrics.maxDrawdownPercent) <= 10 ? "text-warning" : "text-loss";
  return <Layout title={labels.title}>
    <div className="mb-6 flex flex-col justify-between gap-3 border-b border-border pb-5 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-primary"><Gauge className="h-3.5 w-3.5" /> {labels.overview}</div><h1 className="text-2xl font-semibold tracking-tight text-text">{account?.name || labels.title}</h1><p className="mt-1 text-sm text-text-secondary">{labels.drawdownHint}</p></div><div className="tj-number text-xs text-text-muted">{metrics.totalTrades} {labels.trades}</div></div>

    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
      {[
        [labels.equity, account ? money(account.balance + metrics.netPnl, currency) : "—", "text-text"],
        [labels.netPnl, money(metrics.netPnl, currency), metrics.netPnl >= 0 ? "text-primary" : "text-loss"],
        [labels.maxDd, pct(metrics.maxDrawdownPercent), riskTone],
        [labels.currentDd, underwater ? pct(underwater.stats.currentDrawdownPct) : "—", underwater?.stats.currentDrawdownPct ? "text-loss" : "text-primary"],
        [labels.recovery, underwater ? `${underwater.stats.avgRecoveryDays.toFixed(1)}d` : "—", "text-text"],
      ].map(([label, value, color]) => <div key={label} className="rounded-xl border border-border/70 bg-bg-surface px-4 py-4"><div className="text-[10px] font-semibold uppercase tracking-[.11em] text-text-muted">{label}</div><div className={`tj-number mt-2 text-xl font-semibold ${color}`}>{value}</div></div>)}
    </div>

    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <Panel title={labels.drawdown} eyebrow={labels.risk} icon={TrendingDown}><div className="h-[300px] px-5 py-4"><Line data={drawdownData} options={{ ...chartBase, scales: { ...chartBase.scales, y: { ...chartBase.scales.y, max: 0, ticks: { ...chartBase.scales.y.ticks, callback: (value: number) => `${value}%` } } }, plugins: { ...chartBase.plugins, tooltip: { ...chartBase.plugins.tooltip, callbacks: { label: (ctx: any) => ` ${ctx.parsed.y.toFixed(2)}%` } } } } as any} /></div></Panel>
      <Panel title={labels.risk} eyebrow="AUDIT" icon={AlertTriangle}><div className="space-y-4 px-5 py-5 text-sm"><div className="flex items-center justify-between border-b border-border-subtle pb-3"><span className="text-text-secondary">{language === "zh" ? "峰值权益" : "Peak equity"}</span><b className="tj-number text-text">{underwater ? money(Math.max(...underwater.points.map((p) => p.peak), account?.balance || 0), currency) : "—"}</b></div><div className="flex items-center justify-between border-b border-border-subtle pb-3"><span className="text-text-secondary">{language === "zh" ? "回撤次数" : "Drawdowns"}</span><b className="tj-number text-text">{underwater?.stats.drawdownCount ?? 0}</b></div><div className="flex items-center justify-between border-b border-border-subtle pb-3"><span className="text-text-secondary">{language === "zh" ? "水下占比" : "Underwater time"}</span><b className="tj-number text-loss">{underwater ? `${underwater.stats.underwaterPct.toFixed(1)}%` : "—"}</b></div><div className="flex items-center justify-between"><span className="text-text-secondary">{language === "zh" ? "最大回撤金额" : "Max DD amount"}</span><b className="tj-number text-loss">{money(metrics.maxDrawdownAmount, currency)}</b></div></div></Panel>
    </div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title={labels.monthly} icon={BarChart3}><div className="h-[300px] px-5 py-4"><Bar data={monthlyData} options={{ ...chartBase, scales: { ...chartBase.scales, y1: { position: "right", grid: { display: false }, border: { display: false }, ticks: { color: PURPLE, font: { family: MONO, size: 10 } } } } } as any} /></div></Panel>
      <Panel title={labels.distribution} icon={Activity}><div className="h-[300px] px-5 py-4"><Bar data={distributionData} options={chartBase as any} /></div></Panel>
      <Panel title={labels.direction} icon={Target}><div className="grid grid-cols-[180px_1fr] items-center gap-4 px-5 py-5"><div className="h-[180px]"><Doughnut data={directionData} options={{ responsive: true, maintainAspectRatio: false, cutout: "72%", plugins: { legend: { display: false } } } as any} /></div><div className="space-y-3">{[["Long", directions.long, GREEN], ["Short", directions.short, RED]].map(([name, row, color]) => <div key={name as string} className="border-b border-border-subtle pb-3 last:border-0"><div className="flex items-center justify-between text-xs text-text-secondary"><span>{language === "zh" ? (name === "Long" ? "做多" : "做空") : name}</span><span className="tj-number">{(row as any).count} trades</span></div><div className="tj-number mt-1 text-base font-semibold" style={{ color: color as string }}>{money((row as any).pnl, currency)}</div><div className="text-[11px] text-text-muted">{(row as any).winRate}% win rate</div></div>)}</div></div></Panel>
      <Panel title={labels.weekday} icon={CalendarDays}><div className="h-[300px] px-5 py-4"><Bar data={{ labels: weekdays.map((item) => language === "zh" ? item.dayZh : item.day), datasets: [{ data: weekdays.map((item) => item.pnl), backgroundColor: weekdays.map((item) => item.pnl >= 0 ? GREEN : RED), borderRadius: 4, maxBarThickness: 28 }] } as any} options={chartBase as any} /></div></Panel>
      <Panel title={labels.symbols} icon={CircleDollarSign} className="lg:col-span-2"><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-[.12em] text-text-muted"><th className="px-5 py-3">Symbol</th><th className="px-3 py-3">Trades</th><th className="px-3 py-3">Net P&L</th><th className="px-5 py-3 text-right">Win</th></tr></thead><tbody>{symbols.slice(0, 10).map((row) => <tr key={row.symbol} className="border-b border-border-subtle last:border-0"><td className="tj-number px-5 py-3 font-semibold text-text">{row.symbol}</td><td className="tj-number px-3 py-3 text-text-secondary">{row.trades}</td><td className="px-3 py-3"><div className="flex items-center gap-3"><div className="h-1.5 min-w-[80px] flex-1 rounded-full bg-bg-elevated"><div className={`h-full rounded-full ${row.pnl >= 0 ? "bg-primary" : "bg-loss"}`} style={{ width: `${Math.max(4, Math.abs(row.pnl) / maxAbsPnl * 100)}%` }} /></div><span className={`tj-number text-xs font-semibold ${row.pnl >= 0 ? "text-primary" : "text-loss"}`}>{money(row.pnl, currency)}</span></div></td><td className="tj-number px-5 py-3 text-right text-text-secondary">{row.winRate}%</td></tr>)}</tbody></table></div></Panel>
    </div>
  </Layout>;
}
