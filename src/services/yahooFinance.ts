// Yahoo Finance 历史行情获取（通过 Vite 代理 /api/yahoo 转发，避开浏览器 CORS）
// 仅用于回测页的图表展示，不做实时行情

export type YahooInterval = "1d" | "1wk" | "1mo";
export type YahooRange = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "10y" | "max";

export interface YahooCandle {
  time: number; // unix seconds (lightweight-charts 需要)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface YahooMeta {
  symbol: string;
  regularMarketPrice: number;
  currency: string;
  exchangeName: string;
  instrumentType?: string;
}

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: YahooMeta;
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

/**
 * 把交易品种映射成 Yahoo Finance 的 symbol
 * - 外汇对 (EURUSD): EURUSD=X
 * - 黄金 (XAUUSD): XAUUSD=X (或 GC=F)
 * - 指数 (US500): ^GSPC
 * - 其它: 原样返回
 */
export function toYahooSymbol(symbol: string): string {
  const s = symbol.toUpperCase().trim();
  // 已经是 Yahoo 格式则直接返回
  if (s.includes("=") || s.startsWith("^") || s.includes("=")) return s;
  // 常见外汇对 6 字符（如 EURUSD、GBPUSD）
  if (/^[A-Z]{6}$/.test(s)) return `${s}=X`;
  // 常见指数代码映射
  const indexMap: Record<string, string> = {
    US500: "^GSPC", // S&P 500
    US30: "^DJI", // Dow Jones
    NAS100: "^NDX", // Nasdaq 100
    GER40: "^GDAXI", // DAX
    JP225: "^N225", // Nikkei 225
    HK50: "^HSI", // Hang Seng
  };
  if (indexMap[s]) return indexMap[s];
  // 商品代码（XAUUSD 黄金 / XAGUSD 白银）
  if (s === "XAUUSD") return "XAUUSD=X";
  if (s === "XAGUSD") return "XAGUSD=X";
  // 默认: 原样返回
  return s;
}

/**
 * 拉取历史 K 线
 * 失败返回空数组（不抛异常，前端可显示降级 UI）
 */
export async function fetchYahooCandles(
  symbol: string,
  interval: YahooInterval = "1d",
  range: YahooRange = "6mo"
): Promise<{ candles: YahooCandle[]; meta: YahooMeta | null }> {
  const yahooSymbol = toYahooSymbol(symbol);
  const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[yahoo] HTTP ${res.status} for ${yahooSymbol}`);
      return { candles: [], meta: null };
    }
    const data = (await res.json()) as YahooChartResponse;
    if (data.chart.error || !data.chart.result || data.chart.result.length === 0) {
      console.warn(`[yahoo] no data for ${yahooSymbol}:`, data.chart.error);
      return { candles: [], meta: null };
    }
    const r = data.chart.result[0];
    const meta = r.meta;
    const q = r.indicators.quote[0];
    const candles: YahooCandle[] = [];
    for (let i = 0; i < r.timestamp.length; i++) {
      // Yahoo 偶尔有 null（停牌等），跳过
      const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
      if (o == null || h == null || l == null || c == null) continue;
      candles.push({
        time: r.timestamp[i], // Yahoo 返回的就是 UTC 秒
        open: o,
        high: h,
        low: l,
        close: c,
        volume: q.volume[i] ?? 0,
      });
    }
    return { candles, meta };
  } catch (err) {
    console.warn(`[yahoo] fetch failed for ${yahooSymbol}:`, err);
    return { candles: [], meta: null };
  }
}