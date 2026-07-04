// 回撤（Drawdown）计算工具
// 输入交易记录 + 当前账户，输出水下权益曲线、回撤事件、统计指标

import type { Trade, Account } from "@/types";

export interface UnderwaterPoint {
  date: string; // YYYY-MM-DD
  drawdownPct: number; // 负数或 0（如 -8.5 表示 8.5% 回撤）
  equity: number;
  peak: number;
}

export interface DrawdownPeriod {
  startDate: string;
  endDate: string; // 恢复日期或当前日期（未恢复）
  depthPct: number; // 正数，最大回撤深度
  durationDays: number;
  recovered: boolean;
  peakEquity: number;
  troughEquity: number;
}

export interface DrawdownStats {
  maxDrawdownPct: number;
  maxDrawdownAmount: number;
  currentDrawdownPct: number;
  longestDrawdownDays: number;
  avgRecoveryDays: number; // 已恢复的回撤平均恢复天数
  drawdownCount: number; // 总回撤次数
  underwaterPct: number; // 当前账户在水下的时间占比
}

/**
 * 按平仓日期排序构建权益曲线，再算水下曲线（running peak - current）
 * 注意：只考虑平仓交易（status="closed"）
 */
export function buildUnderwaterCurve(
  trades: Trade[],
  account: Account
): { points: UnderwaterPoint[]; periods: DrawdownPeriod[]; stats: DrawdownStats } {
  const closed = trades
    .filter((t) => t.status === "closed" && t.account === account.id)
    .slice()
    .sort((a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime());

  // 起点权益 = 账户当前余额 - 累计净盈亏（推算初始权益）
  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  let startEquity = account.balance - totalPnl;
  if (startEquity <= 0) startEquity = account.balance; // 兜底

  const points: UnderwaterPoint[] = [];
  const periods: DrawdownPeriod[] = [];

  let runningEquity = startEquity;
  let peak = startEquity;
  let peakDate = closed[0]?.closeDate ?? new Date().toISOString().slice(0, 10);
  let ddStartDate: string | null = null;
  let ddTrough = peak;
  let ddTroughPct = 0;

  for (const t of closed) {
    runningEquity += t.pnl ?? 0;
    const date = t.closeDate.slice(0, 10);
    if (runningEquity > peak) {
      // 新高：若在水下状态，结算当前回撤
      if (ddStartDate) {
        const endDate = date;
        const durationDays = daysBetween(ddStartDate, endDate);
        periods.push({
          startDate: ddStartDate,
          endDate,
          depthPct: Math.round(ddTroughPct * 100) / 100,
          durationDays,
          recovered: true,
          peakEquity: peak,
          troughEquity: ddTrough,
        });
        ddStartDate = null;
        ddTrough = runningEquity;
        ddTroughPct = 0;
      }
      peak = runningEquity;
      peakDate = date;
    } else {
      // 在水下
      const dd = ((peak - runningEquity) / peak) * 100;
      if (!ddStartDate) {
        ddStartDate = peakDate;
        ddTrough = runningEquity;
        ddTroughPct = dd;
      } else {
        if (dd > ddTroughPct) {
          ddTroughPct = dd;
          ddTrough = runningEquity;
        }
      }
    }
    points.push({
      date,
      drawdownPct: -(((peak - runningEquity) / peak) * 100),
      equity: runningEquity,
      peak,
    });
  }

  // 当前可能还在水下
  if (ddStartDate) {
    const today = new Date().toISOString().slice(0, 10);
    const durationDays = daysBetween(ddStartDate, today);
    periods.push({
      startDate: ddStartDate,
      endDate: today,
      depthPct: Math.round(ddTroughPct * 100) / 100,
      durationDays,
      recovered: false,
      peakEquity: peak,
      troughEquity: ddTrough,
    });
  }

  // 统计
  const maxDD = periods.length > 0 ? Math.max(...periods.map((p) => p.depthPct)) : 0;
  const maxDDAmount = periods.length > 0
    ? Math.max(...periods.map((p) => p.peakEquity - p.troughEquity))
    : 0;
  const currentDD = points.length > 0 ? Math.abs(points[points.length - 1].drawdownPct) : 0;
  const longestDD = periods.length > 0 ? Math.max(...periods.map((p) => p.durationDays)) : 0;
  const recoveredPeriods = periods.filter((p) => p.recovered);
  const avgRecovery = recoveredPeriods.length > 0
    ? recoveredPeriods.reduce((s, p) => s + p.durationDays, 0) / recoveredPeriods.length
    : 0;
  const totalTradingDays = points.length > 0
    ? daysBetween(points[0].date, points[points.length - 1].date)
    : 0;
  const underwaterDays = points.filter((p) => p.drawdownPct < 0).length;
  const underwaterPct = points.length > 0 ? (underwaterDays / points.length) * 100 : 0;

  return {
    points,
    periods,
    stats: {
      maxDrawdownPct: Math.round(maxDD * 100) / 100,
      maxDrawdownAmount: Math.round(maxDDAmount * 100) / 100,
      currentDrawdownPct: Math.round(currentDD * 100) / 100,
      longestDrawdownDays: longestDD,
      avgRecoveryDays: Math.round(avgRecovery * 10) / 10,
      drawdownCount: periods.length,
      underwaterPct: Math.round(underwaterPct * 10) / 10,
    },
  };
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.max(0, Math.round((db - da) / (1000 * 60 * 60 * 24)));
}

/** 根据回撤深度自动判定严重度 */
export function classifyDrawdown(depthPct: number): "minor" | "moderate" | "severe" {
  if (depthPct >= 10) return "severe";
  if (depthPct >= 5) return "moderate";
  return "minor";
}