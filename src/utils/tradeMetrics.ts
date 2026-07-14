import type { Trade, Account } from "@/types";
import { calcHoldDays } from "./format";

// 按账户筛选交易
export function filterTradesByAccount(trades: Trade[], accountId: string): Trade[] {
  return trades.filter((t) => t.account === accountId);
}

// 净 P&L = 毛盈亏 + 手续费（手续费为负数，所以等于减去手续费绝对值）
// 用于权益计算，确保总权益正确扣除手续费
export function netForEquity(trade: Trade): number {
  return trade.pnl + (trade.fee ?? 0);
}

// 计算账户权益（按净 P&L 累加）
export function calcAccountEquity(account: Account, trades: Trade[]): number {
  const accountTrades = filterTradesByAccount(trades, account.id);
  const closedTrades = accountTrades.filter((t) => t.status === "closed");
  const totalNet = closedTrades.reduce((sum, t) => sum + netForEquity(t), 0);
  return account.balance + totalNet;
}

// 计算 KPI 指标（从实际交易数据）
export function calcKpiMetrics(trades: Trade[], account: Account) {
  const accountTrades = filterTradesByAccount(trades, account.id);
  const closedTrades = accountTrades.filter((t) => t.status === "closed");

  const totalEquity = calcAccountEquity(account, trades);

  // 今日盈亏（按净 P&L 计算）
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayTrades = closedTrades.filter((t) => t.closeDate === today);
  const todayPnl = todayTrades.reduce((sum, t) => sum + netForEquity(t), 0);
  const todayPnlPercent = account.balance > 0 ? (todayPnl / account.balance) * 100 : 0;

  // 胜率（以净 P&L 判定）
  const winCount = closedTrades.filter((t) => netForEquity(t) > 0).length;
  const totalCount = closedTrades.length;
  const winRate = totalCount > 0 ? (winCount / totalCount) * 100 : 0;

  // 最大回撤（用净 P&L 推权益曲线）
  const sorted = [...closedTrades].sort(
    (a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime()
  );
  let peak = account.balance;
  let maxDd = 0;
  let maxDdAmount = 0;
  let runningEquity = account.balance;
  sorted.forEach((t) => {
    runningEquity += netForEquity(t);
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
      ? holdDays.reduce((a, b) => a + b) / holdDays.length
      : 0;

  // best/worst 按毛 P&L 展示，与表格「盈亏」列语义一致
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

// 构建权益曲线（按净 P&L 累加 — 真正进账户的钱）
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
    runningEquity += netForEquity(t);
    curve.push({
      date: new Date(t.closeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: runningEquity,
    });
  });

  return curve;
}
