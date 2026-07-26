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
  underwaterPct: number; // 平仓节点处于水下的占比
}

const netPnl = (trade: Trade): number =>
  Number(trade.pnl || 0) - Math.abs(Number(trade.fee || 0));

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * 按平仓日期排序构建已实现权益曲线，再计算水下曲线。
 *
 * 口径：
 * - account.balance 是账户起始余额，与 tradeMetrics 的账户权益口径一致。
 * - 权益变化使用净盈亏（pnl - |fee|）。
 * - 权益回到峰值即视为恢复，不要求必须创出更高峰。
 * - 只考虑已平仓交易，不假装能从交易日志还原盘中浮亏。
 */
export function buildUnderwaterCurve(
  trades: Trade[],
  account: Account
): { points: UnderwaterPoint[]; periods: DrawdownPeriod[]; stats: DrawdownStats } {
  const closed = trades
    .filter((t) => t.status === "closed" && t.account === account.id && t.closeDate)
    .slice()
    .sort((a, b) => {
      const dateDiff = new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime();
      return dateDiff || a.id.localeCompare(b.id);
    });

  const initialBalance = Number(account.balance);
  const startEquity = Number.isFinite(initialBalance) && initialBalance > 0
    ? initialBalance
    : 0;

  const points: UnderwaterPoint[] = [];
  const periods: DrawdownPeriod[] = [];

  let runningEquity = startEquity;
  let peak = startEquity;
  let peakDate = closed[0]?.closeDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  let ddStartDate: string | null = null;
  let ddPeakEquity = peak;
  let ddTrough = peak;
  let ddTroughPct = 0;

  for (const trade of closed) {
    runningEquity += netPnl(trade);
    const date = trade.closeDate.slice(0, 10);

    if (runningEquity >= peak) {
      // 回到旧峰值就已恢复；若更高，再把 running peak 抬高。
      if (ddStartDate) {
        periods.push({
          startDate: ddStartDate,
          endDate: date,
          depthPct: round2(ddTroughPct),
          durationDays: daysBetween(ddStartDate, date),
          recovered: true,
          peakEquity: ddPeakEquity,
          troughEquity: ddTrough,
        });
        ddStartDate = null;
        ddTroughPct = 0;
      }
      peak = Math.max(peak, runningEquity);
      peakDate = date;
      ddPeakEquity = peak;
      ddTrough = runningEquity;
    } else if (peak > 0) {
      const dd = ((peak - runningEquity) / peak) * 100;
      if (!ddStartDate) {
        ddStartDate = peakDate;
        ddPeakEquity = peak;
        ddTrough = runningEquity;
        ddTroughPct = dd;
      } else if (dd > ddTroughPct) {
        ddTroughPct = dd;
        ddTrough = runningEquity;
      }
    }

    const drawdownPct = peak > 0
      ? -Math.max(0, ((peak - runningEquity) / peak) * 100)
      : 0;

    points.push({
      date,
      drawdownPct: round2(drawdownPct),
      equity: round2(runningEquity),
      peak: round2(peak),
    });
  }

  // 当前可能仍在水下
  if (ddStartDate) {
    const today = new Date().toISOString().slice(0, 10);
    periods.push({
      startDate: ddStartDate,
      endDate: today,
      depthPct: round2(ddTroughPct),
      durationDays: daysBetween(ddStartDate, today),
      recovered: false,
      peakEquity: round2(ddPeakEquity),
      troughEquity: round2(ddTrough),
    });
  }

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
  const underwaterPoints = points.filter((p) => p.drawdownPct < 0).length;
  const underwaterPct = points.length > 0 ? (underwaterPoints / points.length) * 100 : 0;

  return {
    points,
    periods,
    stats: {
      maxDrawdownPct: round2(maxDD),
      maxDrawdownAmount: round2(maxDDAmount),
      currentDrawdownPct: round2(currentDD),
      longestDrawdownDays: longestDD,
      avgRecoveryDays: Math.round(avgRecovery * 10) / 10,
      drawdownCount: periods.length,
      underwaterPct: Math.round(underwaterPct * 10) / 10,
    },
  };
}

function daysBetween(a: string, b: string): number {
  // 日期按 UTC 日历日计算，避免不同时区/DST 造成差一天。
  const [ay, am, ad] = a.slice(0, 10).split("-").map(Number);
  const [by, bm, bd] = b.slice(0, 10).split("-").map(Number);
  if (![ay, am, ad, by, bm, bd].every(Number.isFinite)) return 0;
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.max(0, Math.round((db - da) / 86_400_000));
}

/** 根据回撤深度自动判定严重度 */
export function classifyDrawdown(depthPct: number): "minor" | "moderate" | "severe" {
  if (depthPct >= 10) return "severe";
  if (depthPct >= 5) return "moderate";
  return "minor";
}
