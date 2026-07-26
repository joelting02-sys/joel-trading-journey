import type { Trade, Account } from "@/types";
import { calcHoldDays } from "./format";

export function filterTradesByAccount(trades: Trade[], accountId: string): Trade[] {
  return trades.filter((t) => t.account === accountId);
}

// 净 P&L = 毛盈亏 - 手续费，兼容 fee 存正数或负数。
export function netForEquity(trade: Trade): number {
  return Number(trade.pnl || 0) - Math.abs(Number(trade.fee || 0));
}

export function calcAccountEquity(account: Account, trades: Trade[]): number {
  const accountTrades = filterTradesByAccount(trades, account.id);
  const closedTrades = accountTrades.filter((t) => t.status === "closed");
  const totalNet = closedTrades.reduce((sum, t) => sum + netForEquity(t), 0);
  return account.balance + totalNet;
}

export function calcKpiMetrics(trades: Trade[], account: Account) {
  const accountTrades = filterTradesByAccount(trades, account.id);
  const closedTrades = accountTrades.filter((t) => t.status === "closed");
  const totalEquity = calcAccountEquity(account, trades);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayTrades = closedTrades.filter((t) => t.closeDate === today);
  const todayPnl = todayTrades.reduce((sum, t) => sum + netForEquity(t), 0);
  const todayPnlPercent = account.balance > 0 ? (todayPnl / account.balance) * 100 : 0;

  const winCount = closedTrades.filter((t) => netForEquity(t) > 0).length;
  const totalCount = closedTrades.length;
  const winRate = totalCount > 0 ? (winCount / totalCount) * 100 : 0;

  const sorted = [...closedTrades].sort(
    (a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime() || a.id.localeCompare(b.id),
  );
  let peak = account.balance;
  let maxDd = 0;
  let maxDdAmount = 0;
  let runningEquity = account.balance;
  sorted.forEach((t) => {
    runningEquity += netForEquity(t);
    if (runningEquity >= peak) peak = runningEquity;
    const dd = peak > 0 ? ((runningEquity - peak) / peak) * 100 : 0;
    const ddAmount = runningEquity - peak;
    if (dd < maxDd) {
      maxDd = dd;
      maxDdAmount = ddAmount;
    }
  });

  return { totalEquity, todayPnl, todayPnlPercent, winRate, winCount, totalCount, maxDrawdown: maxDd, maxDrawdownAmount: maxDdAmount };
}

export function calcQuickStats(trades: Trade[], account: Account) {
  const accountTrades = filterTradesByAccount(trades, account.id);
  const closedTrades = accountTrades.filter((t) => t.status === "closed");
  const now = new Date();
  const monthTrades = closedTrades.filter((t) => {
    const d = new Date(t.closeDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const holdDays = closedTrades.filter((t) => t.closeDate).map((t) => calcHoldDays(t.openDate, t.closeDate));
  const avgHoldDays = holdDays.length > 0 ? holdDays.reduce((a, b) => a + b) / holdDays.length : 0;

  // 所有绩效指标统一使用净 P&L，避免表格、KPI、Analytics 各算一套。
  const pnls = closedTrades.map(netForEquity);
  const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
  const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;

  return { tradesThisMonth: monthTrades.length, avgHoldDays: Math.round(avgHoldDays * 10) / 10, bestTrade, worstTrade };
}

export function buildEquityCurve(trades: Trade[], account: Account) {
  const accountTrades = filterTradesByAccount(trades, account.id);
  const closedTrades = accountTrades
    .filter((t) => t.status === "closed" && t.closeDate)
    .sort((a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime() || a.id.localeCompare(b.id));

  if (closedTrades.length === 0) return [{ date: "Start", value: account.balance }];

  let runningEquity = account.balance;
  const curve: { date: string; value: number }[] = [{ date: "Start", value: account.balance }];
  closedTrades.forEach((t) => {
    runningEquity += netForEquity(t);
    curve.push({ date: new Date(t.closeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: runningEquity });
  });
  return curve;
}
