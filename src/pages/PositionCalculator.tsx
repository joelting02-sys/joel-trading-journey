import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import { useTradeStore } from "@/store/useTradeStore";
import { getInstrument } from "@/data/instruments";
import SymbolPicker from "@/components/SymbolPicker";
import type { Direction, PositionCalcRecord } from "@/types";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Save,
  Trash2,
  Info,
  Target,
  Shield,
  Scale,
  Zap,
} from "lucide-react";

export default function PositionCalculator() {
  const language = useSettings((s) => s.language);
  const accounts = useTradeStore((s) => s.accounts);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const positionCalcHistory = useSettings((s) => s.positionCalcHistory);
  const addPositionCalcRecord = useSettings((s) => s.addPositionCalcRecord);
  const deletePositionCalcRecord = useSettings((s) => s.deletePositionCalcRecord);

  const isZh = language === "zh";

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
  const defaultBalance = activeAccount?.balance ?? 10000;

  const [symbol, setSymbol] = useState("EUR/USD");
  const [direction, setDirection] = useState<Direction>("long");
  const [accountBalance, setAccountBalance] = useState(defaultBalance);
  const [riskPercent, setRiskPercent] = useState(1);
  const [entryPrice, setEntryPrice] = useState(0);
  const [stopLossPrice, setStopLossPrice] = useState(0);
  const [takeProfitPrice, setTakeProfitPrice] = useState(0);

  // 计算结果
  const calc = useMemo(() => {
    if (!entryPrice || !stopLossPrice || !accountBalance || !riskPercent) return null;

    const inst = getInstrument(symbol);
    if (!inst) return null;

    const pipSize = inst.pipSize;
    const riskAmount = accountBalance * (riskPercent / 100);

    const priceDiff = Math.abs(entryPrice - stopLossPrice);
    const stopDistancePips = priceDiff / pipSize;

    if (stopDistancePips === 0) return null;

    let pipValuePerLot = 10;

    if (symbol === "USD/JPY") {
      pipValuePerLot = 1000 / entryPrice;
    } else if (symbol === "XAU/USD") {
      pipValuePerLot = 1;
    } else if (symbol === "XAG/USD") {
      pipValuePerLot = 5;
    } else if (symbol === "Copper") {
      pipValuePerLot = 2.5;
    } else if (symbol === "US500" || symbol === "US30") {
      pipValuePerLot = 1;
    }

    const positionSize = riskAmount / (stopDistancePips * pipValuePerLot);
    const units = positionSize * 100000;

    // R 倍数和盈亏比计算
    let rrRatio = 0;
    let tpDistancePips = 0;
    if (takeProfitPrice > 0) {
      const tpDiff = Math.abs(takeProfitPrice - entryPrice);
      tpDistancePips = tpDiff / pipSize;
      if (stopDistancePips > 0) {
        rrRatio = tpDistancePips / stopDistancePips;
      }
    }

    return {
      riskAmount,
      stopDistancePips,
      pipValuePerLot,
      positionSize,
      units,
      tpDistancePips,
      rrRatio,
    };
  }, [symbol, entryPrice, stopLossPrice, accountBalance, riskPercent, takeProfitPrice]);

  const inst = getInstrument(symbol);
  const priceStep = inst?.pipSize ?? 0.0001;
  const decimals = priceStep < 0.01 ? 5 : priceStep < 1 ? 3 : 2;

  // 滑块百分比进度条计算
  const sliderPercent = ((riskPercent - 0.1) / (20 - 0.1)) * 100;

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

  const inputClass = "w-full rounded-lg border border-border bg-bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all";
  const labelClass = "mb-1.5 block text-xs font-medium text-text-secondary";

  return (
    <Layout title={isZh ? "仓位计算器" : "Position Calculator"}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {/* 顶部说明 */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-gradient-to-r from-bg-surface to-bg-surface/50 px-5 py-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-semibold text-text">
              {isZh ? "仓位计算器" : "Position Size Calculator"}
            </h1>
            <p className="text-xs text-text-secondary">
              {isZh
                ? "根据账户余额（Balance）、风险比例（Risk %）和止损（SL）距离，自动计算合适的仓位大小。"
                : "Calculate the right position size based on account balance, risk %, and stop loss distance."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 输入区 */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-bg-surface px-5 py-5 shadow-sm">
            {/* 品种 + 方向 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{isZh ? "品种" : "Symbol"}</label>
                <SymbolPicker value={symbol} onChange={setSymbol} language={language} />
              </div>
              <div>
                <label className={labelClass}>{isZh ? "方向" : "Direction"}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection("long")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                      direction === "long"
                        ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-bg-elevated text-text-muted hover:border-text-muted hover:text-text"
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    {isZh ? "做多（Long）" : "Long"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("short")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                      direction === "short"
                        ? "border-loss/50 bg-loss/10 text-loss shadow-sm"
                        : "border-border bg-bg-elevated text-text-muted hover:border-text-muted hover:text-text"
                    }`}
                  >
                    <TrendingDown className="h-3.5 w-3.5" />
                    {isZh ? "做空（Short）" : "Short"}
                  </button>
                </div>
              </div>
            </div>

            {/* 账户余额 */}
            <div>
              <label className={labelClass}>
                {isZh ? "账户余额（Balance）" : "Account Balance"} (USD)
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

            {/* 风险比例 — 自定义滑块 */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className={labelClass + " mb-0"}>
                  {isZh ? "风险比例（Risk %）" : "Risk %"}
                </label>
                <span className="rounded-md bg-primary/10 px-2.5 py-0.5 font-display text-sm font-bold text-primary tabular-nums">
                  {riskPercent.toFixed(1)}%
                </span>
              </div>
              <div className="relative pt-1">
                {/* 自定义进度条背景 */}
                <div className="mb-1 h-2 w-full rounded-full bg-bg-elevated">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-150"
                    style={{ width: `${sliderPercent}%` }}
                  />
                </div>
                {/* 原生 range 滑块（透明，叠在进度条上） */}
                <input
                  type="range"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                  className="absolute inset-x-0 top-0 h-4 w-full cursor-pointer appearance-none bg-transparent
                    [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary
                    [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-white
                    [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
                  style={{ marginTop: "-4px" }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                <span>0.1%</span>
                <span>5%</span>
                <span>10%</span>
                <span>15%</span>
                <span>20%</span>
              </div>
            </div>

            {/* 入场价 + 止损价 + 止盈价 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {isZh ? "入场价（Entry）" : "Entry Price"}
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
                  {isZh ? "止损价（SL）" : "Stop Loss (SL)"}
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
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  {isZh ? "止盈价（TP）" : "Take Profit (TP)"}
                  <span className="ml-1 text-text-muted">
                    ({symbol}) · {isZh ? "可选" : "optional"}
                  </span>
                </label>
                <input
                  type="number"
                  step={priceStep}
                  value={takeProfitPrice || ""}
                  onChange={(e) => setTakeProfitPrice(parseFloat(e.target.value) || 0)}
                  placeholder={decimals === 5 ? "1.09000" : "1960.00"}
                  className={inputClass}
                />
              </div>
            </div>

            {/* 提示 */}
            {entryPrice > 0 && stopLossPrice > 0 && direction === "long" && stopLossPrice >= entryPrice && (
              <div className="flex items-center gap-1.5 rounded-lg bg-loss/5 px-3 py-2 text-xs text-loss">
                <Info className="h-3 w-3 shrink-0" />
                {isZh ? "做多（Long）时，止损价（SL）应低于入场价（Entry）" : "For Long positions, SL should be below Entry"}
              </div>
            )}
            {entryPrice > 0 && stopLossPrice > 0 && direction === "short" && stopLossPrice <= entryPrice && (
              <div className="flex items-center gap-1.5 rounded-lg bg-loss/5 px-3 py-2 text-xs text-loss">
                <Info className="h-3 w-3 shrink-0" />
                {isZh ? "做空（Short）时，止损价（SL）应高于入场价（Entry）" : "For Short positions, SL should be above Entry"}
              </div>
            )}
          </div>

          {/* 结果区 */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg-surface px-5 py-5 shadow-sm">
            <h2 className="font-display text-sm font-semibold text-text">
              {isZh ? "计算结果（Result）" : "Calculation Result"}
            </h2>

            {calc ? (
              <>
                {/* 风险金额 */}
                <ResultCard
                  icon={<Shield className="h-3.5 w-3.5" />}
                  label={isZh ? "风险金额（Risk Amount）" : "Risk Amount"}
                  value={`$${calc.riskAmount.toFixed(2)}`}
                  hint={`Risk% × Balance = ${riskPercent.toFixed(1)}% × $${accountBalance.toLocaleString()}`}
                  color="text-loss"
                />

                {/* 止损距离 */}
                <ResultCard
                  icon={<Target className="h-3.5 w-3.5" />}
                  label={isZh ? "止损距离（SL Distance）" : "Stop Distance"}
                  value={`${calc.stopDistancePips.toFixed(1)} ${isZh ? "点（Pips）" : "pips"}`}
                  hint={`|Entry − SL| ÷ Pip Size = |${entryPrice} − ${stopLossPrice}| ÷ ${inst?.pipSize}`}
                />

                {/* 止盈距离 + 盈亏比 */}
                {takeProfitPrice > 0 && calc.tpDistancePips > 0 && (
                  <ResultCard
                    icon={<Scale className="h-3.5 w-3.5" />}
                    label={isZh ? "盈亏比（R:R）" : "Risk:Reward Ratio"}
                    value={`1 : ${calc.rrRatio.toFixed(2)}`}
                    hint={`TP 距离 ${calc.tpDistancePips.toFixed(1)} pips ÷ SL 距离 ${calc.stopDistancePips.toFixed(1)} pips`}
                    color={calc.rrRatio >= 2 ? "text-primary" : calc.rrRatio >= 1 ? "text-text" : "text-loss"}
                  />
                )}

                {/* 仓位大小 - 核心结果 */}
                <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/8 to-primary/3 px-4 py-4">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    {isZh ? "建议仓位（Position Size）" : "Recommended Position Size"}
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-primary tabular-nums">
                      {calc.positionSize.toFixed(2)}
                    </span>
                    <span className="text-sm font-medium text-text-secondary">{isZh ? "手（Lots）" : "lots"}</span>
                  </div>
                  <div className="mt-1 text-xs text-text-muted tabular-nums">
                    = {calc.units.toLocaleString(undefined, { maximumFractionDigits: 0 })} {isZh ? "单位（Units）" : "units"}
                  </div>
                </div>

                {/* 每点价值 */}
                <ResultCard
                  icon={<Info className="h-3.5 w-3.5" />}
                  label={isZh ? "每点价值（Pip Value / Lot）" : "Pip Value (per lot)"}
                  value={`$${calc.pipValuePerLot.toFixed(2)}`}
                  hint={symbol}
                />

                {/* 保存按钮 */}
                <button
                  type="button"
                  onClick={handleSave}
                  className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/15 hover:shadow-sm"
                >
                  <Save className="h-4 w-4" />
                  {isZh ? "保存计算结果" : "Save Calculation"}
                </button>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center py-10 text-center">
                <div>
                  <Calculator className="mx-auto mb-3 h-10 w-10 text-text-muted/40" />
                  <p className="text-sm text-text-muted">
                    {isZh
                      ? "填写左侧表单，自动计算仓位大小"
                      : "Fill in the form to calculate position size"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 历史记录 */}
        {positionCalcHistory.length > 0 && (
          <div className="rounded-xl border border-border bg-bg-surface px-5 py-4 shadow-sm">
            <h2 className="mb-3 font-display text-sm font-semibold text-text">
              {isZh ? "计算历史（History）" : "History"}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-elevated">
                  <tr className="text-left text-text-secondary">
                    <th className="px-2.5 py-2 font-medium">{isZh ? "时间" : "Time"}</th>
                    <th className="px-2.5 py-2 font-medium">{isZh ? "品种" : "Symbol"}</th>
                    <th className="px-2.5 py-2 font-medium">{isZh ? "方向" : "Dir"}</th>
                    <th className="px-2.5 py-2 font-medium">{isZh ? "余额" : "Balance"}</th>
                    <th className="px-2.5 py-2 font-medium">{isZh ? "风险" : "Risk"}</th>
                    <th className="px-2.5 py-2 font-medium">{isZh ? "入场" : "Entry"}</th>
                    <th className="px-2.5 py-2 font-medium">{isZh ? "止损" : "SL"}</th>
                    <th className="px-2.5 py-2 font-medium">{isZh ? "点数" : "Pips"}</th>
                    <th className="px-2.5 py-2 font-medium">{isZh ? "仓位（Lots）" : "Lots"}</th>
                    <th className="px-2.5 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {positionCalcHistory.slice(0, 15).map((r) => (
                    <tr key={r.id} className="border-t border-border/50 text-text-secondary transition-colors hover:bg-bg-elevated/40">
                      <td className="px-2.5 py-2 font-mono text-text-muted">
                        {new Date(r.timestamp).toLocaleDateString(isZh ? "zh-CN" : "en-US", { month: "2-digit", day: "2-digit" })}
                      </td>
                      <td className="px-2.5 py-2 font-medium text-text">{r.symbol}</td>
                      <td className="px-2.5 py-2">
                        {r.direction === "long" ? (
                          <span className="text-primary">↑</span>
                        ) : (
                          <span className="text-loss">↓</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 tabular-nums">${r.accountBalance.toLocaleString()}</td>
                      <td className="px-2.5 py-2 tabular-nums">${r.riskAmount.toFixed(2)}</td>
                      <td className="px-2.5 py-2 font-mono">{r.entryPrice}</td>
                      <td className="px-2.5 py-2 font-mono">{r.stopLossPrice}</td>
                      <td className="px-2.5 py-2 tabular-nums">{r.stopDistancePips.toFixed(1)}</td>
                      <td className="px-2.5 py-2 font-semibold text-primary tabular-nums">{r.positionSize.toFixed(2)}</td>
                      <td className="px-2.5 py-2">
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

        {/* 公式说明 */}
        <div className="rounded-xl border border-dashed border-border bg-bg-elevated/30 px-5 py-4 text-xs text-text-muted">
          <div className="mb-2 flex items-center gap-1.5 font-medium text-text-secondary">
            <Info className="h-3.5 w-3.5" />
            {isZh ? "计算公式说明（Formula）" : "Formula"}
          </div>
          <div className="space-y-1.5 leading-relaxed">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">1</span>
              <span>
                {isZh
                  ? "风险金额（Risk Amount）= 账户余额（Balance） × 风险比例（Risk %）"
                  : "Risk Amount = Balance × Risk %"}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">2</span>
              <span>
                {isZh
                  ? "止损点数（SL Pips）= |入场价（Entry） − 止损价（SL）| ÷ 点值大小（Pip Size）"
                  : "SL Pips = |Entry − SL| ÷ Pip Size"}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">3</span>
              <span>
                {isZh
                  ? "仓位手数（Lots）= 风险金额（Risk Amount） ÷ [止损点数（SL Pips） × 每点每手价值（Pip Value / Lot）]"
                  : "Lots = Risk Amount ÷ (SL Pips × Pip Value / Lot)"}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">4</span>
              <span>
                {isZh
                  ? "盈亏比（R:R）= 止盈点数（TP Pips） ÷ 止损点数（SL Pips）"
                  : "R:R = TP Pips ÷ SL Pips"}
              </span>
            </div>
            <div className="mt-2 rounded-md bg-bg-surface/60 px-3 py-2 text-[11px] leading-relaxed text-text-muted/90">
              {isZh
                ? "注：每点每手价值（Pip Value / Lot）根据品种类型自动调整 — XXX/USD = $10、USD/JPY ≈ 1000 ÷ Entry、XAU/USD = $1、XAG/USD = $5。结果仅供参考，请以经纪商（Broker）实际点值为准。"
                : "Note: Pip value varies by symbol — XXX/USD = $10, USD/JPY ≈ 1000/Entry, Gold = $1, Silver = $5. Results are estimates; verify with your broker."}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ResultCard({
  icon,
  label,
  value,
  hint,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated/40 px-3.5 py-2.5 transition-colors hover:bg-bg-elevated/60">
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        {icon}
        {label}
      </div>
      <div className={`mt-1 font-display text-base font-semibold tabular-nums ${color ?? "text-text"}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-text-muted">{hint}</div>}
    </div>
  );
}
