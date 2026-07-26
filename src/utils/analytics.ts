import type { Trade } from "@/types";
import { useTradeStore } from "@/store/useTradeStore";

// 从实际交易数据计算分析指标

/** 单笔交易真正进入权益曲线的净盈亏。手续费无论存正数或负数都只扣一次。 */
const netPnl = (trade: Trade): number =>
  Number(trade.pnl || 0) - Math.abs(Number(trade.fee || 0));

/**
 * 数据分析页过去没有把账户起始资金传进来，最大回撤会从 0 开始计算。
 * 例如先赚 100、再亏 50 会被算成 50% 回撤，而 10,000 账户实际只有约 0.5%。
 * 这里优先使用显式传入值；旧调用则从当前账户安全读取起始余额。
 */
function resolveStartingBalance(trades: Trade[], explicit?: number): number {
  if (Number.isFinite(explicit) && (explicit ?? 0) > 0) return explicit as number;

  const state = useTradeStore.getState();
  const tradeAccountId = trades.find((trade) => trade.account)?.account;
  const account = state.accounts.find((item) => item.id === tradeAccountId)
    ?? state.accounts.find((item) => item.id === state.activeAccountId);
  const balance = Number(account?.balance ?? 0);
  return Number.isFinite(balance) && balance > 0 ? balance : 0;
}

// 月度盈亏 + 胜率趋势 + 累计盈亏
export function calcMonthlyPerformance(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed" && t.closeDate);
  if (closed.length === 0) return [];

  const byMonth: Record<string, { pnl: number; wins: number; total: number }> = {};

  closed.forEach((t) => {
    const d = new Date(t.closeDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { pnl: 0, wins: 0, total: 0 };
    const net = netPnl(t);
    byMonth[key].pnl += net;
    byMonth[key].total += 1;
    if (net > 0) byMonth[key].wins += 1;
  });

  let cumulative = 0;
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, v]) => {
      const [y, m] = key.split("-");
      const date = new Date(Number(y), Number(m) - 1);
      cumulative += Math.round(v.pnl);
      return {
        month: date.toLocaleDateString("en-US", { month: "short" }),
        pnl: Math.round(v.pnl),
        cumulative,
        winRate: v.total > 0 ? Math.round((v.wins / v.total) * 1000) / 10 : 0,
        trades: v.total,
      };
    });
}

// 盈亏分布
export function calcPnlDistribution(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed");
  const buckets = [
    { range: "<-$1k", min: -Infinity, max: -1000, count: 0, pnl: 0 },
    { range: "-$1k~0", min: -1000, max: 0, count: 0, pnl: 0 },
    { range: "$0~$500", min: 0, max: 500, count: 0, pnl: 0 },
    { range: "$500~$1k", min: 500, max: 1000, count: 0, pnl: 0 },
    { range: "$1k~$2k", min: 1000, max: 2000, count: 0, pnl: 0 },
    { range: ">$2k", min: 2000, max: Infinity, count: 0, pnl: 0 },
  ];

  closed.forEach((t) => {
    const net = netPnl(t);
    const b = buckets.find((bucket) => net >= bucket.min && net < bucket.max);
    if (b) {
      b.count += 1;
      b.pnl += net;
    }
  });

  return buckets;
}

