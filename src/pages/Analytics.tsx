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
const LOSS = "#e03131";
const MONO = "'JetBrains Mono', monospace";
const INTER = "'Inter', sans-serif";

// 通用 tooltip 样式
const tooltipStyle = {
  backgroundColor: "#1a1a2e",
  borderWidth: 0,
  titleColor: "#868e96",
  bodyColor: "#f8f9fa",
  titleFont: { family: INTER, size: 11 },
  bodyFont: { family: MONO, size: 12, weight: 600 as const },
  padding: 12,
  cornerRadius: 8,
  displayColors: true,
  boxPadding: 4,
};

// 通用坐标轴样式
const axisStyle = {
  x: {
    grid: { display: false },
    ticks: { color: "#868e96", font: { family: MONO, size: 11 }, maxRotation: 0 },
    border: { display: false },
  },
  y: {
    grid: { color: "rgba(0,0,0,0.04)", drawBorder: false },
    ticks: { color: "#868e96", font: { family: MONO, size: 11 } },
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

    // 月度盈亏柱状图 + 累计盈亏曲线(双轴)
    const monthlyPnl = {
      data: {
        labels: months,
        datasets: [
          {
            type: "bar" as const,
            label: language === "zh" ? "月度盈亏" : "Monthly P&L",
            data: monthlyData.map((m) => m.pnl),
            backgroundColor: monthlyData.map((m) => (m.pnl >= 0 ? PRIMARY : LOSS)),
            borderRadius: 4,
            maxBarThickness: 30,
            yAxisID: "y",
            order: 2,
          },
          {
            type: "line" as const,
            label: language === "zh" ? "累计盈亏" : "Cumulative",
            data: monthlyData.map((m) => m.cumulative),
            borderColor: "#1a1a2e",
            backgroundColor: "rgba(26,26,46,0.06)",
            fill: false,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: "#1a1a2e",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 1.5,
            pointHoverRadius: 5,
            borderWidth: 2,
            borderDash: [4, 3],
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
          x: axisStyle.x,
          y: {
            ...axisStyle.y,
            ticks: { ...axisStyle.y.ticks, callback: (v: number) => "$" + (v / 1000).toFixed(1) + "k" },
          },
          y1: {
            type: "linear" as const,
            position: "right" as const,
            grid: { display: false },
            ticks: { color: "#1a1a2e", font: { family: MONO, size: 11 } },
            border: { display: false },
          },
        },
      } as ChartOptions<"bar">,
    };

    // 胜率趋势(带 50% 参考线)
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
              const g = ctx?.createLinearGradient(0, 0, 0, 280);
              g?.addColorStop(0, "rgba(9, 146, 104, 0.2)");
              g?.addColorStop(1, "rgba(9, 146, 104, 0)");
              return g;
            })(),
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: PRIMARY,
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            borderWidth: 2.5,
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
          annotation: {},
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

    // 盈亏分布
    const distribution = {
      data: {
        labels: distData.map((d) => d.range),
        datasets: [
          {
            label: language === "zh" ? "交易数" : "Trades",
            data: distData.map((d) => d.count),
            backgroundColor: distData.map((d) => (d.pnl >= 0 ? PRIMARY : LOSS)),
            borderRadius: 4,
            maxBarThickness: 36,
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
              label: (c: Ctx) => c.parsed.y + (language === "zh" ? " 笔" : " trades"),
            },
          },
        },
        scales: {
          x: axisStyle.x,
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

  // 多空分析环形图
  const directionDoughnut = useMemo(() => {
    const ds = directionStats;
    return {
      data: {
        labels: [language === "zh" ? "做多" : "Long", language === "zh" ? "做空" : "Short"],
        datasets: [
          {
            data: [ds.long.count, ds.short.count],
            backgroundColor: [PRIMARY, LOSS],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            display: true,
            position: "bottom" as const,
            labels: {
              color: "#495057",
              font: { family: INTER, size: 12 },
              padding: 12,
              usePointStyle: true,
              pointStyle: "circle" as const,
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
      },
    };
  }, [directionStats, language]);

  // 星期表现柱状图
  const dayOfWeekChart = useMemo(() => {
    const dow = dayOfWeekData;
    return {
      data: {
        labels: dow.map((d) => (language === "zh" ? d.dayZh : d.day)),
        datasets: [
          {
            label: language === "zh" ? "盈亏" : "P&L",
            data: dow.map((d) => d.pnl),
            backgroundColor: dow.map((d) => (d.pnl >= 0 ? PRIMARY : LOSS)),
            borderRadius: 4,
            maxBarThickness: 34,
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
                  (language === "zh" ? "交易: " : "Trades: ") + d.trades,
                  (language === "zh" ? "胜率: " : "Win: ") + d.winRate + "%",
                ];
              },
            },
          },
        },
        scales: axisStyle,
      },
    };
  }, [dayOfWeekData, currency, language]);

  // KPI 卡片定义
  const stats = [
    {
      label: t.analyticsPage.totalTrades,
      value: String(metrics.totalTrades),
      icon: Activity,
      color: "text-text-secondary",
      bg: "bg-bg-elevated",
    },
    {
      label: t.analyticsPage.winRate,
      value: metrics.totalTrades > 0 ? `${metrics.winRate}%` : "—",
      icon: Target,
      color: metrics.winRate >= 50 ? "text-primary" : "text-loss",
      bg: metrics.winRate >= 50 ? "bg-primary/10" : "bg-loss/10",
    },
    {
      label: t.analyticsPage.profitFactor,
      value: metrics.totalTrades > 0 ? metrics.profitFactor.toFixed(2) : "—",
      icon: Scale,
      color: metrics.profitFactor >= 1 ? "text-primary" : "text-loss",
      bg: metrics.profitFactor >= 1 ? "bg-primary/10" : "bg-loss/10",
    },
    {
      label: t.analyticsPage.netPnl,
      value: formatSignedCurrencyConverted(metrics.netPnl, currency, 0),
      icon: DollarSign,
      color: metrics.netPnl >= 0 ? "text-primary" : "text-loss",
      bg: metrics.netPnl >= 0 ? "bg-primary/10" : "bg-loss/10",
    },
    {
      label: t.analyticsPage.expectancy,
      value: metrics.totalTrades > 0 ? formatSignedCurrencyConverted(metrics.expectancy, currency, 0) : "—",
      icon: Zap,
      color: metrics.expectancy >= 0 ? "text-primary" : "text-loss",
      bg: metrics.expectancy >= 0 ? "bg-primary/10" : "bg-loss/10",
    },
    {
      label: t.analyticsPage.maxDrawdown,
      value: metrics.maxDrawdownAmount !== 0
        ? `${metrics.maxDrawdownPercent}%`
        : "—",
      icon: AlertTriangle,
      color: "text-loss",
      bg: "bg-loss/10",
    },
    {
      label: t.analyticsPage.bestTrade,
      value: metrics.bestTrade !== 0 ? formatSignedCurrencyConverted(metrics.bestTrade, currency, 0) : "—",
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: t.analyticsPage.worstTrade,
      value: metrics.worstTrade !== 0 ? formatSignedCurrencyConverted(metrics.worstTrade, currency, 0) : "—",
      icon: TrendingDown,
      color: "text-loss",
      bg: "bg-loss/10",
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
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-bg-surface px-4 py-3">
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
      {/* KPI 卡片行 (8 个) */}
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-lg border border-border bg-bg-surface px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">{s.label}</span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ${s.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                </span>
              </div>
              <div className={`tj-number mt-2 text-xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* 次级指标小卡片行 */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {subStats.map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-bg-surface/60 px-3 py-2">
            <div className="text-[10px] font-medium text-text-muted">{s.label}</div>
            <div className={`tj-number mt-0.5 text-sm font-semibold ${s.positive ? "text-primary" : "text-loss"}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* 图表网格 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 月度盈亏 + 累计曲线 */}
        <div className="rounded-lg border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-text-secondary" />
            <span className="font-display text-sm font-semibold text-text">{t.analyticsPage.monthlyPnl}</span>
          </div>
          <div className="relative h-[280px]">
            <Chart type="bar" data={monthlyPnl.data} options={monthlyPnl.options} />
          </div>
        </div>

        {/* 胜率趋势 */}
        <div className="rounded-lg border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-text-secondary" />
            <span className="font-display text-sm font-semibold text-text">{t.analyticsPage.winRateTrend}</span>
          </div>
          <div className="relative h-[280px]">
            <Line data={winRateChart.data} options={winRateChart.options} />
            {/* 50% 参考线 */}
            <div className="pointer-events-none absolute left-0 right-0" style={{ bottom: "50%" }}>
              <div className="border-t border-dashed border-text-muted/30" />
              <span className="absolute right-0 -top-2.5 text-[10px] text-text-muted">50%</span>
            </div>
          </div>
        </div>

        {/* 盈亏分布 */}
        <div className="rounded-lg border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-text-secondary" />
            <span className="font-display text-sm font-semibold text-text">{t.analyticsPage.pnlDistribution}</span>
          </div>
          <div className="relative h-[280px]">
            <Bar data={distribution.data} options={distribution.options} />
          </div>
        </div>

        {/* 多空分析环形图 */}
        <div className="rounded-lg border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Scale className="h-4 w-4 text-text-secondary" />
            <span className="font-display text-sm font-semibold text-text">{t.analyticsPage.directionAnalysis}</span>
          </div>
          <div className="relative h-[200px]">
            <Doughnut data={directionDoughnut.data} options={directionDoughnut.options} />
          </div>
          {/* 多空明细 */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-primary/5 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {language === "zh" ? "做多" : "Long"}
              </div>
              <div className="tj-number mt-1 text-sm font-bold text-primary">
                {formatSignedCurrencyConverted(directionStats.long.pnl, currency, 0)}
              </div>
              <div className="text-[10px] text-text-muted">
                {directionStats.long.count} {language === "zh" ? "笔" : "trades"} · {directionStats.long.winRate}%
              </div>
            </div>
            <div className="rounded-md bg-loss/5 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="h-2 w-2 rounded-full bg-loss" />
                {language === "zh" ? "做空" : "Short"}
              </div>
              <div className="tj-number mt-1 text-sm font-bold text-loss">
                {formatSignedCurrencyConverted(directionStats.short.pnl, currency, 0)}
              </div>
              <div className="text-[10px] text-text-muted">
                {directionStats.short.count} {language === "zh" ? "笔" : "trades"} · {directionStats.short.winRate}%
              </div>
            </div>
          </div>
        </div>

        {/* 星期表现 */}
        <div className="rounded-lg border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-text-secondary" />
            <span className="font-display text-sm font-semibold text-text">{t.analyticsPage.dayOfWeek}</span>
          </div>
          <div className="relative h-[280px]">
            <Bar data={dayOfWeekChart.data} options={dayOfWeekChart.options} />
          </div>
        </div>

        {/* 品种表现表格(带进度条) */}
        <div className="rounded-lg border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-text-secondary" />
            <span className="font-display text-sm font-semibold text-text">{t.analyticsPage.symbolPerformance}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 text-left font-medium text-text-secondary">Symbol</th>
                  <th className="px-2 py-2 text-right font-medium text-text-secondary">{t.analyticsPage.trades}</th>
                  <th className="px-2 py-2 text-left font-medium text-text-secondary">P&L</th>
                  <th className="pl-2 py-2 text-right font-medium text-text-secondary">Win</th>
                </tr>
              </thead>
              <tbody>
                {symbolRows.slice(0, 10).map((s) => (
                  <tr key={s.symbol} className="border-b border-border-subtle last:border-0">
                    <td className="tj-number py-2 pr-3 font-semibold text-text">{s.symbol}</td>
                    <td className="tj-number px-2 py-2 text-right text-text-secondary">{s.trades}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 min-w-[40px] flex-1 overflow-hidden rounded-full bg-bg-elevated">
                          <div
                            className={`h-full rounded-full ${s.pnl >= 0 ? "bg-primary" : "bg-loss"}`}
                            style={{ width: `${(Math.abs(s.pnl) / maxAbsPnl) * 100}%` }}
                          />
                        </div>
                        <span className={`tj-number text-xs font-semibold ${s.pnl >= 0 ? "text-primary" : "text-loss"}`}>
                          {formatSignedCurrencyConverted(s.pnl, currency, 0)}
                        </span>
                      </div>
                    </td>
                    <td className="tj-number pl-2 py-2 text-right text-text">{s.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
