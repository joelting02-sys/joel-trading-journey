import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bar, Line, Doughnut, Chart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartData, ChartOptions } from "chart.js";
import {
  TrendingUp, TrendingDown, Target, Scale, Award, AlertTriangle,
  Flame, Activity, DollarSign, Zap,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";
import { formatSignedCurrencyConverted } from "@/utils/currency";
import { filterTradesByAccount } from "@/utils/tradeMetrics";
import {
  calcMonthlyPerformance,
  calcPnlDistribution,
  calcSymbolPerformance,
  calcAnalyticsMetrics,
  calcDirectionStats,
  calcDayOfWeekPerformance,
} from "@/utils/analytics";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
);

const PRIMARY = "#099268";
const PRIMARY_LIGHT = "#12b886";
const LOSS = "#e03131";
const LOSS_LIGHT = "#ff6b6b";
const MONO = "'JetBrains Mono', monospace";
const INTER = "'Inter', sans-serif";
const ACCENT_PURPLE = "#845ef7";
const ACCENT_ORANGE = "#f59f00";
const ACCENT_BLUE = "#339af0";

// 创建渐变函数
const createGradient = (ctx: CanvasRenderingContext2D | null, color1: string, color2: string, height: number) => {
  if (!ctx) return color1;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
};

// 通用 tooltip 样式 - 玻璃态效果
const tooltipStyle = {
  backgroundColor: "rgba(26, 26, 46, 0.95)",
  borderColor: "rgba(255, 255, 255, 0.1)",
  borderWidth: 1,
  titleColor: "#adb5bd",
  bodyColor: "#f8f9fa",
  titleFont: { family: INTER, size: 11, weight: 500 as const },
  bodyFont: { family: MONO, size: 12, weight: 600 as const },
  padding: 14,
  cornerRadius: 10,
  displayColors: true,
  boxPadding: 6,
  usePointStyle: true,
  pointStyle: "circle" as const,
};

// 通用坐标轴样式 - 更精致
const axisStyle = {
  x: {
    grid: { display: false },
    ticks: {
      color: "#868e96",
      font: { family: MONO, size: 10, weight: 500 as const },
      maxRotation: 0,
    },
    border: { display: false },
  },
  y: {
    grid: {
      color: "rgba(0, 0, 0, 0.03)",
      drawBorder: false,
    },
    ticks: {
      color: "#868e96",
      font: { family: MONO, size: 10, weight: 500 as const },
      padding: 8,
    },
    border: { display: false },
  },
};

type Ctx = { parsed: { y: number; x: number } };