// 品种表现
export function calcSymbolPerformance(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed");
  const bySymbol: Record<string, { trades: number; pnl: number; wins: number }> = {};

  closed.forEach((t) => {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { trades: 0, pnl: 0, wins: 0 };
    const net = netPnl(t);
    bySymbol[t.symbol].trades += 1;
    bySymbol[t.symbol].pnl += net;
    if (net > 0) bySymbol[t.symbol].wins += 1;
  });

  return Object.entries(bySymbol)
    .map(([symbol, v]) => ({
      symbol,
      trades: v.trades,
      pnl: Math.round(v.pnl),
      winRate: v.trades > 0 ? Math.round((v.wins / v.trades) * 100) : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

// 多空分析
export function calcDirectionStats(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed");
  const longs = closed.filter((t) => t.direction === "long");
  const shorts = closed.filter((t) => t.direction === "short");

  const longPnl = longs.reduce((s, t) => s + netPnl(t), 0);
  const shortPnl = shorts.reduce((s, t) => s + netPnl(t), 0);
  const longWins = longs.filter((t) => netPnl(t) > 0).length;
  const shortWins = shorts.filter((t) => netPnl(t) > 0).length;

  return {
    long: {
      count: longs.length,
      pnl: Math.round(longPnl),
      winRate: longs.length > 0 ? Math.round((longWins / longs.length) * 1000) / 10 : 0,
    },
    short: {
      count: shorts.length,
      pnl: Math.round(shortPnl),
      winRate: shorts.length > 0 ? Math.round((shortWins / shorts.length) * 1000) / 10 : 0,
    },
  };
}

// 星期分析
export function calcDayOfWeekPerformance(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed" && t.closeDate);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayLabelsZh = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const byDay: Record<number, { pnl: number; wins: number; total: number }> = {};

  closed.forEach((t) => {
    const d = new Date(t.closeDate).getDay();
    if (!byDay[d]) byDay[d] = { pnl: 0, wins: 0, total: 0 };
    const net = netPnl(t);
    byDay[d].pnl += net;
    byDay[d].total += 1;
    if (net > 0) byDay[d].wins += 1;
  });

  // 只返回周一到周五(交易日常见)
  return [1, 2, 3, 4, 5].map((day) => {
    const v = byDay[day] || { pnl: 0, wins: 0, total: 0 };
    return {
      day: dayNames[day],
      dayZh: dayLabelsZh[day],
      pnl: Math.round(v.pnl),
      trades: v.total,
      winRate: v.total > 0 ? Math.round((v.wins / v.total) * 1000) / 10 : 0,
    };
  });
}

// 计算最大连续赢/亏
export function calcStreaks(trades: Trade[]) {
  const closed = trades
    .filter((t) => t.status === "closed" && t.closeDate)
    .sort((a, b) => {
      const dateDiff = new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime();
      return dateDiff || a.id.localeCompare(b.id);
    });

  if (closed.length === 0) return { currentStreak: 0, maxWinStreak: 0, maxLossStreak: 0 };

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let curWin = 0;
  let curLoss = 0;

  closed.forEach((t) => {
    const net = netPnl(t);
    if (net > 0) {
      curWin++;
      curLoss = 0;
      if (curWin > maxWinStreak) maxWinStreak = curWin;
    } else if (net < 0) {
      curLoss++;
      curWin = 0;
      if (curLoss > maxLossStreak) maxLossStreak = curLoss;
    }
  });

  // 当前连续(最后一笔为准)
  const last = closed[closed.length - 1];
  let currentStreak = 0;
  if (last) {
    const lastNet = netPnl(last);
    const isWin = lastNet > 0;
    if (lastNet !== 0) {
      for (let i = closed.length - 1; i >= 0; i--) {
        const net = netPnl(closed[i]);
        if (isWin && net > 0) currentStreak++;
        else if (!isWin && net < 0) currentStreak--;
        else break;
      }
    }
  }

  return { currentStreak, maxWinStreak, maxLossStreak };
}

/**
 * 计算最大回撤（基于已实现净盈亏权益曲线）。
 * 返回值沿用原 UI 约定：金额和百分比均为负数或 0。
 */
export function calcMaxDrawdown(trades: Trade[], startingBalance = 0) {
  const closed = trades
    .filter((t) => t.status === "closed" && t.closeDate)
    .sort((a, b) => {
      const dateDiff = new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime();
      return dateDiff || a.id.localeCompare(b.id);
    });

  if (closed.length === 0) return { maxDdPercent: 0, maxDdAmount: 0 };

  const initial = Number(startingBalance);
  let peak = Number.isFinite(initial) && initial > 0 ? initial : 0;
  let running = peak;
  let maxDdAmount = 0;
  let maxDdPercent = 0;

  closed.forEach((t) => {
    running += netPnl(t);
    if (running >= peak) {
      peak = running;
      return;
    }

    const ddAmount = running - peak;
    const ddPercent = peak > 0 ? (ddAmount / peak) * 100 : 0;
    if (ddAmount < maxDdAmount) {
      maxDdAmount = ddAmount;
      maxDdPercent = ddPercent;
    }
  });

  return {
    maxDdPercent: Math.round(maxDdPercent * 100) / 100,
    maxDdAmount: Math.round(maxDdAmount * 100) / 100,
  };
}

// 汇总指标(扩展版)
export function calcAnalyticsMetrics(trades: Trade[], startingBalance?: number) {
  const closed = trades.filter((t) => t.status === "closed");

  // 胜负、盈亏、期望值全部按净盈亏判定，避免小盈利被手续费吃掉后仍算胜单。
  const wins = closed.filter((t) => netPnl(t) > 0);
  const losses = closed.filter((t) => netPnl(t) < 0);

  const grossProfit = wins.reduce((s, t) => s + netPnl(t), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + netPnl(t), 0));
  const totalFee = closed.reduce((s, t) => s + Math.abs(Number(t.fee || 0)), 0);
  const totalNetPnl = closed.reduce((s, t) => s + netPnl(t), 0);

  const totalTrades = closed.length;
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const avgWinLoss = avgLoss > 0 ? avgWin / avgLoss : 0;
  // 期望值 = (胜率 × 平均盈利) - (败率 × 平均亏损)
  const expectancy = totalTrades > 0
    ? (wins.length / totalTrades) * avgWin - (losses.length / totalTrades) * avgLoss
    : 0;

  const netPnls = closed.map(netPnl);
  const bestTrade = netPnls.length > 0 ? Math.max(...netPnls) : 0;
  const worstTrade = netPnls.length > 0 ? Math.min(...netPnls) : 0;

  const streaks = calcStreaks(trades);
  const drawdown = calcMaxDrawdown(trades, resolveStartingBalance(trades, startingBalance));

  return {
    totalTrades,
    winRate: Math.round(winRate * 10) / 10,
    profitFactor: profitFactor === Infinity ? 0 : Math.round(profitFactor * 100) / 100,
    avgWinLoss: Math.round(avgWinLoss * 100) / 100,
    netPnl: Math.round(totalNetPnl),
    totalFee: Math.round(totalFee),
    avgWin: Math.round(avgWin),
    avgLoss: Math.round(avgLoss),
    expectancy: Math.round(expectancy * 100) / 100,
    bestTrade: Math.round(bestTrade),
    worstTrade: Math.round(worstTrade),
    maxWinStreak: streaks.maxWinStreak,
    maxLossStreak: streaks.maxLossStreak,
    currentStreak: streaks.currentStreak,
    maxDrawdownPercent: drawdown.maxDdPercent,
    maxDrawdownAmount: drawdown.maxDdAmount,
  };
}
