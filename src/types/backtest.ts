import type { Direction } from "./index";

export interface BacktestCandle { time: number; open: number; high: number; low: number; close: number; volume?: number; }
export interface BacktestDataProvenance { symbol: string; timeframe: string; source: string; rangeStart?: string; rangeEnd?: string; timezone: string; datasetVersion: string; }
export interface BacktestOrder { direction: Direction; entryTime: number; entryPrice: number; exitTime: number; exitPrice: number; quantity: number; grossPnl: number; commission: number; slippage: number; netPnl: number; }
export interface BacktestInput { candles: BacktestCandle[]; initialEquity: number; provenance: BacktestDataProvenance; commissionPerUnit?: number; slippagePerUnit?: number; strategy: (candle: BacktestCandle, index: number, position: Direction | null) => Direction | "flat" | null; positionSize?: (equity: number, candle: BacktestCandle) => number; }
export interface BacktestResult { metadata: { engineVersion: string; inputHash: string; candleCount: number }; orders: BacktestOrder[]; equityCurve: Array<{ time: number; equity: number }>; finalEquity: number; netPnl: number; winRate: number; profitFactor: number; maxDrawdown: number; maxDrawdownPercent: number; }
