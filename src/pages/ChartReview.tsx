import { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  UTCTimestamp,
} from "lightweight-charts";
import {
  TrendingUp, TrendingDown, Plus, Trash2, Save, X,
  BarChart3, Wallet, Calendar, Target, DollarSign,
  MousePointer2,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import { useTradeStore } from "@/store/useTradeStore";
import { instrumentCategories } from "@/data/instruments";
import { fetchYahooCandles, type YahooCandle, type YahooInterval, type YahooRange } from "@/services/yahooFinance";
import type { Direction, Trade } from "@/types";

// ========== 颜色配置 ==========
const PRIMARY = "#099268";
const LOSS = "#e03131";
const CHART_BG = "transparent";
const GRID_COLOR = "rgba(0,0,0,0.04)";
const TEXT_COLOR = "#868e96";

// 标记类型
type MarkerType = "entry_long" | "entry_short" | "exit" | "stoploss" | "takeprofit";

interface ChartMarker {
  id: string;
  type: MarkerType;
  time: number;
  price: number;
}

export default function ChartReview() {
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const currency = useSettings((s) => s.currency);

  const accounts = useTradeStore((s) => s.accounts);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const addTrade = useTradeStore((s) => s.addTrade);
  const trades = useTradeStore((s) => s.trades);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // 状态
  const [selectedSymbol, setSelectedSymbol] = useState("EUR/USD");
  const [interval, setInterval] = useState<YahooInterval>("1d");
  const [range, setRange] = useState<YahooRange>("6mo");
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccountId);
  const [candles, setCandles] = useState<YahooCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [markers, setMarkers] = useState<ChartMarker[]>([]);

  // 交易表单状态
  const [showForm, setShowForm] = useState(false);
  const [formDirection, setFormDirection] = useState<Direction>("long");
  const [formEntryPrice, setFormEntryPrice] = useState("");
  const [formExitPrice, setFormExitPrice] = useState("");
  const [formQuantity, setFormQuantity] = useState("1");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);

  // 标记模式
  const [markerMode, setMarkerMode] = useState<MarkerType | null>(null);
  const markerModeRef = useRef<MarkerType | null>(null);
  useEffect(() => {
    markerModeRef.current = markerMode;
  }, [markerMode]);

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

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

      // 点击事件 - 标记模式下添加标记
      chart.subscribeClick((param) => {
        const currentMode = markerModeRef.current;
        if (!currentMode || !param.point) return;

        const price = candleSeries.coordinateToPrice(param.point.y);
        const time = param.time as UTCTimestamp;

        if (price !== undefined && time !== undefined) {
          const newMarker: ChartMarker = {
            id: `marker_${Date.now()}`,
            type: currentMode,
            time: time as number,
            price,
          };
          setMarkers((prev) => [...prev, newMarker]);

          // 自动填充价格到表单
          if (currentMode === "entry_long" || currentMode === "entry_short") {
            setFormEntryPrice(price.toFixed(4));
            setFormDirection(currentMode === "entry_long" ? "long" : "short");
          } else if (currentMode === "exit") {
            setFormExitPrice(price.toFixed(4));
          }

          // 退出标记模式
          setMarkerMode(null);
        }
    });

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

  // ========== 更新标记 ==========
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const tvMarkers = markers.map((m) => {
      let color = PRIMARY;
      let shape: "arrowUp" | "arrowDown" | "circle" | "square" = "arrowUp";
      let position: "aboveBar" | "belowBar" | "inBar" = "belowBar";
      let text = "";

      switch (m.type) {
        case "entry_long":
          color = PRIMARY;
          shape = "arrowUp";
          position = "belowBar";
          text = "ENTRY";
          break;
        case "entry_short":
          color = LOSS;
          shape = "arrowDown";
          position = "aboveBar";
          text = "ENTRY";
          break;
        case "exit":
          color = "#f59f00";
          shape = "circle";
          position = "inBar";
          text = "EXIT";
          break;
        case "stoploss":
          color = LOSS;
          shape = "square";
          position = "belowBar";
          text = "SL";
          break;
        case "takeprofit":
          color = PRIMARY;
          shape = "square";
          position = "aboveBar";
          text = "TP";
          break;
      }

      return {
        time: m.time as UTCTimestamp,
        position,
        color,
        shape,
        text,
        size: 2,
      };
    });

    // v5 API: setMarkers 可能在类型定义中缺失，但运行时存在
    (candleSeriesRef.current as unknown as { setMarkers: (m: typeof tvMarkers) => void }).setMarkers(tvMarkers);
  }, [markers]);

  // ========== 获取K线数据 ==========
  const fetchData = async () => {
    setLoading(true);
    try {
      const symbol = selectedSymbol.replace("/", "");
      const { candles: data } = await fetchYahooCandles(symbol, interval, range);
      setCandles(data);
      setMarkers([]); // 切换品种时清空标记

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

  // ========== 保存交易记录 ==========
  const handleSaveTrade = () => {
    if (!selectedAccountId) {
      alert(language === "zh" ? "请先选择账户" : "Please select an account first");
      return;
    }
    if (!formEntryPrice || !formExitPrice) {
      alert(language === "zh" ? "请填写入场价和出场价" : "Please fill entry and exit price");
      return;
    }

    const entry = parseFloat(formEntryPrice);
    const exit = parseFloat(formExitPrice);
    const qty = parseFloat(formQuantity) || 1;
    const pnl = formDirection === "long"
      ? (exit - entry) * qty * 1000
      : (entry - exit) * qty * 1000;
    const pnlPercent = (pnl / (entry * qty * 1000)) * 100;

    const newTrade: Trade = {
      id: `trade_${Date.now()}`,
      symbol: selectedSymbol,
      direction: formDirection,
      entryPrice: entry,
      exitPrice: exit,
      quantity: qty,
      pnl,
      pnlPercent,
      openDate: formDate,
      closeDate: formDate,
      status: "closed",
      notes: formNotes,
      account: selectedAccountId,
    };

    addTrade(newTrade);

    // 重置表单
    setShowForm(false);
    setFormEntryPrice("");
    setFormExitPrice("");
    setFormQuantity("1");
    setFormNotes("");
    setMarkers([]);
  };

  // ========== 删除标记 ==========
  const removeMarker = (id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  };

  // ========== 清空所有标记 ==========
  const clearMarkers = () => {
    setMarkers([]);
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

  // 当前账户的交易记录
  const accountTrades = useMemo(() => {
    return trades.filter((t) => t.account === selectedAccountId).slice(0, 20);
  }, [trades, selectedAccountId]);

  // 格式化货币
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Layout title={language === "zh" ? "图表复盘" : "Chart Review"}>
      {/* 顶部控制栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-bg-surface p-4">
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

        {/* 账户选择 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">
            {language === "zh" ? "账户" : "Account"}
          </label>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-text-secondary" />
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">{language === "zh" ? "选择账户" : "Select Account"}</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={clearMarkers}
            className="flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover"
          >
            <Trash2 size={16} />
            {language === "zh" ? "清空标记" : "Clear Markers"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus size={16} />
            {language === "zh" ? "添加交易" : "Add Trade"}
          </button>
        </div>
      </div>

      {/* 标记工具栏 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">
          {language === "zh" ? "标记工具：" : "Markers: "}
        </span>
        <button
          onClick={() => setMarkerMode(markerMode === "entry_long" ? null : "entry_long")}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            markerMode === "entry_long"
              ? "bg-primary text-white"
              : "bg-bg-elevated text-text-secondary hover:bg-bg-hover"
          }`}
        >
          <TrendingUp size={14} />
          {language === "zh" ? "做多入场" : "Long Entry"}
        </button>
        <button
          onClick={() => setMarkerMode(markerMode === "entry_short" ? null : "entry_short")}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            markerMode === "entry_short"
              ? "bg-loss text-white"
              : "bg-bg-elevated text-text-secondary hover:bg-bg-hover"
          }`}
        >
          <TrendingDown size={14} />
          {language === "zh" ? "做空入场" : "Short Entry"}
        </button>
        <button
          onClick={() => setMarkerMode(markerMode === "exit" ? null : "exit")}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            markerMode === "exit"
              ? "bg-warning text-white"
              : "bg-bg-elevated text-text-secondary hover:bg-bg-hover"
          }`}
        >
          <Target size={14} />
          {language === "zh" ? "出场" : "Exit"}
        </button>
        {markerMode && (
          <span className="ml-2 flex items-center gap-1 text-xs text-primary">
            <MousePointer2 size={12} />
            {language === "zh" ? "点击图表添加标记" : "Click on chart to place marker"}
          </span>
        )}
      </div>

      {/* 图表区域 */}
      <div className="mb-4 overflow-hidden rounded-xl border border-border bg-bg-surface">
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-display text-sm font-semibold text-text">
              {selectedSymbol} · {intervalOptions.find((i) => i.value === interval)?.label}
            </span>
            {loading && (
              <span className="ml-2 text-xs text-text-muted">
                {language === "zh" ? "加载中..." : "Loading..."}
              </span>
            )}
          </div>
          {markers.length > 0 && (
            <span className="text-xs text-text-muted">
              {markers.length} {language === "zh" ? "个标记" : "markers"}
            </span>
          )}
        </div>
        <div ref={chartContainerRef} className="h-[450px] w-full cursor-crosshair" />
      </div>

      {/* 标记列表 */}
      {markers.length > 0 && (
        <div className="mb-4 rounded-xl border border-border bg-bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-text-secondary" />
            <span className="font-display text-sm font-semibold text-text">
              {language === "zh" ? "图表标记" : "Chart Markers"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {markers.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs"
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    m.type === "entry_long"
                      ? "bg-primary"
                      : m.type === "entry_short"
                      ? "bg-loss"
                      : "bg-warning"
                  }`}
                />
                <span className="font-medium text-text-secondary">
                  {m.type === "entry_long"
                    ? language === "zh" ? "做多入场" : "Long Entry"
                    : m.type === "entry_short"
                    ? language === "zh" ? "做空入场" : "Short Entry"
                    : language === "zh" ? "出场" : "Exit"}
                </span>
                <span className="tj-number font-mono text-text">{m.price.toFixed(4)}</span>
                <button
                  onClick={() => removeMarker(m.id)}
                  className="text-text-muted hover:text-loss"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 添加交易表单 */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-border bg-bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold text-text">
                {language === "zh" ? "添加交易记录" : "Add Trade Record"}
              </span>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="text-text-muted hover:text-text-secondary"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {/* 方向 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">
                {language === "zh" ? "方向" : "Direction"}
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => setFormDirection("long")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    formDirection === "long"
                      ? "bg-primary text-white"
                      : "bg-bg-elevated text-text-secondary hover:bg-bg-hover"
                  }`}
                >
                  {language === "zh" ? "做多" : "Long"}
                </button>
                <button
                  onClick={() => setFormDirection("short")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    formDirection === "short"
                      ? "bg-loss text-white"
                      : "bg-bg-elevated text-text-secondary hover:bg-bg-hover"
                  }`}
                >
                  {language === "zh" ? "做空" : "Short"}
                </button>
              </div>
            </div>

            {/* 入场价 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">
                {language === "zh" ? "入场价" : "Entry Price"}
              </label>
              <input
                type="number"
                step="0.0001"
                value={formEntryPrice}
                onChange={(e) => setFormEntryPrice(e.target.value)}
                placeholder="1.0800"
                className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>

            {/* 出场价 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">
                {language === "zh" ? "出场价" : "Exit Price"}
              </label>
              <input
                type="number"
                step="0.0001"
                value={formExitPrice}
                onChange={(e) => setFormExitPrice(e.target.value)}
                placeholder="1.0900"
                className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>

            {/* 手数 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">
                {language === "zh" ? "手数" : "Lots"}
              </label>
              <input
                type="number"
                step="0.01"
                value={formQuantity}
                onChange={(e) => setFormQuantity(e.target.value)}
                className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>

            {/* 日期 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">
                {language === "zh" ? "日期" : "Date"}
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>

            {/* 盈亏预览 */}
            {formEntryPrice && formExitPrice && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-muted">
                  {language === "zh" ? "预估盈亏" : "Est. P&L"}
                </label>
                <div
                  className={`tj-number rounded-md bg-bg-elevated px-3 py-2 text-sm font-bold ${
                    (formDirection === "long"
                      ? parseFloat(formExitPrice) - parseFloat(formEntryPrice)
                      : parseFloat(formEntryPrice) - parseFloat(formExitPrice)) >= 0
                      ? "text-primary"
                      : "text-loss"
                  }`}
                >
                  {formatCurrency(
                    (formDirection === "long"
                      ? parseFloat(formExitPrice) - parseFloat(formEntryPrice)
                      : parseFloat(formEntryPrice) - parseFloat(formExitPrice)) *
                      (parseFloat(formQuantity) || 1) *
                      1000
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 备注 */}
          <div className="mt-4 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">
              {language === "zh" ? "复盘笔记 / SOP 备注" : "Review Notes / SOP"}
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
              placeholder={
                language === "zh"
                  ? "记录交易思路、SOP 执行情况、情绪状态..."
                  : "Record your trading thoughts, SOP execution, mindset..."
              }
              className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            />
          </div>

          {/* 保存按钮 */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border bg-bg-elevated px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
            >
              {language === "zh" ? "取消" : "Cancel"}
            </button>
            <button
              onClick={handleSaveTrade}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Save size={16} />
              {language === "zh" ? "保存交易" : "Save Trade"}
            </button>
          </div>
        </div>
      )}

      {/* 最近交易记录 */}
      <div className="rounded-xl border border-border bg-bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-text-secondary" />
            <span className="font-display text-sm font-semibold text-text">
              {language === "zh" ? "最近交易" : "Recent Trades"}
            </span>
          </div>
          {selectedAccountId && (
            <span className="text-xs text-text-muted">
              {accountTrades.length} {language === "zh" ? "笔" : "trades"}
            </span>
          )}
        </div>

        {!selectedAccountId ? (
          <div className="py-8 text-center text-sm text-text-muted">
            {language === "zh" ? "请先选择一个账户" : "Please select an account first"}
          </div>
        ) : accountTrades.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-muted">
            {language === "zh" ? "暂无交易记录" : "No trades yet"}
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="sticky top-0 bg-bg-surface">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                    {language === "zh" ? "品种" : "Symbol"}
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                    {language === "zh" ? "方向" : "Dir"}
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">
                    {language === "zh" ? "入场" : "Entry"}
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">
                    {language === "zh" ? "出场" : "Exit"}
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">
                    {language === "zh" ? "盈亏" : "P&L"}
                  </th>
                  <th className="pl-2 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">
                    {language === "zh" ? "日期" : "Date"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {accountTrades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-hover/50"
                  >
                    <td className="tj-number py-2 pr-3 font-semibold text-text">
                      {trade.symbol}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                          trade.direction === "long"
                            ? "bg-primary/10 text-primary"
                            : "bg-loss/10 text-loss"
                        }`}
                      >
                        {trade.direction === "long"
                          ? language === "zh"
                            ? "多"
                            : "L"
                          : language === "zh"
                          ? "空"
                          : "S"}
                      </span>
                    </td>
                    <td className="tj-number px-2 py-2 text-right text-text-secondary">
                      {trade.entryPrice.toFixed(4)}
                    </td>
                    <td className="tj-number px-2 py-2 text-right text-text-secondary">
                      {trade.exitPrice.toFixed(4)}
                    </td>
                    <td
                      className={`tj-number px-2 py-2 text-right font-bold ${
                        trade.pnl >= 0 ? "text-primary" : "text-loss"
                      }`}
                    >
                      {trade.pnl >= 0 ? "+" : ""}
                      {formatCurrency(trade.pnl)}
                    </td>
                    <td className="tj-number pl-2 py-2 text-right text-xs text-text-muted">
                      {trade.closeDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
