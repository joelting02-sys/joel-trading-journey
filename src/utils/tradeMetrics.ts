import type { Trade, Account } from "@/types";
import { calcHoldDays } from "./format";

// 按账户筛选交易
export function filterTradesByAccount(trades: Trade[], accountId: string): Trade[] {
  return trades.filter((t) => t.account === accountId);
}

// 计算账户权益
export function calcAccountEquity(account: Account, trades: Trade[]): number {
  const accountTrades = filterTradesByAccount(trades, account.id);
  const closedTrades = accountTrades.filter((t) => t.status === "closed");
  const totalPnl = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
  return account.balance + totalPnl;
}

// 计算 KPI 指标（从实际交易数据）
export function calcKpiMetrics(trades: Trade[], account: Account) {
  const accountTrades = filterTradesByAccount(trades, account.id);
  const closedTrades = accountTrades.filter((t) => t.status === "closed");

  const totalEquity = calcAccountEquity(account, trades);

  // 今日盈亏
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayTrades = closedTrades.filter((t) => t.closeDate === today);
  const todayPnl = todayTrades.reduce((sum, t) => sum + t.pnl, 0);
  const todayPnlPercent = account.balance > 0 ? (todayPnl / account.balance) * 100 : 0;

  // 胜率
  const winCount = closedTrades.filter((t) => t.pnl > 0).length;
  const totalCount = closedTrades.length;
  const winRate = totalCount > 0 ? (winCount / totalCount) * 100 : 0;

  // 最大回撤
  const sorted = [...closedTrades].sort(
    (a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime()
  );
  let peak = account.balance;
  let maxDd = 0;
  let maxDdAmount = 0;
  let runningEquity = account.balance;
  sorted.forEach((t) => {
    runningEquity += t.pnl;
    if (runningEquity > peak) peak = runningEquity;
    const dd = peak > 0 ? ((runningEquity - peak) / peak) * 100 : 0;
    const ddAmount = runningEquity - peak;
    if (dd < maxDd) {
      maxDd = dd;
      maxDdAmount = ddAmount;
    }
  });

  return {
    totalEquity,
    todayPnl,
    todayPnlPercent,
    winRate,
    winCount,
    totalCount,
    maxDrawdown: maxDd,
    maxDrawdownAmount: maxDdAmount,
  };
}

// 计算快捷统计
export function calcQuickStats(trades: Trade[], account: Account) {
  const accountTrades = filterTradesByAccount(trades, account.id);
  const closedTrades = accountTrades.filter((t) => t.status === "closed");

  const now = new Date();
  const monthTrades = closedTrades.filter((t) => {
    const d = new Date(t.closeDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const holdDays = closedTrades
    .filter((t) => t.closeDate)
    .map((t) => calcHoldDays(t.openDate, t.closeDate));
  const avgHoldDays =
    holdDays.length > 0
      ? holdDays.reduce((a, b) => a + b, 0) / holdDays.length
      : 0;

  const pnls = closedTrades.map((t) => t.pnl);
  const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
  const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;

  return {
    tradesThisMonth: monthTrades.length,
    avgHoldDays: Math.round(avgHoldDays * 10) / 10,
    bestTrade,
    worstTrade,
  };
}

// 构建权益曲线（从实际交易数据）
export function buildEquityCurve(trades: Trade[], account: Account) {
  const accountTrades = filterTradesByAccount(trades, account.id);
  const closedTrades = accountTrades
    .filter((t) => t.status === "closed" && t.closeDate)
    .sort((a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime());

  if (closedTrades.length === 0) {
    return [{ date: "Start", value: account.balance }];
  }

  let runningEquity = account.balance;
  const curve: { date: string; value: number }[] = [
    { date: "Start", value: account.balance },
  ];

  closedTrades.forEach((t) => {
    runningEquity += t.pnl;
    curve.push({
      date: new Date(t.closeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: runningEquity,
    });
  });

  return curve;
}
