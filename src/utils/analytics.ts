import type { Trade } from "@/types";

// 从实际交易数据计算分析指标

// 月度盈亏 + 胜率趋势
export function calcMonthlyPerformance(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed" && t.closeDate);
  if (closed.length === 0) return [];

  const byMonth: Record<string, { pnl: number; wins: number; total: number }> = {};

  closed.forEach((t) => {
    const d = new Date(t.closeDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { pnl: 0, wins: 0, total: 0 };
    byMonth[key].pnl += t.pnl;
    byMonth[key].total += 1;
    if (t.pnl > 0) byMonth[key].wins += 1;
  });

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, v]) => {
      const [y, m] = key.split("-");
      const date = new Date(Number(y), Number(m) - 1);
      return {
        month: date.toLocaleDateString("en-US", { month: "short" }),
        pnl: Math.round(v.pnl),
        winRate: v.total > 0 ? Math.round((v.wins / v.total) * 1000) / 10 : 0,
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
    const b = buckets.find((b) => t.pnl >= b.min && t.pnl < b.max);
    if (b) {
      b.count += 1;
      b.pnl += t.pnl;
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
    bySymbol[t.symbol].trades += 1;
    bySymbol[t.symbol].pnl += t.pnl;
    if (t.pnl > 0) bySymbol[t.symbol].wins += 1;
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

// 汇总指标
export function calcAnalyticsMetrics(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed");

  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl < 0);

  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

  const totalTrades = closed.length;
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const avgWinLoss = avgLoss > 0 ? avgWin / avgLoss : 0;

  return {
    totalTrades,
    winRate: Math.round(winRate * 10) / 10,
    profitFactor: profitFactor === Infinity ? 0 : Math.round(profitFactor * 100) / 100,
    avgWinLoss: Math.round(avgWinLoss * 100) / 100,
  };
}