export default function Analytics() {
  const allTrades = useTradeStore((s) => s.trades);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const currency = useSettings((s) => s.currency);

  const trades = useMemo(
    () => filterTradesByAccount(allTrades, activeAccountId),
    [allTrades, activeAccountId]
  );

  const {
    metrics, monthlyPnl, winRateChart, distribution, symbolRows,
    directionStats, dayOfWeekData,
  } = useMemo(() => {
    const monthlyData = calcMonthlyPerformance(trades);
    const distData = calcPnlDistribution(trades);
    const symbolData = calcSymbolPerformance(trades);
    const summaryMetrics = calcAnalyticsMetrics(trades);
    const dirStats = calcDirectionStats(trades);
    const dowData = calcDayOfWeekPerformance(trades);

    const base = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: tooltipStyle,
      },
      scales: axisStyle,
    };

    const months = monthlyData.map((m) => m.month);

    // 月度盈亏柱状图 + 累计盈亏曲线(双轴) - 增强视觉效果
    const monthlyPnl = {
      data: {
        labels: months,
        datasets: [
          {
            type: "bar" as const,
            label: language === "zh" ? "月度盈亏" : "Monthly P&L",
            data: monthlyData.map((m) => m.pnl),
            backgroundColor: monthlyData.map((m) =>
              m.pnl >= 0
                ? createGradient(document.createElement("canvas").getContext("2d"), PRIMARY_LIGHT + "dd", PRIMARY + "cc", 280)
                : createGradient(document.createElement("canvas").getContext("2d"), LOSS_LIGHT + "dd", LOSS + "cc", 280)
            ),
            borderRadius: 6,
            maxBarThickness: 28,
            borderSkipped: false as const,
            yAxisID: "y",
            order: 2,
          },
          {
            type: "line" as const,
            label: language === "zh" ? "累计盈亏" : "Cumulative",
            data: monthlyData.map((m) => m.cumulative),
            borderColor: ACCENT_PURPLE,
            backgroundColor: (() => {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              return createGradient(ctx, ACCENT_PURPLE + "30", ACCENT_PURPLE + "00", 280);
            })(),
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: ACCENT_PURPLE,
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: ACCENT_PURPLE,
            pointHoverBorderColor: "#ffffff",
            pointHoverBorderWidth: 3,
            borderWidth: 2.5,
            yAxisID: "y1",
            order: 1,
          },
        ],
      } as ChartData<"bar">,
      options: {
        ...base,
        plugins: {
          ...base.plugins,
          tooltip: {
            ...tooltipStyle,
            callbacks: {
              label: (c: { parsed: { y: number }; datasetIndex: number }) =>
                c.datasetIndex === 0
                  ? (language === "zh" ? "盈亏: " : "P&L: ") + formatSignedCurrencyConverted(c.parsed.y, currency, 0)
                  : (language === "zh" ? "累计: " : "Cumulative: ") + formatSignedCurrencyConverted(c.parsed.y, currency, 0),
            },
          },
        },
        scales: {
          x: {
            ...axisStyle.x,
            grid: { display: false },
          },
          y: {
            ...axisStyle.y,
            ticks: { ...axisStyle.y.ticks, callback: (v: number) => "$" + (v / 1000).toFixed(1) + "k" },
          },
          y1: {
            type: "linear" as const,
            position: "right" as const,
            grid: { display: false },
            ticks: {
              color: ACCENT_PURPLE,
              font: { family: MONO, size: 10, weight: 600 as const },
              callback: (v: number) => "$" + (v / 1000).toFixed(1) + "k",
            },
            border: { display: false },
          },
        },
      } as ChartOptions<"bar">,
    };

    // 胜率趋势(带 50% 参考线) - 增强渐变效果
    const winRateChart = {
      data: {
        labels: months,
        datasets: [
          {
            label: language === "zh" ? "胜率" : "Win Rate",
            data: monthlyData.map((m) => m.winRate),
            borderColor: PRIMARY,
            backgroundColor: (() => {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              return createGradient(ctx, PRIMARY + "35", PRIMARY + "00", 280);
            })(),
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: PRIMARY,
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2.5,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: PRIMARY,
            pointHoverBorderColor: "#ffffff",
            pointHoverBorderWidth: 3,
            borderWidth: 3,
          },
        ],
      },
      options: {
        ...base,
        plugins: {
          ...base.plugins,
          tooltip: {
            ...tooltipStyle,
            callbacks: { label: (c: Ctx) => c.parsed.y.toFixed(1) + "%" },
          },
        },
        scales: {
          x: axisStyle.x,
          y: {
            ...axisStyle.y,
            min: 0,
            max: 100,
            ticks: { ...axisStyle.y.ticks, callback: (v: number) => v + "%" },
          },
        },
      },
    };

    // 盈亏分布 - 增强渐变效果
    const distribution = {
      data: {
        labels: distData.map((d) => d.range),
        datasets: [
          {
            label: language === "zh" ? "交易数" : "Trades",
            data: distData.map((d) => d.count),
            backgroundColor: distData.map((d) =>
              d.pnl >= 0
                ? createGradient(document.createElement("canvas").getContext("2d"), PRIMARY_LIGHT + "cc", PRIMARY + "bb", 280)
                : createGradient(document.createElement("canvas").getContext("2d"), LOSS_LIGHT + "cc", LOSS + "bb", 280)
            ),
            borderRadius: 6,
            maxBarThickness: 32,
            borderSkipped: false as const,
          },
        ],
      },
      options: {
        ...base,
        plugins: {
          ...base.plugins,
          tooltip: {
            ...tooltipStyle,
            callbacks: {
              label: (c: Ctx) => c.parsed.y + (language === "zh" ? " 笔交易" : " trades"),
            },
          },
        },
        scales: {
          x: {
            ...axisStyle.x,
            ticks: {
              ...axisStyle.x.ticks,
              maxRotation: 45,
              minRotation: 0,
            },
          },
          y: { ...axisStyle.y, beginAtZero: true, ticks: { ...axisStyle.y.ticks, precision: 0 } },
        },
      },
    };

    return {
      metrics: summaryMetrics,
      monthlyPnl,
      winRateChart,
      distribution,
      symbolRows: symbolData,
      directionStats: dirStats,
      dayOfWeekData: dowData,
    };
  }, [trades, currency, language]);

  // 多空分析环形图 - 精致化
  const directionDoughnut = useMemo(() => {
    const ds = directionStats;
    return {
      data: {
        labels: [language === "zh" ? "做多" : "Long", language === "zh" ? "做空" : "Short"],
        datasets: [
          {
            data: [ds.long.count, ds.short.count],
            backgroundColor: [
              createGradient(document.createElement("canvas").getContext("2d"), PRIMARY_LIGHT, PRIMARY, 200),
              createGradient(document.createElement("canvas").getContext("2d"), LOSS_LIGHT, LOSS, 200),
            ],
            borderColor: "#ffffff",
            borderWidth: 3,
            hoverOffset: 10,
            hoverBorderWidth: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: {
            display: true,
            position: "bottom" as const,
            labels: {
              color: "#495057",
              font: { family: INTER, size: 12, weight: 500 as const },
              padding: 16,
              usePointStyle: true,
              pointStyle: "circle" as const,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            ...tooltipStyle,
            callbacks: {
              label: (c: { parsed: number; label: string }) => {
                const total = ds.long.count + ds.short.count;
                const pct = total > 0 ? ((c.parsed / total) * 100).toFixed(1) : "0";
                return ` ${c.label}: ${c.parsed} (${pct}%)`;
              },
            },
          },
        },
        animation: {
          animateRotate: true,
          animateScale: true,
        },
      },
    };
  }, [directionStats, language]);

  // 星期表现柱状图 - 增强视觉
  const dayOfWeekChart = useMemo(() => {
    const dow = dayOfWeekData;
    return {
      data: {
        labels: dow.map((d) => (language === "zh" ? d.dayZh : d.day)),
        datasets: [
          {
            label: language === "zh" ? "盈亏" : "P&L",
            data: dow.map((d) => d.pnl),
            backgroundColor: dow.map((d) =>
              d.pnl >= 0
                ? createGradient(document.createElement("canvas").getContext("2d"), PRIMARY_LIGHT + "dd", PRIMARY + "cc", 280)
                : createGradient(document.createElement("canvas").getContext("2d"), LOSS_LIGHT + "dd", LOSS + "cc", 280)
            ),
            borderRadius: 6,
            maxBarThickness: 30,
            borderSkipped: false as const,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle,
            callbacks: {
              label: (c: { parsed: { y: number }; dataIndex: number }) => {
                const d = dow[c.dataIndex];
                return [
                  (language === "zh" ? "盈亏: " : "P&L: ") + formatSignedCurrencyConverted(c.parsed.y, currency, 0),
                  (language === "zh" ? "交易数: " : "Trades: ") + d.trades,
                  (language === "zh" ? "胜率: " : "Win Rate: ") + d.winRate + "%",
                ];
              },
            },
          },
        },
        scales: axisStyle,
      },
    };
  }, [dayOfWeekData, currency, language]);

  // ===== KPI 定义 =====
  // Hero 卡内联指标(深色背景上展示)
  const heroInline = [
    {
      label: t.analyticsPage.winRate,
      value: metrics.totalTrades > 0 ? `${metrics.winRate}%` : "—",
      icon: Target,
      good: metrics.winRate >= 50,
    },
    {
      label: t.analyticsPage.profitFactor,
      value: metrics.totalTrades > 0 ? metrics.profitFactor.toFixed(2) : "—",
      icon: Scale,
      good: metrics.profitFactor >= 1,
    },
    {
      label: t.analyticsPage.expectancy,
      value: metrics.totalTrades > 0 ? formatSignedCurrencyConverted(metrics.expectancy, currency, 0) : "—",
      icon: Zap,
      good: metrics.expectancy >= 0,
    },
    {
      label: t.analyticsPage.totalTrades,
      value: String(metrics.totalTrades),
      icon: Activity,
      good: null as boolean | null,
    },
  ];

  // 极值指标卡片
  const extremeCards = [
    {
      label: t.analyticsPage.bestTrade,
      value: metrics.bestTrade !== 0 ? formatSignedCurrencyConverted(metrics.bestTrade, currency, 0) : "—",
      icon: TrendingUp,
      color: "text-primary",
      iconBg: "bg-primary/10 text-primary",
      barClass: "from-primary/60 to-primary/0",
    },
    {
      label: t.analyticsPage.worstTrade,
      value: metrics.worstTrade !== 0 ? formatSignedCurrencyConverted(metrics.worstTrade, currency, 0) : "—",
      icon: TrendingDown,
      color: "text-loss",
      iconBg: "bg-loss/10 text-loss",
      barClass: "from-loss/60 to-loss/0",
    },
    {
      label: t.analyticsPage.maxDrawdown,
      value: metrics.maxDrawdownAmount !== 0 ? `${metrics.maxDrawdownPercent}%` : "—",
      icon: AlertTriangle,
      color: "text-warning",
      iconBg: "bg-warning/10 text-warning",
      barClass: "from-warning/60 to-warning/0",
    },
  ];

  // 次级指标(小卡片行)
  const subStats = [
    { label: t.analyticsPage.avgWin, value: formatSignedCurrencyConverted(metrics.avgWin, currency, 0), positive: true },
    { label: t.analyticsPage.avgLoss, value: formatSignedCurrencyConverted(-metrics.avgLoss, currency, 0), positive: false },
    { label: t.analyticsPage.avgWinLoss, value: metrics.avgWinLoss > 0 ? `${metrics.avgWinLoss}` : "—", positive: metrics.avgWinLoss >= 1 },
    { label: t.analyticsPage.maxWinStreak, value: `${metrics.maxWinStreak}`, positive: true },
    { label: t.analyticsPage.maxLossStreak, value: `${metrics.maxLossStreak}`, positive: false },
    { label: t.analyticsPage.totalFee, value: formatSignedCurrencyConverted(metrics.totalFee, currency, 0), positive: false },
  ];

  // 空状态
  if (metrics.totalTrades === 0) {
    return (
      <Layout title={t.title.analytics}>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[...heroInline, ...extremeCards].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-bg-surface px-4 py-3">
              <div className="mb-1 text-xs font-medium text-text-muted">{s.label}</div>
              <div className="tj-number text-xl font-semibold text-text-muted">{s.value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="mb-2 text-text-secondary">{t.dashboard.noTrades}</p>
          <Link to="/new-trade" className="text-primary hover:opacity-80">{t.nav.newTrade}</Link>
        </div>
      </Layout>
    );
  }

  // 品种表最大绝对盈亏(用于进度条比例)
  const maxAbsPnl = symbolRows.length > 0
    ? Math.max(...symbolRows.map((s) => Math.abs(s.pnl)), 1)
    : 1;

  return (
    <Layout title={t.title.analytics}>
      {/* ===== Hero 总览卡:净盈亏 + 核心指标(深色高级质感) ===== */}
      <div className="relative mb-4 overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 shadow-[0_16px_48px_-16px_rgba(15,23,42,0.5)]">
        {/* 装饰性光斑 */}
        <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_55%)]" />

        <div className="relative flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-center lg:gap-10 lg:px-8">
          {/* 净盈亏主体 */}
          <div className="shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                <DollarSign className={`h-4 w-4 ${metrics.netPnl >= 0 ? "text-emerald-400" : "text-red-400"}`} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {t.analyticsPage.netPnl}
              </span>
            </div>
            <div
              className={`tj-number mt-3 text-4xl font-bold tracking-tight lg:text-[42px] ${
                metrics.netPnl >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatSignedCurrencyConverted(metrics.netPnl, currency, 0)}
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500">
              {language === "zh"
                ? `基于 ${metrics.totalTrades} 笔已平仓交易`
                : `Based on ${metrics.totalTrades} closed trades`}
            </div>
          </div>

          {/* 分隔线 */}
          <div className="hidden h-16 w-px bg-white/10 lg:block" />

          {/* 核心指标内联 */}
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {heroInline.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <Icon className="h-3 w-3" />
                    <span className="truncate">{s.label}</span>
                  </div>
                  <div
                    className={`tj-number mt-2 text-xl font-bold tracking-tight lg:text-2xl ${
                      s.good === null ? "text-slate-100" : s.good ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {s.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== 极值指标卡 ===== */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {extremeCards.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-bg-surface px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-border hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.16)]"
            >
              {/* 顶部渐变装饰条 */}
              <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${s.barClass}`} />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                  {s.label}
                </span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.iconBg} transition-transform duration-300 group-hover:scale-110`}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className={`tj-number mt-2 text-[26px] font-bold tracking-tight ${s.color}`}>
                {s.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== 次级指标条(整合式细分数据) ===== */}
      <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-border/70 bg-bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:grid-cols-3 lg:grid-cols-6">
        {subStats.map((s, i) => (
          <div
            key={s.label}
            className={`px-4 py-3.5 transition-colors duration-200 hover:bg-bg-elevated/60 ${
              i > 0 ? "border-l border-border/50" : ""
            } ${i >= 2 ? "max-lg:border-t max-lg:border-border/50" : ""} ${
              i % 2 === 0 ? "max-sm:border-l-0" : ""
            } ${i % 3 === 0 ? "sm:max-lg:border-l-0" : ""}`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
              {s.label}
            </div>
            <div
              className={`tj-number mt-1.5 text-[15px] font-bold ${s.positive ? "text-primary" : "text-loss"}`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* 图表网格 - 精致化卡片设计 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 月度盈亏 + 累计曲线 */}
        <div className="group overflow-hidden rounded-2xl border border-border/70 bg-bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-border hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-b from-bg-elevated/50 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Award className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="font-display text-sm font-semibold text-text">
                {t.analyticsPage.monthlyPnl}
              </span>
            </div>
          </div>
          <div className="relative h-[280px] px-5 py-4">
            <Chart type="bar" data={monthlyPnl.data} options={monthlyPnl.options} />
          </div>
        </div>

        {/* 胜率趋势 */}
        <div className="group overflow-hidden rounded-2xl border border-border/70 bg-bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-border hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-b from-bg-elevated/50 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="font-display text-sm font-semibold text-text">
                {t.analyticsPage.winRateTrend}
              </span>
            </div>
          </div>
          <div className="relative h-[280px] px-5 py-4">
            <Line data={winRateChart.data} options={winRateChart.options} />
            {/* 50% 参考线 */}
            <div className="pointer-events-none absolute left-5 right-5" style={{ bottom: "calc(50% + 16px)" }}>
              <div className="border-t border-dashed border-text-muted/20" />
              <span className="absolute right-0 -top-2.5 rounded bg-bg-surface px-1.5 text-[10px] font-medium text-text-muted">
                50%
              </span>
            </div>
          </div>
        </div>

        {/* 盈亏分布 */}
        <div className="group overflow-hidden rounded-2xl border border-border/70 bg-bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-border hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-b from-bg-elevated/50 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10">
                <Activity className="h-3.5 w-3.5 text-info" />
              </div>
              <span className="font-display text-sm font-semibold text-text">
                {t.analyticsPage.pnlDistribution}
              </span>
            </div>
          </div>
          <div className="relative h-[280px] px-5 py-4">
            <Bar data={distribution.data} options={distribution.options} />
          </div>
        </div>

        {/* 多空分析环形图 */}
        <div className="group overflow-hidden rounded-2xl border border-border/70 bg-bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-border hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-b from-bg-elevated/50 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10">
                <Scale className="h-3.5 w-3.5 text-warning" />
              </div>
              <span className="font-display text-sm font-semibold text-text">
                {t.analyticsPage.directionAnalysis}
              </span>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="relative h-[180px]">
              <Doughnut data={directionDoughnut.data} options={directionDoughnut.options} />
            </div>
            {/* 多空明细 */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-primary/5 px-3.5 py-2.5 transition-all duration-200 hover:bg-primary/10">
                <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  {language === "zh" ? "做多" : "Long"}
                </div>
                <div className="tj-number mt-1.5 text-base font-bold text-primary">
                  {formatSignedCurrencyConverted(directionStats.long.pnl, currency, 0)}
                </div>
                <div className="text-[10px] text-text-muted">
                  {directionStats.long.count} {language === "zh" ? "笔交易" : "trades"} ·{" "}
                  {directionStats.long.winRate}% {language === "zh" ? "胜率" : "win"}
                </div>
              </div>
              <div className="rounded-lg bg-loss/5 px-3.5 py-2.5 transition-all duration-200 hover:bg-loss/10">
                <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                  <span className="h-2.5 w-2.5 rounded-full bg-loss" />
                  {language === "zh" ? "做空" : "Short"}
                </div>
                <div className="tj-number mt-1.5 text-base font-bold text-loss">
                  {formatSignedCurrencyConverted(directionStats.short.pnl, currency, 0)}
                </div>
                <div className="text-[10px] text-text-muted">
                  {directionStats.short.count} {language === "zh" ? "笔交易" : "trades"} ·{" "}
                  {directionStats.short.winRate}% {language === "zh" ? "胜率" : "win"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 星期表现 */}
        <div className="group overflow-hidden rounded-2xl border border-border/70 bg-bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-border hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-b from-bg-elevated/50 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10">
                <Flame className="h-3.5 w-3.5 text-warning" />
              </div>
              <span className="font-display text-sm font-semibold text-text">
                {t.analyticsPage.dayOfWeek}
              </span>
            </div>
          </div>
          <div className="relative h-[280px] px-5 py-4">
            <Bar data={dayOfWeekChart.data} options={dayOfWeekChart.options} />
          </div>
        </div>

        {/* 品种表现表格(带进度条) */}
        <div className="group overflow-hidden rounded-2xl border border-border/70 bg-bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-border hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-b from-bg-elevated/50 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="font-display text-sm font-semibold text-text">
                {t.analyticsPage.symbolPerformance}
              </span>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2.5 pr-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                      Symbol
                    </th>
                    <th className="px-2 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">
                      {t.analyticsPage.trades}
                    </th>
                    <th className="px-2 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                      P&L
                    </th>
                    <th className="pl-2 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">
                      Win
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {symbolRows.slice(0, 10).map((s) => (
                    <tr
                      key={s.symbol}
                      className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-hover/50"
                    >
                      <td className="tj-number py-2.5 pr-3 font-semibold text-text">{s.symbol}</td>
                      <td className="tj-number px-2 py-2.5 text-right text-text-secondary">{s.trades}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-2 min-w-[40px] flex-1 overflow-hidden rounded-full bg-bg-elevated">
                            <div
                              className={`h-full rounded-full ${s.pnl >= 0 ? "bg-primary" : "bg-loss"}`}
                              style={{ width: `${(Math.abs(s.pnl) / maxAbsPnl) * 100}%` }}
                            />
                          </div>
                          <span
                            className={`tj-number text-xs font-bold ${s.pnl >= 0 ? "text-primary" : "text-loss"}`}
                          >
                            {formatSignedCurrencyConverted(s.pnl, currency, 0)}
                          </span>
                        </div>
                      </td>
                      <td className="tj-number pl-2 py-2.5 text-right font-medium text-text">
                        {s.winRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
