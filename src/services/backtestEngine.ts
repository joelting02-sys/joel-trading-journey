import type { BacktestCandle, BacktestInput, BacktestOrder, BacktestResult } from "@/types/backtest";

export const BACKTEST_ENGINE_VERSION = "1.0.0";

function round(value: number): number { return Number(value.toFixed(8)); }

function hash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function validate(candles: BacktestCandle[]): void {
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (![c.time, c.open, c.high, c.low, c.close].every(Number.isFinite)) throw new Error(`Invalid candle at index ${i}`);
    if (i > 0 && c.time <= candles[i - 1].time) throw new Error("Candles must be strictly chronological");
    if (c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close)) throw new Error(`Invalid OHLC at index ${i}`);
  }
}

export function runBacktest(input: BacktestInput): BacktestResult {
  if (!Number.isFinite(input.initialEquity) || input.initialEquity <= 0) throw new Error("initialEquity must be positive");
  validate(input.candles);
  const commission = Math.max(0, input.commissionPerUnit ?? 0);
  const slip = Math.max(0, input.slippagePerUnit ?? 0);
  const sizeFor = input.positionSize ?? (() => 1);
  const orders: BacktestOrder[] = [];
  const curve: Array<{ time: number; equity: number }> = [];
  let equity = input.initialEquity;
  let peak = equity;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let position: { direction: "long" | "short"; time: number; price: number; quantity: number } | null = null;

  const mark = (candle: BacktestCandle, unrealized = 0) => {
    const marked = equity + unrealized;
    peak = Math.max(peak, marked);
    const dd = peak - marked;
    maxDrawdown = Math.max(maxDrawdown, dd);
    maxDrawdownPercent = Math.max(maxDrawdownPercent, peak > 0 ? dd / peak * 100 : 0);
    curve.push({ time: candle.time, equity: round(marked) });
  };
  const close = (candle: BacktestCandle) => {
    if (!position) return;
    const exitPrice = position.direction === "long" ? candle.close - slip : candle.close + slip;
    const grossPnl = position.direction === "long" ? (exitPrice - position.price) * position.quantity : (position.price - exitPrice) * position.quantity;
    const totalCommission = commission * position.quantity * 2;
    const totalSlippage = slip * position.quantity * 2;
    const netPnl = grossPnl - totalCommission;
    equity += netPnl;
    orders.push({ direction: position.direction, entryTime: position.time, entryPrice: position.price, exitTime: candle.time, exitPrice, quantity: position.quantity, grossPnl: round(grossPnl), commission: round(totalCommission), slippage: round(totalSlippage), netPnl: round(netPnl) });
    position = null;
  };

  for (let i = 0; i < input.candles.length; i++) {
    const candle = input.candles[i];
    const signal = input.strategy(candle, i, position?.direction ?? null);
    if (position && (signal === "flat" || (signal && signal !== position.direction))) close(candle);
    if (!position && signal && signal !== "flat") {
      const direction = signal;
      const quantity = sizeFor(equity, candle);
      if (Number.isFinite(quantity) && quantity > 0) {
        const entryPrice = direction === "long" ? candle.close + slip : candle.close - slip;
        equity -= commission * quantity;
        position = { direction, time: candle.time, price: entryPrice, quantity };
      }
    }
    const unrealized = position ? (position.direction === "long" ? candle.close - position.price : position.price - candle.close) * position.quantity - commission * position.quantity : 0;
    mark(candle, unrealized);
  }
  if (position && input.candles.length) close(input.candles[input.candles.length - 1]);
  const netPnl = equity - input.initialEquity;
  const wins = orders.filter(o => o.netPnl > 0);
  const grossWins = wins.reduce((sum, o) => sum + o.netPnl, 0);
  const grossLosses = Math.abs(orders.filter(o => o.netPnl < 0).reduce((sum, o) => sum + o.netPnl, 0));
  const provenance = JSON.stringify(input.provenance);
  const candleData = JSON.stringify(input.candles);
  return { metadata: { engineVersion: BACKTEST_ENGINE_VERSION, inputHash: hash(provenance + candleData), candleCount: input.candles.length }, orders, equityCurve: curve, finalEquity: round(equity), netPnl: round(netPnl), winRate: orders.length ? round(wins.length / orders.length * 100) : 0, profitFactor: grossLosses ? round(grossWins / grossLosses) : grossWins > 0 ? Infinity : 0, maxDrawdown: round(maxDrawdown), maxDrawdownPercent: round(maxDrawdownPercent) };
}
