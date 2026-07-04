import { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  UTCTimestamp,
} from "lightweight-charts";
import {
  TrendingUp, TrendingDown, Activity, Target, DollarSign, Percent,
  Calendar, BarChart3, Settings2, Play, RotateCcw,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import { instrumentCategories } from "@/data/instruments";
import { fetchYahooCandles, type YahooCandle, type YahooInterval, type YahooRange } from "@/services/yahooFinance";

// ========== 回测策略类型 ==========
type StrategyType = "sma_crossover" | "ema_crossover" | "rsi";

interface BacktestResult {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent: number;
  maxDrawdown: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  trades: Array<{
    entryTime: number;
    exitTime: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    direction: "long" | "short";
  }>;
  equityCurve: Array<{ time: number; value: number }>;
}

// ========== 颜色配置 ==========
const PRIMARY = "#099268";
const LOSS = "#e03131";
const CHART_BG = "transparent";
const GRID_COLOR = "rgba(0,0,0,0.04)";
const TEXT_COLOR = "#868e96";

export default function Backtest() {
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const currency = useSettings((s) => s.currency);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const fastLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const slowLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // 状态
  const [selectedSymbol, setSelectedSymbol] = useState("EUR/USD");
  const [interval, setInterval] = useState<YahooInterval>("1d");
  const [range, setRange] = useState<YahooRange>("6mo");
  const [strategy, setStrategy] = useState<StrategyType>("sma_crossover");
  const [fastPeriod, setFastPeriod] = useState(10);
  const [slowPeriod, setSlowPeriod] = useState(30);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [positionSize, setPositionSize] = useState(1); // 1 手

  const [candles, setCandles] = useState<YahooCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);

  // ========== 初始化图表 ==========
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: CHART_BG },
        textColor: TEXT_COLOR,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      rightPriceScale: {
        borderColor: "transparent",
      },
      timeScale: {
        borderColor: "transparent",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(134, 142, 150, 0.3)",
          width: 1,
          style: 2,
        },
        horzLine: {
          color: "rgba(134, 142, 150, 0.3)",
          width: 1,
          style: 2,
        },
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: PRIMARY,
      downColor: LOSS,
      borderUpColor: PRIMARY,
      borderDownColor: LOSS,
      wickUpColor: PRIMARY,
      wickDownColor: LOSS,
    });

    const fastLine = chart.addSeries(LineSeries, {
      color: "#f59f00",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const slowLine = chart.addSeries(LineSeries, {
      color: "#845ef7",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    fastLineRef.current = fastLine;
    slowLineRef.current = slowLine;

    // 响应式
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // ========== 获取K线数据 ==========
  const fetchData = async () => {
    setLoading(true);
    try {
      const symbol = selectedSymbol.replace("/", "");
      const { candles: data } = await fetchYahooCandles(symbol, interval, range);
      setCandles(data);

      if (candleSeriesRef.current && data.length > 0) {
        const candleData = data.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candleSeriesRef.current.setData(candleData);
        chartRef.current?.timeScale().fitContent();
      }
    } catch (err) {
      console.error("Failed to fetch candles:", err);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchData();
  }, [selectedSymbol, interval, range]);

  // ========== 计算指标 ==========
  const calculateSMA = (data: number[], period: number): number[] => {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  };

  const calculateEMA = (data: number[], period: number): number[] => {
    const result: number[] = [];
    const multiplier = 2 / (period + 1);
    let ema = data[0];
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        result.push(data[0]);
      } else {
        ema = (data[i] - ema) * multiplier + ema;
        result.push(ema);
      }
    }
    return result;
  };

  const calculateRSI = (data: number[], period: number): number[] => {
    const result: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }

    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        result.push(50);
      } else {
        const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    }
    return result;
  };

  // ========== 执行回测 ==========
  const runBacktest = () => {
    if (candles.length === 0) return;

    const closes = candles.map((c) => c.close);
    let fastLine: number[] = [];
    let slowLine: number[] = [];
    let rsiLine: number[] = [];

    // 计算指标
    if (strategy === "sma_crossover") {
      fastLine = calculateSMA(closes, fastPeriod);
      slowLine = calculateSMA(closes, slowPeriod);
    } else if (strategy === "ema_crossover") {
      fastLine = calculateEMA(closes, fastPeriod);
      slowLine = calculateEMA(closes, slowPeriod);
    } else if (strategy === "rsi") {
      rsiLine = calculateRSI(closes, rsiPeriod);
    }

    // 更新图表上的指标线
    if (fastLineRef.current && slowLineRef.current && (strategy === "sma_crossover" || strategy === "ema_crossover")) {
      const fastData = candles
        .map((c, i) => ({ time: c.time as UTCTimestamp, value: fastLine[i] }))
        .filter((d) => !isNaN(d.value));
      const slowData = candles
        .map((c, i) => ({ time: c.time as UTCTimestamp, value: slowLine[i] }))
        .filter((d) => !isNaN(d.value));

      fastLineRef.current.setData(fastData);
      slowLineRef.current.setData(slowData);
      fastLineRef.current.applyOptions({ visible: true });
      slowLineRef.current.applyOptions({ visible: true });
    } else {
      fastLineRef.current?.applyOptions({ visible: false });
      slowLineRef.current?.applyOptions({ visible: false });
    }

    // 回测逻辑
    const trades: BacktestResult["trades"] = [];
    let position: { direction: "long" | "short"; entryPrice: number; entryTime: number } | null = null;
    let equity = initialCapital;
    const equityCurve: Array<{ time: number; value: number }> = [];

    for (let i = 1; i < candles.length; i++) {
      let signal: "long" | "short" | "close" | null = null;

      if (strategy === "sma_crossover" || strategy === "ema_crossover") {
        if (isNaN(fastLine[i]) || isNaN(slowLine[i]) || isNaN(fastLine[i - 1]) || isNaN(slowLine[i - 1])) {
          equityCurve.push({ time: candles[i].time, value: equity });
          continue;
        }
        // 金叉：快线上穿慢线 → 做多
        if (fastLine[i - 1] <= slowLine[i - 1] && fastLine[i] > slowLine[i]) {
          signal = "long";
        }
        // 死叉：快线下穿慢线 → 做空（或平多）
        else if (fastLine[i - 1] >= slowLine[i - 1] && fastLine[i] < slowLine[i]) {
          signal = "short";
        }
      } else if (strategy === "rsi") {
        if (isNaN(rsiLine[i]) || isNaN(rsiLine[i - 1])) {
          equityCurve.push({ time: candles[i].time, value: equity });
          continue;
        }
        // RSI 从超卖区上穿 → 做多
        if (rsiLine[i - 1] <= rsiOversold && rsiLine[i] > rsiOversold) {
          signal = "long";
        }
        // RSI 从超买区下穿 → 做空
        else if (rsiLine[i - 1] >= rsiOverbought && rsiLine[i] < rsiOverbought) {
          signal = "short";
        }
      }

      // 执行交易
      if (signal === "long") {
        if (position?.direction === "short") {
          // 平空
          const pnl = (position.entryPrice - candles[i].close) * positionSize * 1000;
          equity += pnl;
          trades.push({
            entryTime: position.entryTime,
            exitTime: candles[i].time,
            entryPrice: position.entryPrice,
            exitPrice: candles[i].close,
            pnl,
            direction: "short",
          });
          position = null;
        }
        if (!position) {
          position = { direction: "long", entryPrice: candles[i].close, entryTime: candles[i].time };
        }
      } else if (signal === "short") {
        if (position?.direction === "long") {
          // 平多
          const pnl = (candles[i].close - position.entryPrice) * positionSize * 1000;
          equity += pnl;
          trades.push({
            entryTime: position.entryTime,
            exitTime: candles[i].time,
            entryPrice: position.entryPrice,
            exitPrice: candles[i].close,
            pnl,
            direction: "long",
          });
          position = null;
        }
        if (!position) {
          position = { direction: "short", entryPrice: candles[i].close, entryTime: candles[i].time };
        }
      }

      equityCurve.push({ time: candles[i].time, value: equity });
    }

    // 平仓最后一笔
    if (position) {
      const lastCandle = candles[candles.length - 1];
      const pnl = position.direction === "long"
        ? (lastCandle.close - position.entryPrice) * positionSize * 1000
        : (position.entryPrice - lastCandle.close) * positionSize * 1000;
      equity += pnl;
      trades.push({
        entryTime: position.entryTime,
        exitTime: lastCandle.time,
        entryPrice: position.entryPrice,
        exitPrice: lastCandle.close,
        pnl,
        direction: position.direction,
      });
    }

    // 计算统计数据
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl <= 0);
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalWin = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLoss === 0 ? (totalWin > 0 ? 99 : 0) : totalWin / totalLoss;

    // 最大回撤
    let maxDrawdown = 0;
    let peak = equityCurve[0]?.value || initialCapital;
    for (const point of equityCurve) {
      if (point.value > peak) peak = point.value;
      const dd = (peak - point.value) / peak * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    setBacktestResult({
      totalTrades: trades.length,
      winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
      totalPnl,
      totalPnlPercent: (totalPnl / initialCapital) * 100,
      maxDrawdown,
      profitFactor,
      avgWin: wins.length > 0 ? totalWin / wins.length : 0,
      avgLoss: losses.length > 0 ? -totalLoss / losses.length : 0,
      trades,
      equityCurve,
    });
  };

  // 重置回测
  const resetBacktest = () => {
    setBacktestResult(null);
    fastLineRef.current?.setData([]);
    slowLineRef.current?.setData([]);
    fastLineRef.current?.applyOptions({ visible: false });
    slowLineRef.current?.applyOptions({ visible: false });
  };

  // 格式化货币
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // 品种选项
  const symbolOptions = useMemo(() => {
    return instrumentCategories.flatMap((cat) =>
      cat.instruments.map((inst) => ({
        value: inst.symbol,
        label: language === "zh" ? inst.labelZh : inst.label,
        category: language === "zh" ? cat.labelZh : cat.label,
      }))
    );
  }, [language]);

  // 时间周期选项
  const intervalOptions: Array<{ value: YahooInterval; label: string }> = [
    { value: "1d", label: language === "zh" ? "日线" : "Daily" },
    { value: "1wk", label: language === "zh" ? "周线" : "Weekly" },
    { value: "1mo", label: language === "zh" ? "月线" : "Monthly" },
  ];

  // 时间范围选项
  const rangeOptions: Array<{ value: YahooRange; label: string }> = [
    { value: "1mo", label: language === "zh" ? "1个月" : "1 Month" },
    { value: "3mo", label: language === "zh" ? "3个月" : "3 Months" },
    { value: "6mo", label: language === "zh" ? "6个月" : "6 Months" },
    { value: "1y", label: language === "zh" ? "1年" : "1 Year" },
    { value: "2y", label: language === "zh" ? "2年" : "2 Years" },
    { value: "5y", label: language === "zh" ? "5年" : "5 Years" },
  ];

  // 策略选项
  const strategyOptions: Array<{ value: StrategyType; label: string }> = [
    { value: "sma_crossover", label: language === "zh" ? "SMA 均线交叉" : "SMA Crossover" },
    { value: "ema_crossover", label: language === "zh" ? "EMA 均线交叉" : "EMA Crossover" },
    { value: "rsi", label: language === "zh" ? "RSI 超买超卖" : "RSI Overbought/Oversold" },
  ];

  return (
    <Layout title={language === "zh" ? "回测" : "Backtest"}>
      {/* 顶部控制栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-surface p-4">
        {/* 品种选择 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">
            {language === "zh" ? "品种" : "Symbol"}
          </label>
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
          >
            {symbolOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 时间周期 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">
            {language === "zh" ? "周期" : "Interval"}
          </label>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value as YahooInterval)}
            className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
          >
            {intervalOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 时间范围 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">
            {language === "zh" ? "范围" : "Range"}
          </label>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as YahooRange)}
            className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
          >
            {rangeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="h-8 w-px bg-border" />

        {/* 策略选择 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">
            {language === "zh" ? "策略" : "Strategy"}
          </label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as StrategyType)}
            className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
          >
            {strategyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 策略参数 */}
        {(strategy === "sma_crossover" || strategy === "ema_crossover") && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">
                {language === "zh" ? "快线周期" : "Fast Period"}
              </label>
              <input
                type="number"
                value={fastPeriod}
                onChange={(e) => setFastPeriod(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">
                {language === "zh" ? "慢线周期" : "Slow Period"}
              </label>
              <input
                type="number"
                value={slowPeriod}
                onChange={(e) => setSlowPeriod(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
          </>
        )}

        {strategy === "rsi" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">
                {language === "zh" ? "RSI 周期" : "RSI Period"}
              </label>
              <input
                type="number"
                value={rsiPeriod}
                onChange={(e) => setRsiPeriod(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">
                {language === "zh" ? "超买" : "Overbought"}
              </label>
              <input
                type="number"
                value={rsiOverbought}
                onChange={(e) => setRsiOverbought(Math.max(50, parseInt(e.target.value) || 70))}
                className="w-20 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">
                {language === "zh" ? "超卖" : "Oversold"}
              </label>
              <input
                type="number"
                value={rsiOversold}
                onChange={(e) => setRsiOversold(Math.min(50, parseInt(e.target.value) || 30))}
                className="w-20 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
          </>
        )}

        <div className="h-8 w-px bg-border" />

        {/* 资金设置 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">
            {language === "zh" ? "初始资金" : "Initial Capital"}
          </label>
          <input
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(Math.max(1, parseInt(e.target.value) || 10000))}
            className="w-28 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">
            {language === "zh" ? "仓位(手)" : "Position Size"}
          </label>
          <input
            type="number"
            step="0.1"
            value={positionSize}
            onChange={(e) => setPositionSize(Math.max(0.01, parseFloat(e.target.value) || 1))}
            className="w-20 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
          />
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={resetBacktest}
            className="flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
          >
            <RotateCcw size={16} />
            {language === "zh" ? "重置" : "Reset"}
          </button>
          <button
            onClick={runBacktest}
            disabled={loading || candles.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Play size={16} />
            {language === "zh" ? "运行回测" : "Run Backtest"}
          </button>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="mb-4 rounded-lg border border-border bg-bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-text-secondary" />
          <span className="font-display text-sm font-semibold text-text">
            {selectedSymbol} · {intervalOptions.find((i) => i.value === interval)?.label}
          </span>
          {loading && (
            <span className="ml-2 text-xs text-text-muted">
              {language === "zh" ? "加载中..." : "Loading..."}
            </span>
          )}
        </div>
        <div ref={chartContainerRef} className="h-[400px] w-full" />
      </div>

      {/* 回测结果 */}
      {backtestResult && (
        <>
          {/* KPI 卡片 */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-bg-surface px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">
                  {language === "zh" ? "总交易数" : "Total Trades"}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                </span>
              </div>
              <div className="tj-number mt-2 text-xl font-bold text-text">
                {backtestResult.totalTrades}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-bg-surface px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">
                  {language === "zh" ? "胜率" : "Win Rate"}
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ${backtestResult.winRate >= 50 ? "bg-primary/10" : "bg-loss/10"}`}>
                  <Target className={`h-3.5 w-3.5 ${backtestResult.winRate >= 50 ? "text-primary" : "text-loss"}`} />
                </span>
              </div>
              <div className={`tj-number mt-2 text-xl font-bold ${backtestResult.winRate >= 50 ? "text-primary" : "text-loss"}`}>
                {backtestResult.winRate.toFixed(1)}%
              </div>
            </div>

            <div className="rounded-lg border border-border bg-bg-surface px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">
                  {language === "zh" ? "总盈亏" : "Total P&L"}
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ${backtestResult.totalPnl >= 0 ? "bg-primary/10" : "bg-loss/10"}`}>
                  <DollarSign className={`h-3.5 w-3.5 ${backtestResult.totalPnl >= 0 ? "text-primary" : "text-loss"}`} />
                </span>
              </div>
              <div className={`tj-number mt-2 text-xl font-bold ${backtestResult.totalPnl >= 0 ? "text-primary" : "text-loss"}`}>
                {formatCurrency(backtestResult.totalPnl)}
              </div>
              <div className="text-[10px] text-text-muted">
                {backtestResult.totalPnlPercent >= 0 ? "+" : ""}
                {backtestResult.totalPnlPercent.toFixed(2)}%
              </div>
            </div>

            <div className="rounded-lg border border-border bg-bg-surface px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">
                  {language === "zh" ? "盈亏比" : "Profit Factor"}
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ${backtestResult.profitFactor >= 1 ? "bg-primary/10" : "bg-loss/10"}`}>
                  <TrendingUp className={`h-3.5 w-3.5 ${backtestResult.profitFactor >= 1 ? "text-primary" : "text-loss"}`} />
                </span>
              </div>
              <div className={`tj-number mt-2 text-xl font-bold ${backtestResult.profitFactor >= 1 ? "text-primary" : "text-loss"}`}>
                {backtestResult.profitFactor.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-bg-surface px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">
                  {language === "zh" ? "最大回撤" : "Max Drawdown"}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-loss/10">
                  <TrendingDown className="h-3.5 w-3.5 text-loss" />
                </span>
              </div>
              <div className="tj-number mt-2 text-xl font-bold text-loss">
                -{backtestResult.maxDrawdown.toFixed(2)}%
              </div>
            </div>

            <div className="rounded-lg border border-border bg-bg-surface px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">
                  {language === "zh" ? "平均盈利" : "Avg Win"}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </span>
              </div>
              <div className="tj-number mt-2 text-xl font-bold text-primary">
                {formatCurrency(backtestResult.avgWin)}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-bg-surface px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">
                  {language === "zh" ? "平均亏损" : "Avg Loss"}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-loss/10">
                  <TrendingDown className="h-3.5 w-3.5 text-loss" />
                </span>
              </div>
              <div className="tj-number mt-2 text-xl font-bold text-loss">
                {formatCurrency(backtestResult.avgLoss)}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-bg-surface px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">
                  {language === "zh" ? "收益率" : "Return"}
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ${backtestResult.totalPnlPercent >= 0 ? "bg-primary/10" : "bg-loss/10"}`}>
                  <Percent className={`h-3.5 w-3.5 ${backtestResult.totalPnlPercent >= 0 ? "text-primary" : "text-loss"}`} />
                </span>
              </div>
              <div className={`tj-number mt-2 text-xl font-bold ${backtestResult.totalPnlPercent >= 0 ? "text-primary" : "text-loss"}`}>
                {backtestResult.totalPnlPercent >= 0 ? "+" : ""}
                {backtestResult.totalPnlPercent.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* 交易列表 */}
          <div className="rounded-lg border border-border bg-bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-text-secondary" />
              <span className="font-display text-sm font-semibold text-text">
                {language === "zh" ? "交易记录" : "Trade History"}
              </span>
              <span className="text-xs text-text-muted">
                ({backtestResult.trades.length} {language === "zh" ? "笔" : "trades"})
              </span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 bg-bg-surface">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 text-left font-medium text-text-secondary">
                      {language === "zh" ? "方向" : "Direction"}
                    </th>
                    <th className="px-2 py-2 text-right font-medium text-text-secondary">
                      {language === "zh" ? "入场价" : "Entry"}
                    </th>
                    <th className="px-2 py-2 text-right font-medium text-text-secondary">
                      {language === "zh" ? "出场价" : "Exit"}
                    </th>
                    <th className="px-2 py-2 text-right font-medium text-text-secondary">
                      {language === "zh" ? "盈亏" : "P&L"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {backtestResult.trades.slice().reverse().map((trade, idx) => (
                    <tr key={idx} className="border-b border-border-subtle last:border-0">
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                            trade.direction === "long"
                              ? "bg-primary/10 text-primary"
                              : "bg-loss/10 text-loss"
                          }`}
                        >
                          {trade.direction === "long"
                            ? language === "zh" ? "做多" : "Long"
                            : language === "zh" ? "做空" : "Short"}
                        </span>
                      </td>
                      <td className="tj-number px-2 py-2 text-right text-text-secondary">
                        {trade.entryPrice.toFixed(4)}
                      </td>
                      <td className="tj-number px-2 py-2 text-right text-text-secondary">
                        {trade.exitPrice.toFixed(4)}
                      </td>
                      <td className={`tj-number px-2 py-2 text-right font-semibold ${trade.pnl >= 0 ? "text-primary" : "text-loss"}`}>
                        {trade.pnl >= 0 ? "+" : ""}
                        {formatCurrency(trade.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 空状态提示 */}
      {!backtestResult && !loading && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-bg-surface py-16 text-center">
          <Settings2 className="mb-3 h-10 w-10 text-text-muted" />
          <p className="mb-1 text-sm font-medium text-text-secondary">
            {language === "zh" ? "选择策略参数后运行回测" : "Configure strategy and run backtest"}
          </p>
          <p className="text-xs text-text-muted">
            {language === "zh" ? "支持 SMA/EMA 均线交叉和 RSI 策略" : "Supports SMA/EMA crossover and RSI strategies"}
          </p>
        </div>
      )}
    </Layout>
  );
}
