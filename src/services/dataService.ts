// 交易/账户的 Supabase 数据访问层
import { supabase } from "@/lib/supabase";
import type { Trade, Account, SopRule, ChatMessage, AiConfig } from "@/types";
import type { Language } from "@/i18n/translations";

// ===== 类型映射(数据库行 -> 前端模型) =====
interface DbAccount {
  id: string;
  user_id: string;
  name: string;
  broker: string;
  balance: number;
  equity: number;
  currency: string;
  created_at: string;
}

interface DbTrade {
  id: string;
  user_id: string;
  account_id: string | null;
  symbol: string;
  direction: "long" | "short";
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  pnl_percent: number;
  fee: number | null;
  open_date: string;
  close_date: string;
  status: "open" | "closed";
  notes: string | null;
  created_at: string;
}

interface DbSopRule {
  id: string;
  user_id: string;
  category: "entry" | "exit" | "risk" | "psychology";
  title: string;
  description: string;
}

interface DbUserSettings {
  user_id: string;
  language: string;
  currency: string;
  ai_endpoint: string;
  ai_key: string;
  ai_model: string;
  chat_messages: ChatMessage[];
}

function dbToTrade(row: DbTrade): Trade {
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    entryPrice: Number(row.entry_price),
    exitPrice: Number(row.exit_price),
    quantity: Number(row.quantity),
    pnl: Number(row.pnl),
    pnlPercent: Number(row.pnl_percent),
    fee: row.fee != null ? Number(row.fee) : undefined,
    openDate: row.open_date,
    closeDate: row.close_date,
    status: row.status,
    notes: row.notes ?? undefined,
    account: row.account_id ?? "",
  };
}

function tradeToDb(trade: Trade, userId: string): Partial<DbTrade> {
  return {
    id: trade.id,
    user_id: userId,
    account_id: trade.account || null,
    symbol: trade.symbol,
    direction: trade.direction,
    entry_price: trade.entryPrice,
    exit_price: trade.exitPrice,
    quantity: trade.quantity,
    pnl: trade.pnl,
    pnl_percent: trade.pnlPercent,
    fee: trade.fee ?? null,
    open_date: trade.openDate,
    close_date: trade.closeDate,
    status: trade.status,
    notes: trade.notes ?? null,
  };
}

function dbToAccount(row: DbAccount): Account {
  return {
    id: row.id,
    name: row.name,
    broker: row.broker,
    balance: Number(row.balance),
    equity: Number(row.equity),
    currency: row.currency,
  };
}

function accountToDb(acc: Account, userId: string): Partial<DbAccount> {
  return {
    id: acc.id,
    user_id: userId,
    name: acc.name,
    broker: acc.broker,
    balance: acc.balance,
    equity: acc.equity,
    currency: acc.currency,
  };
}

// ===== Accounts =====
export async function fetchAccounts(userId: string): Promise<Account[]> {
  console.log("[dataService] fetchAccounts userId:", userId);
  const { data, error, status, statusText } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  console.log("[dataService] fetchAccounts result:", { data, error, status, statusText, count: data?.length });
  if (error) throw error;
  return (data ?? []).map(dbToAccount);
}

export async function upsertAccount(acc: Account, userId: string): Promise<void> {
  const payload = accountToDb(acc, userId);
  console.log("[dataService] upsertAccount payload:", payload);
  const { data, error, status, statusText } = await supabase
    .from("accounts")
    .upsert(payload)
    .select();
  console.log("[dataService] upsertAccount result:", { data, error, status, statusText });
  if (error) throw error;
}

export async function deleteAccountFromDb(id: string): Promise<void> {
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
}

// ===== Trades =====
export async function fetchTrades(userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .order("open_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(dbToTrade);
}

export async function upsertTrade(trade: Trade, userId: string): Promise<void> {
  const { error } = await supabase
    .from("trades")
    .upsert(tradeToDb(trade, userId));
  if (error) throw error;
}

export async function deleteTradeFromDb(id: string): Promise<void> {
  const { error } = await supabase.from("trades").delete().eq("id", id);
  if (error) throw error;
}

// ===== SOP =====
export async function fetchSopRules(userId: string): Promise<SopRule[]> {
  const { data, error } = await supabase
    .from("sop_rules")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: DbSopRule) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    description: r.description,
  }));
}

export async function upsertSopRule(rule: SopRule, userId: string): Promise<void> {
  const { error } = await supabase
    .from("sop_rules")
    .upsert({ ...rule, user_id: userId });
  if (error) throw error;
}

export async function deleteSopRuleFromDb(id: string): Promise<void> {
  const { error } = await supabase.from("sop_rules").delete().eq("id", id);
  if (error) throw error;
}

// ===== User Settings =====
export async function fetchUserSettings(userId: string): Promise<{
  language: Language;
  currency: string;
  aiConfig: AiConfig;
  chatMessages: ChatMessage[];
} | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as DbUserSettings;
  return {
    language: (row.language as Language) ?? "en",
    currency: row.currency ?? "USD",
    aiConfig: {
      endpoint: row.ai_endpoint ?? "",
      apiKey: row.ai_key ?? "",
      model: row.ai_model ?? "",
    },
    chatMessages: row.chat_messages ?? [],
  };
}

export async function upsertUserSettings(
  userId: string,
  settings: {
    language: Language;
    currency: string;
    aiConfig: AiConfig;
    chatMessages: ChatMessage[];
  }
): Promise<void> {
  const { error } = await supabase
    .from("user_settings")
    .upsert({
      user_id: userId,
      language: settings.language,
      currency: settings.currency,
      ai_endpoint: settings.aiConfig.endpoint,
      ai_key: settings.aiConfig.apiKey,
      ai_model: settings.aiConfig.model,
      chat_messages: settings.chatMessages,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}
