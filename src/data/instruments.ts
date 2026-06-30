// 交易品种分类配置

export interface Instrument {
  symbol: string;
  label: string;
  labelZh: string;
  pipSize: number;
}

export interface InstrumentCategory {
  key: string;
  label: string;
  labelZh: string;
  instruments: Instrument[];
}

// 外汇 (5个) + 期货 (3个) + 指数 (2个)
export const instrumentCategories: InstrumentCategory[] = [
  {
    key: "forex",
    label: "Forex",
    labelZh: "外汇",
    instruments: [
      { symbol: "EUR/USD", label: "EUR/USD", labelZh: "欧元/美元", pipSize: 0.0001 },
      { symbol: "AUD/USD", label: "AUD/USD", labelZh: "澳元/美元", pipSize: 0.0001 },
      { symbol: "GBP/USD", label: "GBP/USD", labelZh: "英镑/美元", pipSize: 0.0001 },
      { symbol: "USD/JPY", label: "USD/JPY", labelZh: "美元/日元", pipSize: 0.01 },
      { symbol: "USD/CAD", label: "USD/CAD", labelZh: "美元/加元", pipSize: 0.0001 },
    ],
  },
  {
    key: "futures",
    label: "Futures",
    labelZh: "期货",
    instruments: [
      { symbol: "XAU/USD", label: "Gold (XAU/USD)", labelZh: "黄金 (XAU/USD)", pipSize: 0.01 },
      { symbol: "XAG/USD", label: "Silver (XAG/USD)", labelZh: "白银 (XAG/USD)", pipSize: 0.001 },
      { symbol: "Copper", label: "Copper", labelZh: "铜", pipSize: 0.001 },
    ],
  },
  {
    key: "indices",
    label: "Indices",
    labelZh: "指数",
    instruments: [
      { symbol: "US500", label: "S&P 500 (US500)", labelZh: "标普500 (US500)", pipSize: 0.1 },
      { symbol: "US30", label: "US30 (Dow Jones)", labelZh: "道琼斯 (US30)", pipSize: 0.1 },
    ],
  },
];

// 扁平化所有品种
export const allInstruments: Instrument[] = instrumentCategories.flatMap(
  (c) => c.instruments
);

// 根据品种代码获取配置
export function getInstrument(symbol: string): Instrument | undefined {
  return allInstruments.find((i) => i.symbol === symbol);
}
