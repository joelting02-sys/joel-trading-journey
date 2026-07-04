import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { Target, AlertTriangle } from "lucide-react";
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
import Select from "@/components/Select";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings, type CurrencyCode } from "@/store/useSettings";
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
  const setActiveAccount = useTradeStore((s) => s.setActiveAccount);
  const t = useSettings((s) => s.t());
  const currency = useSettings((s) => s.currency);
  const language = useSettings((s) => s.language);

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

  // 有笔记的交易,按平仓日期倒序,取最近 6 条
  const notedTrades = useMemo(
    () =>
      accountTrades
        .filter(
          (tr) => tr.sopNotes || tr.mindsetNotes || tr.notes
        )
        .sort((a, b) => new Date(b.closeDate).getTime() - new Date(a.closeDate).getTime())
        .slice(0, 6),
    [accountTrades]
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

  const chartOptions = useMemo(() => {
    // 计算 y 轴的最小/最大值范围,避免数值相近时所有刻度都四舍五入到同一个值
    const values = equityCurve.map((p) => p.value).filter((v) => Number.isFinite(v));
    const minVal = values.length ? Math.min(...values) : 0;
    const maxVal = values.length ? Math.max(...values) : 1;
    const range = maxVal - minVal || Math.abs(maxVal) || 1;
    const padding = range * 0.1;
    const suggestedMin = Math.max(0, minVal - padding);
    const suggestedMax = maxVal + padding;

    return {
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
          titleColor: "#f1f3f5",
          bodyColor: "#f1f3f5",
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
            title: (items: { label: string }[]) => items?.[0]?.label ?? "",
            label: (context: { parsed: { y: number } }) =>
              "余额: $" +
              context.parsed.y.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
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
          suggestedMin,
          suggestedMax,
          ticks: {
            color: "#ced4da",
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (value: number) => {
              const abs = Math.abs(value);
              if (abs >= 1_000_000) return "$" + (value / 1_000_000).toFixed(1) + "M";
              if (abs >= 1_000) return "$" + (value / 1_000).toFixed(1) + "k";
              return "$" + value.toFixed(0);
            },
          },
          border: { display: false },
        },
      },
    };
  }, [equityCurve]);

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
      {/* Account Switcher */}
      {accounts.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-sm border border-border bg-bg-elevated px-3 py-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
            {t.dashboard.account || "Account"}
          </span>
          <Select
            value={activeAccount?.id ?? ""}
            onChange={setActiveAccount}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder={language === "zh" ? "选择账户" : "Select Account"}
            className="sm:max-w-xs"
          />
        </div>
      )}

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

      {/* 个人账户目标进度(有 targetBalance 或 dailyDrawdownLimit 时显示) */}
      {activeAccount.accountType !== "prop" && (activeAccount.targetBalance || activeAccount.dailyDrawdownLimit) && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Target Balance 进度 */}
          {activeAccount.targetBalance ? (
            <TargetProgressCard
              label={language === "zh" ? "目标资金" : "Target Balance"}
              current={kpi.totalEquity}
              target={activeAccount.targetBalance}
              currency={currency}
              language={language}
            />
          ) : null}
          {/* 日内回撤警告 */}
          {activeAccount.dailyDrawdownLimit ? (
            <DailyDrawdownCard
              label={language === "zh" ? "日内回撤上限" : "Daily Drawdown Limit"}
              todayPnl={kpi.todayPnl}
              limit={activeAccount.dailyDrawdownLimit}
              currency={currency}
              language={language}
            />
          ) : null}
        </div>
      )}

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

      {/* Trade Notes */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-sm font-semibold tracking-tight text-text">
            {t.dashboard.tradeNotes}
          </span>
          <Link
            to="/trades"
            className="tj-number whitespace-nowrap text-xs text-primary transition-opacity hover:opacity-80"
          >
            {t.dashboard.viewAllTrades}
          </Link>
        </div>
        {notedTrades.length === 0 ? (
          <div className="rounded-md border border-border bg-bg-surface px-4 py-8 text-center text-sm text-text-muted">
            {t.dashboard.noNotes}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notedTrades.map((trade) => {
              const note = trade.sopNotes || trade.mindsetNotes || trade.notes || "";
              const isSop = !!trade.sopNotes;
              const isMindset = !!trade.mindsetNotes;
              return (
                <Link
                  key={trade.id}
                  to={`/trades/${trade.id}`}
                  className="block rounded-md border border-border bg-bg-surface px-4 py-3.5 transition-colors hover:border-primary"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="tj-number whitespace-nowrap text-xs font-semibold text-text">
                        {trade.symbol}
                      </span>
                      <Badge variant={trade.direction === "long" ? "primary" : "loss"}>
                        {trade.direction === "long" ? t.dashboard.long : t.dashboard.short}
                      </Badge>
                    </span>
                    <span
                      className={`tj-number whitespace-nowrap text-xs font-medium ${
                        trade.pnl >= 0 ? "text-primary" : "text-loss"
                      }`}
                    >
                      {formatSignedCurrencyConverted(trade.pnl, currency)}
                    </span>
                  </div>
                  <div className="mb-1.5 flex gap-1.5">
                    {isSop && (
                      <span className="rounded bg-primary-ghost px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {t.dashboard.tagSop}
                      </span>
                    )}
                    {isMindset && (
                      <span className="rounded bg-warning-ghost px-1.5 py-0.5 text-[10px] font-medium text-warning">
                        {t.dashboard.tagMindset}
                      </span>
                    )}
                  </div>
                  <p
                    className="m-0 overflow-hidden font-body text-[13px] leading-normal text-text-secondary"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {note}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

// 目标资金进度卡片
function TargetProgressCard({
  label, current, target, currency, language,
}: {
  label: string;
  current: number;
  target: number;
  currency: CurrencyCode;
  language: "zh" | "en";
}) {
  const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const remaining = target - current;
  const isReached = current >= target;
  return (
    <div className="rounded-md border border-border bg-bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <Target className="h-3.5 w-3.5 text-primary" />
          {label}
        </span>
        <span className={`tj-number text-sm font-semibold ${isReached ? "text-primary" : "text-text"}`}>
          {formatCurrencyConverted(current, currency)} / {formatCurrencyConverted(target, currency)}
        </span>
      </div>
      {/* 进度条 */}
      <div className="relative h-2 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${
            isReached ? "bg-primary" : "bg-primary/60"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className="text-text-muted">
          {percent.toFixed(1)}%
        </span>
        <span className={isReached ? "text-primary font-medium" : "text-text-muted"}>
          {isReached
            ? (language === "zh" ? "已达成目标" : "Target reached")
            : (language === "zh"
              ? `还差 ${formatCurrencyConverted(remaining, currency)}`
              : `${formatCurrencyConverted(remaining, currency)} to go`)}
        </span>
      </div>
    </div>
  );
}

// 日内回撤警告卡片
function DailyDrawdownCard({
  label, todayPnl, limit, currency, language,
}: {
  label: string;
  todayPnl: number;
  limit: number;
  currency: CurrencyCode;
  language: "zh" | "en";
}) {
  // todayPnl < 0 时是亏损,回撤 = |todayPnl|
  const drawdown = todayPnl < 0 ? Math.abs(todayPnl) : 0;
  const percent = limit > 0 ? Math.min((drawdown / limit) * 100, 100) : 0;
  const isWarning = drawdown > 0 && drawdown >= limit * 0.8;
  const isBreached = drawdown >= limit;
  const remaining = limit - drawdown;
  return (
    <div className={`rounded-md border px-4 py-3 ${
      isBreached
        ? "border-loss/40 bg-loss/5"
        : isWarning
          ? "border-warning/40 bg-warning/5"
          : "border-border bg-bg-surface"
    }`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <AlertTriangle className={`h-3.5 w-3.5 ${isBreached ? "text-loss" : isWarning ? "text-warning" : "text-text-muted"}`} />
          {label}
        </span>
        <span className={`tj-number text-sm font-semibold ${
          isBreached ? "text-loss" : isWarning ? "text-warning" : "text-text"
        }`}>
          {language === "zh" ? "今日" : "Today"}: {formatSignedCurrencyConverted(todayPnl, currency)}
        </span>
      </div>
      {/* 回撤进度条(反向:亏损越多越满) */}
      <div className="relative h-2 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${
            isBreached ? "bg-loss" : isWarning ? "bg-warning" : "bg-primary/40"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className={isBreached ? "text-loss font-medium" : isWarning ? "text-warning font-medium" : "text-text-muted"}>
          {isBreached
            ? (language === "zh" ? "已超过日内回撤上限!" : "Daily limit breached!")
            : isWarning
              ? (language === "zh" ? `警告:仅剩 ${formatCurrencyConverted(remaining, currency)}` : `Warning: ${formatCurrencyConverted(remaining, currency)} left`)
              : (language === "zh" ? `上限 ${formatCurrencyConverted(limit, currency)}` : `Limit ${formatCurrencyConverted(limit, currency)}`)}
        </span>
        <span className="text-text-muted">
          {percent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
