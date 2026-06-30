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
  account: string;
}

// 账户
export interface Account {
  id: string;
  name: string;
  broker: string;
  balance: number;
  equity: number;
  currency: string;
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

// 聊天消息角色
export type ChatRole = "user" | "assistant" | "system";

// 聊天消息
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  imageUrl?: string;
  timestamp: string;
  extractedTrade?: Partial<Trade>;
  extractedTrades?: Partial<Trade>[];
}
