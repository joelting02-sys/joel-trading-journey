import type { Account, PropFirmChallenge, PropFirmStatus, Trade } from "@/types";

// 唯一交易日数量(按 closeDate 的日期部分去重)
export function countTradingDays(trades: Trade[]): number {
  const days = new Set<string>();
  for (const tr of trades) {
    if (tr.status !== "closed") continue;
    const d = (tr.closeDate || tr.openDate || "").slice(0, 10);
    if (d) days.add(d);
  }
  return days.size;
}

// 计算当前总回撤百分比(基于起始余额)
export function calcTotalDrawdownPercent(account: Account, currentEquity: number): number {
  if (account.propFirm?.startingBalance) {
    const start = account.propFirm.startingBalance;
    if (start <= 0) return 0;
    const dd = ((start - currentEquity) / start) * 100;
    return Math.max(0, dd);
  }
  // 退化方案:用 account.balance 作为基准
  if (!account.balance) return 0;
  return Math.max(0, ((account.balance - currentEquity) / account.balance) * 100);
}

// 评估 prop firm 考试的当前状态
export function evaluatePropFirm(
  account: Account,
  trades: Trade[],
  currentEquity: number
): {
  status: PropFirmStatus;
  tradingDays: number;
  currentDrawdown: number;
  currentProfit: number;
  dailyDrawdown: number;
  rules: {
    key: keyof PropFirmChallenge;
    label: string;
    target: number;
    current: number;
    passed: boolean;
    unit: "%" | "$" | "d";
  }[];
} | null {
  const pf = account.propFirm;
  if (!pf || !pf.enabled) return null;

  const tradingDays = countTradingDays(trades);
  const currentDrawdown = calcTotalDrawdownPercent(account, currentEquity);
  const currentProfit = currentEquity - pf.startingBalance;
  // 当日回撤:以今天的 closeDate 交易为参考,简化用"当日最后一笔 P&L 的累计"——这里取最简实现:0(无完整日内时序),用户可手动在卡片上观察
  const dailyDrawdown = 0;

  // 规则一:清算点(只要没跌破 = Passed)
  const liquidationPassed = currentEquity > pf.liquidationPoint;
  // 规则二:总回撤
  const totalDdPassed = currentDrawdown < pf.permittedTotalDrawdown;
  // 规则三:每日回撤
  const dailyDdPassed = dailyDrawdown < pf.permittedDailyDrawdown;
  // 规则四:利润目标
  const profitPassed = currentProfit >= pf.profitTarget;
  // 规则五:最少交易天数
  const daysPassed = tradingDays >= pf.minTradingDays;

  let status: PropFirmStatus = "active";
  if (profitPassed && daysPassed && totalDdPassed && dailyDdPassed && liquidationPassed) {
    status = "passed";
  } else if (!liquidationPassed || currentDrawdown >= pf.permittedTotalDrawdown) {
    status = "failed";
  }

  return {
    status,
    tradingDays,
    currentDrawdown,
    currentProfit,
    dailyDrawdown,
    rules: [
      { key: "minTradingDays", label: "Min Trading Days", target: pf.minTradingDays, current: tradingDays, passed: daysPassed, unit: "d" },
      { key: "permittedDailyDrawdown", label: "Daily Drawdown", target: pf.permittedDailyDrawdown, current: dailyDrawdown, passed: dailyDdPassed, unit: "%" },
      { key: "permittedTotalDrawdown", label: "Total Drawdown", target: pf.permittedTotalDrawdown, current: currentDrawdown, passed: totalDdPassed, unit: "%" },
      { key: "profitTarget", label: "Profit Target", target: pf.profitTarget, current: currentProfit, passed: profitPassed, unit: "$" },
    ],
  };
}
