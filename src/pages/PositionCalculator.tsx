import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import { useTradeStore } from "@/store/useTradeStore";
import { instrumentCategories, getInstrument } from "@/data/instruments";
import type { Direction, PositionCalcRecord } from "@/types";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Save,
  Trash2,
  ArrowRight,
  Info,
} from "lucide-react";

export default function PositionCalculator() {
  const language = useSettings((s) => s.language);
  const accounts = useTradeStore((s) => s.accounts);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const positionCalcHistory = useSettings((s) => s.positionCalcHistory);
  const addPositionCalcRecord = useSettings((s) => s.addPositionCalcRecord);
  const deletePositionCalcRecord = useSettings((s) => s.deletePositionCalcRecord);

  const isZh = language === "zh";

  // 获取当前账户余额
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
  const defaultBalance = activeAccount?.balance ?? 10000;

  const [symbol, setSymbol] = useState("EUR/USD");
  const [direction, setDirection] = useState<Direction>("long");
  const [accountBalance, setAccountBalance] = useState(defaultBalance);
  const [riskPercent, setRiskPercent] = useState(1);
  const [entryPrice, setEntryPrice] = useState(0);
  const [stopLossPrice, setStopLossPrice] = useState(0);

  // 计算结果
  const calc = useMemo(() => {
    if (!entryPrice || !stopLossPrice || !accountBalance || !riskPercent) return null;

    const inst = getInstrument(symbol);
    if (!inst) return null;

    const pipSize = inst.pipSize;
    const riskAmount = accountBalance * (riskPercent / 100);

    // 止损距离(点数)
    const priceDiff = Math.abs(entryPrice - stopLossPrice);
    const stopDistancePips = priceDiff / pipSize;

    if (stopDistancePips === 0) return null;

    // 仓位计算逻辑:
    // 标准手 1 lot = 100,000 单位
    // 点值: 对于 XXX/USD 类, 1 pip = $10 per lot
    // 对于 USD/JPY, 1 pip ≈ $9.13 per lot (近似,以 100,000 单位算)
    // 简化: 用通用公式
    // 仓位(lots) = 风险金额 / (止损点数 × 每点每手价值)
    //
    // 每点每手价值(以 USD 计):
    // - XXX/USD (非 USD/JPY): $10
    // - USD/JPY: 1000 / entryPrice (近似)
    // - XAU/USD: 1 pip = 0.01, 1 lot = 100 oz, 所以每 pip = $1
    // - 指数: 近似按 $1 per pip per lot
    let pipValuePerLot = 10; // 默认 XXX/USD

    if (symbol === "USD/JPY") {
      pipValuePerLot = 1000 / entryPrice; // JPY 报价
    } else if (symbol === "XAU/USD") {
      pipValuePerLot = 1; // 1 pip = 0.01, 1 lot = 100oz → $1 per pip
    } else if (symbol === "XAG/USD") {
      pipValuePerLot = 5; // 1 pip = 0.001, 1 lot = 5000oz → $5 per pip
    } else if (symbol === "Copper") {
      pipValuePerLot = 2.5; // 近似
    } else if (symbol === "US500" || symbol === "US30") {
      pipValuePerLot = 1; // 指数 1 pip = 0.1, 1 lot = $1 per pip
    }

    const positionSize = riskAmount / (stopDistancePips * pipValuePerLot);
    const units = positionSize * 100000;

    return {
      riskAmount,
      stopDistancePips,
      pipValuePerLot,
      positionSize,
      units,
    };
  }, [symbol, entryPrice, stopLossPrice, accountBalance, riskPercent]);

  const inst = getInstrument(symbol);
  const priceStep = inst?.pipSize ?? 0.0001;
  const decimals = priceStep < 0.01 ? 5 : priceStep < 1 ? 3 : 2;

  function handleSave() {
    if (!calc) return;
    const record: PositionCalcRecord = {
      id: `pc-${Date.now()}`,
      timestamp: new Date().toISOString(),
      accountId: activeAccount?.id ?? "",
      symbol,
      accountBalance,
      riskPercent,
      entryPrice,
      stopLossPrice,
      direction,
      riskAmount: calc.riskAmount,
      stopDistancePips: calc.stopDistancePips,
      positionSize: calc.positionSize,
      units: calc.units,
    };
    addPositionCalcRecord(record);
  }

  const inputClass = "w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors";
  const labelClass = "mb-1 block text-xs font-medium text-text-secondary";

  return (
    <Layout title={isZh ? "仓位计算器" : "Position Calculator"}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {/* 顶部说明 */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-surface px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-semibold text-text">
              {isZh ? "仓位计算器" : "Position Size Calculator"}
            </h1>
            <p className="text-xs text-text-secondary">
              {isZh
                ? "根据账户余额、风险比例和止损距离,自动计算合适的仓位大小。"
                : "Calculate the right position size based on account balance, risk %, and stop loss distance."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 输入区 */}
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg-surface px-5 py-4 shadow-sm">
            {/* 品种 + 方向 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{isZh ? "品种" : "Symbol"}</label>
                <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputClass}>
                  {instrumentCategories.map((cat) => (
                    <optgroup key={cat.key} label={isZh ? cat.labelZh : cat.label}>
                      {cat.instruments.map((inst) => (
                        <option key={inst.symbol} value={inst.symbol}>
                          {isZh ? inst.labelZh : inst.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{isZh ? "方向" : "Direction"}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection("long")}
                    className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-all ${
                      direction === "long"
                        ? "border-profit/50 bg-profit/10 text-profit"
                        : "border-border bg-bg-elevated text-text-muted hover:border-text-muted hover:text-text"
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    {isZh ? "做多" : "Long"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("short")}
                    className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-all ${
                      direction === "short"
                        ? "border-loss/50 bg-loss/10 text-loss"
                        : "border-border bg-bg-elevated text-text-muted hover:border-text-muted hover:text-text"
                    }`}
                  >
                    <TrendingDown className="h-3.5 w-3.5" />
                    {isZh ? "做空" : "Short"}
                  </button>
                </div>
              </div>
            </div>

            {/* 账户余额 */}
            <div>
              <label className={labelClass}>
                {isZh ? "账户余额" : "Account Balance"} (USD)
                {activeAccount && (
                  <span className="ml-2 text-text-muted">
                    ({isZh ? "当前" : "active"}: ${activeAccount.balance?.toLocaleString() ?? "—"})
                  </span>
                )}
              </label>
              <input
                type="number"
                step="100"
                value={accountBalance || ""}
                onChange={(e) => setAccountBalance(parseFloat(e.target.value) || 0)}
                placeholder="10000"
                className={inputClass}
              />
            </div>

            {/* 风险比例 */}
            <div>
              <label className={labelClass}>
                {isZh ? "风险比例" : "Risk %"}: <span className="font-semibold text-primary">{riskPercent}%</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={riskPercent}
                onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="mt-1 flex justify-between text-[10px] text-text-muted">
                <span>0.1%</span>
                <span>1%</span>
                <span>2%</span>
                <span>3%</span>
                <span>5%</span>
              </div>
            </div>

            {/* 入场价 + 止损价 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {isZh ? "入场价" : "Entry Price"}
                  <span className="ml-1 text-text-muted">({symbol})</span>
                </label>
                <input
                  type="number"
                  step={priceStep}
                  value={entryPrice || ""}
                  onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                  placeholder={decimals === 5 ? "1.08500" : "1950.00"}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {isZh ? "止损价" : "Stop Loss Price"}
                  <span className="ml-1 text-text-muted">({symbol})</span>
                </label>
                <input
                  type="number"
                  step={priceStep}
                  value={stopLossPrice || ""}
                  onChange={(e) => setStopLossPrice(parseFloat(e.target.value) || 0)}
                  placeholder={decimals === 5 ? "1.08300" : "1940.00"}
                  className={inputClass}
                />
              </div>
            </div>

            {/* 提示 */}
            {entryPrice > 0 && stopLossPrice > 0 && direction === "long" && stopLossPrice >= entryPrice && (
              <div className="flex items-center gap-1.5 rounded-md bg-loss/5 px-3 py-1.5 text-xs text-loss">
                <Info className="h-3 w-3 shrink-0" />
                {isZh ? "做多时,止损价应低于入场价" : "For long positions, stop loss should be below entry"}
              </div>
            )}
            {entryPrice > 0 && stopLossPrice > 0 && direction === "short" && stopLossPrice <= entryPrice && (
              <div className="flex items-center gap-1.5 rounded-md bg-loss/5 px-3 py-1.5 text-xs text-loss">
                <Info className="h-3 w-3 shrink-0" />
                {isZh ? "做空时,止损价应高于入场价" : "For short positions, stop loss should be above entry"}
              </div>
            )}
          </div>

          {/* 结果区 */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-surface px-5 py-4 shadow-sm">
            <h2 className="font-display text-sm font-semibold text-text">
              {isZh ? "计算结果" : "Calculation Result"}
            </h2>

            {calc ? (
              <>
                {/* 风险金额 */}
                <ResultCard
                  label={isZh ? "风险金额" : "Risk Amount"}
                  value={`$${calc.riskAmount.toFixed(2)}`}
                  hint={`${riskPercent}% × $${accountBalance.toLocaleString()}`}
                  color="text-loss"
                />

                {/* 止损距离 */}
                <ResultCard
                  label={isZh ? "止损距离" : "Stop Distance"}
                  value={`${calc.stopDistancePips.toFixed(1)} ${isZh ? "点" : "pips"}`}
                  hint={`|${entryPrice} - ${stopLossPrice}| ÷ ${inst?.pipSize}`}
                />

                {/* 仓位大小 - 核心结果 */}
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3">
                  <div className="text-xs font-medium text-text-secondary">
                    {isZh ? "建议仓位" : "Recommended Position Size"}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-display text-2xl font-bold text-primary">
                      {calc.positionSize.toFixed(2)}
                    </span>
                    <span className="text-sm text-text-secondary">{isZh ? "手" : "lots"}</span>
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    = {calc.units.toLocaleString(undefined, { maximumFractionDigits: 0 })} {isZh ? "单位" : "units"}
                  </div>
                </div>

                {/* 每点价值 */}
                <ResultCard
                  label={isZh ? "每点价值(每手)" : "Pip Value (per lot)"}
                  value={`$${calc.pipValuePerLot.toFixed(2)}`}
                  hint={symbol}
                />

                {/* 保存按钮 */}
                <button
                  type="button"
                  onClick={handleSave}
                  className="mt-1 flex items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  <Save className="h-4 w-4" />
                  {isZh ? "保存计算结果" : "Save Calculation"}
                </button>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center py-8 text-center">
                <div>
                  <Calculator className="mx-auto mb-2 h-8 w-8 text-text-muted/50" />
                  <p className="text-sm text-text-muted">
                    {isZh
                      ? "填写左侧表单,自动计算仓位大小"
                      : "Fill in the form to calculate position size"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 历史记录 */}
        {positionCalcHistory.length > 0 && (
          <div className="rounded-lg border border-border bg-bg-surface px-5 py-4 shadow-sm">
            <h2 className="mb-3 font-display text-sm font-semibold text-text">
              {isZh ? "计算历史" : "History"}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-elevated">
                  <tr className="text-left text-text-secondary">
                    <th className="px-2 py-1.5 font-medium">{isZh ? "时间" : "Time"}</th>
                    <th className="px-2 py-1.5 font-medium">{isZh ? "品种" : "Symbol"}</th>
                    <th className="px-2 py-1.5 font-medium">{isZh ? "方向" : "Dir"}</th>
                    <th className="px-2 py-1.5 font-medium">{isZh ? "余额" : "Balance"}</th>
                    <th className="px-2 py-1.5 font-medium">{isZh ? "风险" : "Risk"}</th>
                    <th className="px-2 py-1.5 font-medium">{isZh ? "入场" : "Entry"}</th>
                    <th className="px-2 py-1.5 font-medium">{isZh ? "止损" : "Stop"}</th>
                    <th className="px-2 py-1.5 font-medium">{isZh ? "点数" : "Pips"}</th>
                    <th className="px-2 py-1.5 font-medium">{isZh ? "仓位(手)" : "Lots"}</th>
                    <th className="px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {positionCalcHistory.slice(0, 15).map((r) => (
                    <tr key={r.id} className="border-t border-border/50 text-text-secondary hover:bg-bg-elevated/40">
                      <td className="px-2 py-1.5 font-mono text-text-muted">
                        {new Date(r.timestamp).toLocaleDateString(isZh ? "zh-CN" : "en-US", { month: "2-digit", day: "2-digit" })}
                      </td>
                      <td className="px-2 py-1.5 font-medium text-text">{r.symbol}</td>
                      <td className="px-2 py-1.5">
                        {r.direction === "long" ? (
                          <span className="text-profit">↑</span>
                        ) : (
                          <span className="text-loss">↓</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">${r.accountBalance.toLocaleString()}</td>
                      <td className="px-2 py-1.5">${r.riskAmount.toFixed(2)}</td>
                      <td className="px-2 py-1.5 font-mono">{r.entryPrice}</td>
                      <td className="px-2 py-1.5 font-mono">{r.stopLossPrice}</td>
                      <td className="px-2 py-1.5">{r.stopDistancePips.toFixed(1)}</td>
                      <td className="px-2 py-1.5 font-semibold text-primary">{r.positionSize.toFixed(2)}</td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => deletePositionCalcRecord(r.id)}
                          className="text-text-muted transition-colors hover:text-loss"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 说明 */}
        <div className="rounded-lg border border-dashed border-border bg-bg-elevated/30 px-4 py-3 text-xs text-text-muted">
          <div className="mb-1 flex items-center gap-1 font-medium text-text-secondary">
            <Info className="h-3 w-3" />
            {isZh ? "计算公式说明" : "Formula"}
          </div>
          <div className="space-y-0.5 leading-relaxed">
            <div>{isZh ? "1. 风险金额 = 账户余额 × 风险比例" : "1. Risk Amount = Balance × Risk %"}</div>
            <div>{isZh ? "2. 止损点数 = |入场价 - 止损价| ÷ 点值大小" : "2. Stop Pips = |Entry - Stop| ÷ Pip Size"}</div>
            <div>{isZh ? "3. 仓位(手) = 风险金额 ÷ (止损点数 × 每点每手价值)" : "3. Lots = Risk Amount ÷ (Stop Pips × Pip Value/Lot)"}</div>
            <div className="mt-1 text-text-muted/80">
              {isZh
                ? "注: 点值根据品种类型自动调整(XXX/USD=$10, USD/JPY≈1000/价格, 黄金=$1, 白银=$5)。结果仅供参考,请以经纪商实际点值为准。"
                : "Note: Pip value varies by symbol (XXX/USD=$10, USD/JPY≈1000/price, Gold=$1, Silver=$5). Results are estimates; verify with your broker."}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ResultCard({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated/40 px-3 py-2">
      <div className="text-xs font-medium text-text-secondary">{label}</div>
      <div className={`mt-0.5 font-display text-base font-semibold ${color ?? "text-text"}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-text-muted">{hint}</div>}
    </div>
  );
}
