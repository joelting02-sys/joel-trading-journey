import { useEffect, useState, useMemo } from "react";
import { Plus, Save, X, BarChart3, Wallet } from "lucide-react";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import { useTradeStore } from "@/store/useTradeStore";
import { instrumentCategories } from "@/data/instruments";
import type { Direction, Trade } from "@/types";

function toTvSymbol(symbol: string): string {
  const s = symbol.toUpperCase().replace("/", "");
  if (s === "COPPER") return "COMEX:HG1!";
  if (s === "US500") return "FOREXCOM:SPX500";
  if (s === "US30") return "FOREXCOM:US30";
  if (s.includes("XAUUSD")) return "OANDA:XAUUSD";
  if (s.includes("XAGUSD")) return "OANDA:XAGUSD";
  
  // For FX pairs
  const fxPairs = ["EURUSD", "AUDUSD", "GBPUSD", "USDJPY", "USDCAD"];
  if (fxPairs.includes(s)) {
    return `FX_IDC:${s}`;
  }
  return s;
}

export default function ChartReview() {
  const language = useSettings((s) => s.language);
  const currency = useSettings((s) => s.currency);

  const accounts = useTradeStore((s) => s.accounts);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const addTrade = useTradeStore((s) => s.addTrade);

  // 状态
  const [selectedSymbol, setSelectedSymbol] = useState("EUR/USD");
  const [interval, setInterval] = useState("D"); // '1', '5', '15', '60', '240', 'D', 'W', 'M'
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccountId);

  // 交易表单状态
  const [showForm, setShowForm] = useState(false);
  const [formDirection, setFormDirection] = useState<Direction>("long");
  const [formEntryPrice, setFormEntryPrice] = useState("");
  const [formExitPrice, setFormExitPrice] = useState("");
  const [formQuantity, setFormQuantity] = useState("1");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);

  // TradingView 脚本加载状态
  const [tvLoaded, setTvLoaded] = useState(false);

  // 动态加载 TradingView 脚本
  useEffect(() => {
    if ((window as any).TradingView) {
      setTvLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.type = "text/javascript";
    script.async = true;
    script.id = "tradingview-widget-script";
    script.onload = () => {
      setTvLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // 初始化 & 联动更新 TradingView Widget
  useEffect(() => {
    if (!tvLoaded || !(window as any).TradingView) return;

    const container = document.getElementById("tradingview_chart_container");
    if (!container) return;
    container.innerHTML = "";

    const tvSymbol = toTvSymbol(selectedSymbol);

    new (window as any).TradingView.widget({
      "autosize": true,
      "symbol": tvSymbol,
      "interval": interval,
      "timezone": "Etc/UTC",
      "theme": "light", // 浅色主题以契合系统整体风格
      "style": "1", // 1 = 蜡烛图
      "locale": language === "zh" ? "zh_CN" : "en",
      "enable_publishing": false,
      "hide_side_toolbar": false, // 显示左侧绘图工具栏
      "allow_symbol_change": true,
      "container_id": "tradingview_chart_container",
      "studies": [
        "RSI@tv-basicstudies",
        "MASimple@tv-basicstudies"
      ],
      "show_popup_button": true,
      "popup_width": "1000",
      "popup_height": "650",
    });
  }, [tvLoaded, selectedSymbol, interval, language]);

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

  // 时间周期选项（TradingView 对应值）
  const intervalOptions = [
    { value: "1", label: language === "zh" ? "1分钟" : "1m" },
    { value: "5", label: language === "zh" ? "5分钟" : "5m" },
    { value: "15", label: language === "zh" ? "15分钟" : "15m" },
    { value: "60", label: language === "zh" ? "1小时" : "1H" },
    { value: "240", label: language === "zh" ? "4小时" : "4H" },
    { value: "D", label: language === "zh" ? "日线" : "Daily" },
    { value: "W", label: language === "zh" ? "周线" : "Weekly" },
    { value: "M", label: language === "zh" ? "月线" : "Monthly" },
  ];

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
            onChange={(e) => setInterval(e.target.value)}
            className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
          >
            {intervalOptions.map((opt) => (
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
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus size={16} />
            {language === "zh" ? "记录复盘交易" : "Log Trade"}
          </button>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="mb-4 overflow-hidden rounded-xl border border-border bg-bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-display text-sm font-semibold text-text">
              TradingView {language === "zh" ? "专业图表画布" : "Chart Canvas"} ({selectedSymbol})
            </span>
          </div>
        </div>
        <div className="relative min-h-[580px] w-full bg-slate-50">
          <div id="tradingview_chart_container" className="h-[580px] w-full" />
          {!tvLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-text-secondary">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-3" />
              <p className="text-xs">{language === "zh" ? "正在连接 TradingView 服务器..." : "Connecting TradingView..."}</p>
            </div>
          )}
        </div>
      </div>

      {/* 添加交易表单 */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-border bg-bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold text-text">
                {language === "zh" ? "记录复盘交易" : "Log Review Trade"}
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
    </Layout>
  );
}
