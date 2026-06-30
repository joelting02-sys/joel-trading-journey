import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
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
} from "@/utils/analytics";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const PRIMARY = "#099268";
const LOSS = "#e03131";
const MONO = "'JetBrains Mono', monospace";
const INTER = "'Inter', sans-serif";

type BarCtx = { parsed: { y: number } };

export default function Analytics() {
  const allTrades = useTradeStore((s) => s.trades);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const t = useSettings((s) => s.t());
  const currency = useSettings((s) => s.currency);

  // 按当前账户筛选交易
  const trades = useMemo(
    () => filterTradesByAccount(allTrades, activeAccountId),
    [allTrades, activeAccountId]
  );

  const { metrics, monthlyPnl, winRate, distribution, symbolRows } = useMemo(() => {
    const monthlyData = calcMonthlyPerformance(trades);
    const distData = calcPnlDistribution(trades);
    const symbolData = calcSymbolPerformance(trades);
    const summaryMetrics = calcAnalyticsMetrics(trades);

    // 共享图表配置
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#212529",
          borderWidth: 0,
          titleColor: "#868e96",
          bodyColor: "#ffffff",
          titleFont: { family: INTER, size: 11 },
          bodyFont: { family: MONO, size: 12, weight: 500 as const },
          padding: 10,
          cornerRadius: 6,
          displayColors: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#ced4da", font: { family: MONO, size: 11 }, maxRotation: 0 },
          border: { display: false },
        },
        y: {
          grid: { color: "#f1f3f5", drawBorder: false },
          ticks: { color: "#ced4da", font: { family: MONO, size: 11 } },
          border: { display: false },
        },
      },
    };

    const months = monthlyData.map((m) => m.month);

    const monthlyPnl = {
      data: {
        labels: months,
        datasets: [
          {
            label: "P&L",
            data: monthlyData.map((m) => m.pnl),
            backgroundColor: monthlyData.map((m) => (m.pnl >= 0 ? PRIMARY : LOSS)),
            borderRadius: 4,
            maxBarThickness: 34,
          },
        ],
      },
      options: {
        ...base,
        plugins: {
          ...base.plugins,
          tooltip: {
            ...base.plugins.tooltip,
            callbacks: {
              label: (c: BarCtx) => formatSignedCurrencyConverted(c.parsed.y, currency, 0),
            },
          },
        },
        scales: {
          ...base.scales,
          y: {
            ...base.scales.y,
            ticks: {
              ...base.scales.y.ticks,
              callback: (v: number) => "$" + (v / 1000).toFixed(0) + "k",
            },
          },
        },
      },
    };

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const gradient = ctx?.createLinearGradient(0, 0, 0, 280);
    gradient?.addColorStop(0, "rgba(9, 146, 104, 0.18)");
    gradient?.addColorStop(1, "rgba(9, 146, 104, 0)");

    const winRate = {
      data: {
        labels: months,
        datasets: [
          {
            label: "Win Rate",
            data: monthlyData.map((m) => m.winRate),
            borderColor: PRIMARY,
            backgroundColor: gradient,
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: PRIMARY,
            pointBorderColor: "#ffffff",
            pointBorderWidth: 1.5,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
        ],
      },
      options: {
        ...base,
        plugins: {
          ...base.plugins,
          tooltip: {
            ...base.plugins.tooltip,
            callbacks: { label: (c: BarCtx) => c.parsed.y.toFixed(1) + "%" },
          },
        },
        scales: {
          ...base.scales,
          y: {
            ...base.scales.y,
            min: 0,
            max: 100,
            ticks: { ...base.scales.y.ticks, callback: (v: number) => v + "%" },
          },
        },
      },
    };

    const distribution = {
      data: {
        labels: distData.map((d) => d.range),
        datasets: [
          {
            label: "Trades",
            data: distData.map((d) => d.count),
            backgroundColor: distData.map((d) => (d.pnl >= 0 ? PRIMARY : LOSS)),
            borderRadius: 4,
            maxBarThickness: 38,
          },
        ],
      },
      options: {
        ...base,
        plugins: {
          ...base.plugins,
          tooltip: {
            ...base.plugins.tooltip,
            callbacks: { label: (c: BarCtx) => c.parsed.y + " trades" },
          },
        },
        scales: {
          ...base.scales,
          y: {
            ...base.scales.y,
            beginAtZero: true,
            ticks: { ...base.scales.y.ticks, precision: 0 },
          },
        },
      },
    };

    return {
      metrics: summaryMetrics,
      monthlyPnl,
      winRate,
      distribution,
      symbolRows: symbolData,
    };
  }, [trades, currency]);

  const stats = [
    { label: t.analyticsPage.totalTrades, value: String(metrics.totalTrades) },
    { label: t.analyticsPage.winRate, value: metrics.totalTrades > 0 ? `${metrics.winRate}%` : "—" },
    { label: t.analyticsPage.profitFactor, value: metrics.totalTrades > 0 ? metrics.profitFactor.toFixed(2) : "—" },
    { label: t.analyticsPage.avgWinLoss, value: metrics.totalTrades > 0 ? metrics.avgWinLoss.toFixed(2) : "—" },
  ];

  // 空状态
  if (metrics.totalTrades === 0) {
    return (
      <Layout title={t.title.analytics}>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-md border border-border bg-bg-surface px-5 py-4">
              <div className="mb-2 font-body text-xs font-medium text-text-secondary">{s.label}</div>
              <div className="tj-number text-2xl font-semibold text-text-muted">{s.value}</div>
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

  return (
    <Layout title={t.title.analytics}>
      {/* Summary Stat Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-bg-surface px-5 py-4">
            <div className="mb-2 font-body text-xs font-medium text-text-secondary">{s.label}</div>
            <div className="tj-number text-2xl font-semibold text-text">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts + Table Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 font-display text-sm font-semibold tracking-tight text-text">
            {t.analyticsPage.monthlyPnl}
          </div>
          <div className="relative h-[280px]">
            <Bar data={monthlyPnl.data} options={monthlyPnl.options} />
          </div>
        </div>

        <div className="rounded-md border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 font-display text-sm font-semibold tracking-tight text-text">
            {t.analyticsPage.winRateTrend}
          </div>
          <div className="relative h-[280px]">
            <Line data={winRate.data} options={winRate.options} />
          </div>
        </div>

        <div className="rounded-md border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 font-display text-sm font-semibold tracking-tight text-text">
            {t.analyticsPage.pnlDistribution}
          </div>
          <div className="relative h-[280px]">
            <Bar data={distribution.data} options={distribution.options} />
          </div>
        </div>

        <div className="rounded-md border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 font-display text-sm font-semibold tracking-tight text-text">
            {t.analyticsPage.symbolPerformance}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 text-left font-medium text-text-secondary">Symbol</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">{t.analyticsPage.trades}</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">P&L</th>
                  <th className="pl-3 py-2 text-right font-medium text-text-secondary">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {symbolRows.map((s) => (
                  <tr key={s.symbol} className="border-b border-border-subtle last:border-0">
                    <td className="tj-number py-2.5 pr-3 font-semibold text-text">{s.symbol}</td>
                    <td className="tj-number px-3 py-2.5 text-right text-text-secondary">{s.trades}</td>
                    <td className={`tj-number px-3 py-2.5 text-right font-semibold ${s.pnl >= 0 ? "text-primary" : "text-loss"}`}>
                      {formatSignedCurrencyConverted(s.pnl, currency, 0)}
                    </td>
                    <td className="tj-number pl-3 py-2.5 text-right text-text">{s.winRate}%</td>
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
