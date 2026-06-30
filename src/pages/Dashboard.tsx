import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import Layout from "@/components/Layout";
import KpiCard from "@/components/KpiCard";
import Badge from "@/components/Badge";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";
import { formatPercent, formatDate } from "@/utils/format";
import {
  formatCurrencyConverted,
  formatSignedCurrencyConverted,
} from "@/utils/currency";
import {
  calcKpiMetrics,
  calcQuickStats,
  buildEquityCurve,
  filterTradesByAccount,
} from "@/utils/tradeMetrics";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

export default function Dashboard() {
  const allTrades = useTradeStore((s) => s.trades);
  const accounts = useTradeStore((s) => s.accounts);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const journalEntries = useTradeStore((s) => s.journalEntries);
  const t = useSettings((s) => s.t());
  const currency = useSettings((s) => s.currency);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? accounts[0],
    [accounts, activeAccountId]
  );

  // 按当前账户筛选交易
  const accountTrades = useMemo(
    () => (activeAccount ? filterTradesByAccount(allTrades, activeAccount.id) : []),
    [allTrades, activeAccount]
  );

  // 计算实际 KPI 指标
  const kpi = useMemo(
    () => (activeAccount ? calcKpiMetrics(allTrades, activeAccount) : null),
    [allTrades, activeAccount]
  );

  const quickStats = useMemo(
    () => (activeAccount ? calcQuickStats(allTrades, activeAccount) : null),
    [allTrades, activeAccount]
  );

  const equityCurve = useMemo(
    () => (activeAccount ? buildEquityCurve(allTrades, activeAccount) : []),
    [allTrades, activeAccount]
  );

  const recentTrades = useMemo(
    () =>
      accountTrades
        .filter((trade) => trade.status === "closed")
        .slice(0, 5),
    [accountTrades]
  );

  const recentJournals = useMemo(
    () => journalEntries.slice(0, 3),
    [journalEntries]
  );

  const chartData = useMemo(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const gradient = ctx?.createLinearGradient(0, 0, 0, 280);
    gradient?.addColorStop(0, "rgba(9, 146, 104, 0.15)");
    gradient?.addColorStop(1, "rgba(9, 146, 104, 0)");

    return {
      labels: equityCurve.map((p) => p.date),
      datasets: [
        {
          label: "Equity",
          data: equityCurve.map((p) => p.value),
          borderColor: "#099268",
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: "#099268",
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 2,
          borderWidth: 2,
        },
      ],
    };
  }, [equityCurve]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#212529",
          borderColor: "#e9ecef",
          borderWidth: 1,
          titleColor: "#868e96",
          bodyColor: "#212529",
          bodyFont: {
            family: "'JetBrains Mono', monospace",
            size: 12,
            weight: 500 as const,
          },
          titleFont: { family: "'Inter', sans-serif", size: 11 },
          padding: 10,
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            label: (context: { parsed: { y: number } }) =>
              "$" +
              context.parsed.y.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              }),
          },
        },
      },
      scales: {
        x: {
          grid: { color: "#f1f3f5", drawBorder: false },
          ticks: {
            color: "#ced4da",
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            maxRotation: 0,
          },
          border: { display: false },
        },
        y: {
          grid: { color: "#f1f3f5", drawBorder: false },
          ticks: {
            color: "#ced4da",
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (value: number) => "$" + (value / 1000).toFixed(0) + "k",
          },
          border: { display: false },
        },
      },
    }),
    []
  );

  const ratingColor: Record<string, string> = {
    A: "text-primary",
    B: "text-warning",
    C: "text-loss",
  };

  // 无账户时的空状态
  if (!activeAccount || !kpi || !quickStats) {
    return (
      <Layout title={t.title.dashboard}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="mb-2 text-text-secondary">{t.dashboard.noAccount || "No account selected. Please create an account first."}</p>
          <Link to="/accounts" className="text-primary hover:opacity-80">
            {t.nav.accounts}
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={t.title.dashboard}>
      {/* KPI Metrics Row */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t.dashboard.totalEquity}
          value={formatCurrencyConverted(kpi.totalEquity, currency)}
          delay={0}
          badge={
            <Badge variant="primary">{activeAccount.name}</Badge>
          }
        />
        <KpiCard
          label={t.dashboard.todayPnl}
          value={formatSignedCurrencyConverted(kpi.todayPnl, currency)}
          valueColor={kpi.todayPnl >= 0 ? "text-primary" : "text-loss"}
          delay={60}
          badge={
            <Badge variant={kpi.todayPnl >= 0 ? "primary" : "loss"}>
              {formatPercent(kpi.todayPnlPercent)}
            </Badge>
          }
        />
        <KpiCard
          label={t.dashboard.winRate}
          value={`${kpi.winRate.toFixed(1)}%`}
          delay={120}
          badge={
            <Badge variant="neutral">
              {kpi.winCount} {t.dashboard.of} {kpi.totalCount}
            </Badge>
          }
        />
        <KpiCard
          label={t.dashboard.maxDrawdown}
          value={`${kpi.maxDrawdown.toFixed(1)}%`}
          valueColor="text-loss"
          delay={180}
          badge={
            <Badge variant="loss">
              {formatCurrencyConverted(kpi.maxDrawdownAmount, currency)}
            </Badge>
          }
        />
      </div>

      {/* Quick Stats Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border border-border bg-bg-elevated px-4 py-2 font-mono text-[13px] tabular-nums">
        <span className="text-text-muted">{t.dashboard.tradesThisMonth}</span>
        <span className="mr-4 text-text">{quickStats.tradesThisMonth}</span>
        <span className="hidden text-border sm:inline">|</span>
        <span className="text-text-muted">{t.dashboard.avgHold}</span>
        <span className="mr-4 text-text">{quickStats.avgHoldDays}d</span>
        <span className="hidden text-border sm:inline">|</span>
        <span className="text-text-muted">{t.dashboard.bestTrade}</span>
        <span className="mr-4 text-primary">
          {formatSignedCurrencyConverted(quickStats.bestTrade, currency)}
        </span>
        <span className="hidden text-border sm:inline">|</span>
        <span className="text-text-muted">{t.dashboard.worstTrade}</span>
        <span className="text-loss">
          {formatCurrencyConverted(quickStats.worstTrade, currency)}
        </span>
      </div>

      {/* Equity Curve + Recent Trades */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr]">
        {/* Equity Curve */}
        <div className="rounded-md border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 font-display text-sm font-semibold tracking-tight text-text">
            {t.dashboard.equityCurve}
          </div>
          <div className="relative h-[280px]">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Recent Trades */}
        <div className="flex flex-col rounded-md border border-border bg-bg-surface px-5 py-4">
          <div className="mb-4 font-display text-sm font-semibold tracking-tight text-text">
            {t.dashboard.recentTrades}
          </div>
          <div className="flex flex-1 flex-col">
            {recentTrades.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-8 text-sm text-text-muted">
                {t.dashboard.noTrades || "No trades yet"}
              </div>
            ) : (
              recentTrades.map((trade, idx) => (
                <div
                  key={trade.id}
                  className={`flex items-center justify-between py-2.5 ${
                    idx < recentTrades.length - 1
                      ? "border-b border-border-subtle"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="tj-number whitespace-nowrap text-[13px] font-semibold text-text">
                      {trade.symbol}
                    </span>
                    <Badge variant={trade.direction === "long" ? "primary" : "loss"}>
                      {trade.direction === "long" ? t.dashboard.long : t.dashboard.short}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="tj-number whitespace-nowrap text-xs text-text-secondary">
                      {trade.exitPrice}
                    </span>
                    <span
                      className={`tj-number whitespace-nowrap text-[13px] font-semibold ${
                        trade.pnl >= 0 ? "text-primary" : "text-loss"
                      }`}
                    >
                      {formatSignedCurrencyConverted(trade.pnl, currency)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Daily Journal */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-sm font-semibold tracking-tight text-text">
            {t.dashboard.dailyJournal}
          </span>
          <Link
            to="/trades"
            className="tj-number whitespace-nowrap text-xs text-primary transition-opacity hover:opacity-80"
          >
            {t.dashboard.viewAllTrades}
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentJournals.map((entry) => (
            <div
              key={entry.id}
              className="rounded-md border border-border bg-bg-surface px-4 py-3.5"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="tj-number whitespace-nowrap text-xs text-text-secondary">
                  {formatDate(entry.date)}
                </span>
                <span
                  className={`text-sm font-semibold leading-none ${ratingColor[entry.rating]}`}
                >
                  {entry.rating}
                </span>
              </div>
              <p
                className="m-0 overflow-hidden font-body text-[13px] leading-normal text-text"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {entry.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
