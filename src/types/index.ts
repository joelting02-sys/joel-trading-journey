// 交易方向
export type Direction = "long" | "short";

// 交易状态
export type TradeStatus = "open" | "closed";

// 交易记录
export interface Trade {
  id: string;
  symbol: string;
  direction: Direction;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  fee?: number;
  openDate: string;
  closeDate: string;
  status: TradeStatus;
  notes?: string;
  sopNotes?: string;
  mindsetNotes?: string;
  // 交易截图(压缩 base64 data URL,用户可附上自己的画线图表)
  images?: string[];
  account: string;
}

// Prop firm 考试状态
export type PropFirmStatus = "active" | "passed" | "failed";

// Prop firm 考试配置(可选,只有 prop firm 账户才填)
export interface PropFirmChallenge {
  enabled: boolean;
  // 起始余额 / 当日起始权益(用户手动维护)
  startingBalance: number;
  // 清算点(equity 跌破此值则考试失败)
  liquidationPoint: number;
  // 历史最低权益(可选,用于显示)
  lowestEquityEver: number;
  // 最少交易天数要求
  minTradingDays: number;
  // 允许的每日最大回撤百分比(如 3 表示 3%)
  permittedDailyDrawdown: number;
  // 允许的总回撤百分比(如 6 表示 6%)
  permittedTotalDrawdown: number;
  // 利润目标(美元)
  profitTarget: number;
  // 考试开始日期
  startDate: string;
}

// 账户
export interface Account {
  id: string;
  name: string;
  broker: string;
  balance: number;
  equity: number;
  currency: string;
  // 账户类型标签(real / prop / demo / 其他)
  accountType?: "real" | "prop" | "demo" | "other";
  propFirm?: PropFirmChallenge;
  // 个人账户可选:目标资金(要把资金做到多少钱)
  targetBalance?: number;
  // 个人账户可选:日内最大回撤金额(不超过多少)
  dailyDrawdownLimit?: number;
}

// 日志评级
export type JournalRating = "A" | "B" | "C";

// 日志条目
export interface JournalEntry {
  id: string;
  date: string;
  rating: JournalRating;
  content: string;
}

// KPI 指标
export interface KpiMetrics {
  totalEquity: number;
  todayPnl: number;
  todayPnlPercent: number;
  winRate: number;
  winCount: number;
  totalCount: number;
  maxDrawdown: number;
  maxDrawdownAmount: number;
}

// 快捷统计
export interface QuickStats {
  tradesThisMonth: number;
  avgHoldDays: number;
  bestTrade: number;
  worstTrade: number;
}

// 权益曲线数据点
export interface EquityPoint {
  date: string;
  value: number;
}

// 导航项
export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: string;
}

// SOP 规则分类
export type SopCategory = "entry" | "exit" | "risk" | "psychology";

// SOP 规则
export interface SopRule {
  id: string;
  category: SopCategory;
  title: string;
  description: string;
}

// AI API 配置
export interface AiConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

// 多 AI 配置:每条记录代表一个完整的 API 配置(端点+密钥+模型)
// 包含用户起的 name,用于在 UI 列表中识别
export interface AiConfigEntry {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
}

// 聊天消息角色
export type ChatRole = "user" | "assistant" | "system";

// SOP 修改提议 (AI 在聊天中提出,用户确认后写入)
export type SopProposalAction = "add" | "update" | "remove";

export interface SopProposal {
  action: SopProposalAction;
  // 当前规则的 id(update/remove 时使用)
  ruleId?: string;
  // 新规则的 id(add 时分配,或保留原有 id)
  id?: string;
  category: "entry" | "exit" | "risk" | "psychology" | "general";
  title: string;
  description: string;
  // 给用户的解释 / 修改理由
  reason?: string;
}

// 聊天消息
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  imageUrl?: string;
  timestamp: string;
  extractedTrade?: Partial<Trade>;
  extractedTrades?: Partial<Trade>[];
  // AI 提议的 SOP 修改,待用户确认
  sopProposals?: SopProposal[];
}

// =============== 经济日历偏好 ===============
// 关注的国家/地区(发布重要经济数据)
export type CalendarCountryCode = "US" | "EU" | "GB" | "JP" | "AU" | "CA" | "CH" | "CN" | "NZ";

// 关注的交易品种(在事件影响范围内)
export type CalendarInstrumentCode =
  | "EURUSD" | "AUDUSD" | "GBPUSD" | "USDJPY" | "USDCAD"
  | "EURJPY" | "GBPJPY" | "AUDJPY" | "EURGBP"
  | "XAUUSD" | "XAGUSD" | "Copper"
  | "US500" | "US30" | "NAS100" | "GER40";

// 重要性筛选(只显示高 / 中+高 / 全部)
export type CalendarImportanceFilter = "high_only" | "medium_and_high" | "all";

export interface CalendarPreferences {
  // 关注的国家
  countries: CalendarCountryCode[];
  // 关注的品种
  instruments: CalendarInstrumentCode[];
  // 重要性筛选
  importance: CalendarImportanceFilter;
  // 是否包含银行休市信息
  includeBankHolidays: boolean;
  // 数据公布后是否标注市场情绪(看多/看空)
  includeSentiment: boolean;
}

// =============== 开盘前 Checklist ===============
export type MarketBias = "bullish" | "bearish" | "neutral";
export type EmotionState = "calm" | "confident" | "anxious" | "excited" | "frustrated" | "tired";

export interface PreMarketCheck {
  id: string;
  date: string; // YYYY-MM-DD
  accountId: string;
  // 市场偏向
  bias: MarketBias;
  // 偏向理由
  biasReason: string;
  // 关键支撑位
  supportLevels: string;
  // 关键阻力位
  resistanceLevels: string;
  // 今日风险限额(美元或百分比)
  riskLimitType: "amount" | "percent";
  riskLimitValue: number;
  // 最大交易笔数
  maxTrades: number;
  // 关注品种(逗号分隔)
  watchlist: string;
  // 关注的经济数据
  economicEvents: string;
  // 当前情绪状态
  emotion: EmotionState;
  // 情绪备注
  emotionNote: string;
  // 交易计划
  planNotes: string;
  // 完成时间
  completedAt: string;
}

// =============== 仓位计算器历史 ===============
export interface PositionCalcRecord {
  id: string;
  timestamp: string;
  accountId: string;
  symbol: string;
  accountBalance: number;
  riskPercent: number;
  entryPrice: number;
  stopLossPrice: number;
  direction: Direction;
  // 计算结果
  riskAmount: number;
  stopDistancePips: number;
  positionSize: number; // 手数(lots)
  units: number;
}
