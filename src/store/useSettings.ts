import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import type { Language, TranslationKeys } from "@/i18n/translations";
import { translations } from "@/i18n/translations";
import type {
  AiConfig,
  AiConfigEntry,
  SopSet,
  SopRule,
  ChatMessage,
  SopProposal,
  CalendarPreferences,
  CalendarCountryCode,
  CalendarInstrumentCode,
  CalendarImportanceFilter,
  PreMarketCheck,
  PositionCalcRecord,
  DrawdownEvent,
} from "@/types";
import {
  getLocation,
  saveSettingsToDisk,
  saveSopToDisk,
  loadSettingsFromDisk,
  loadSopFromDisk,
} from "@/services/dataStorage";
import { onDataMutation } from "@/services/supabaseService";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "MYR";

// 默认经济日历偏好
const defaultCalendarPrefs: CalendarPreferences = {
  countries: ["US", "EU", "AU", "GB", "JP", "CN"] as CalendarCountryCode[],
  instruments: ["EURUSD", "AUDUSD", "XAUUSD", "GBPJPY", "US500"] as CalendarInstrumentCode[],
  importance: "medium_and_high" as CalendarImportanceFilter,
  includeBankHolidays: true,
  includeSentiment: true,
};

// 默认 SOP 规则(按语言区分)
const defaultSopRulesEn: SopRule[] = [
  {
    id: "sop1",
    category: "entry",
    title: "Trend Confirmation",
    description: "Only enter trades in the direction of the H4 trend. Price must be above/below EMA 50.",
  },
  {
    id: "sop2",
    category: "entry",
    title: "Confluence Required",
    description: "At least 2 confluence factors (support/resistance, candlestick pattern, indicator signal) before entry.",
  },
  {
    id: "sop3",
    category: "risk",
    title: "Risk Per Trade",
    description: "Maximum 1% account risk per trade. Stop loss must be set before entry.",
  },
  {
    id: "sop4",
    category: "risk",
    title: "Daily Loss Limit",
    description: "Stop trading after 3 consecutive losses or 3% daily drawdown.",
  },
  {
    id: "sop5",
    category: "exit",
    title: "Partial Profit",
    description: "Take 50% profit at 1R, move stop to breakeven. Let the rest run to 2R minimum.",
  },
  {
    id: "sop6",
    category: "psychology",
    title: "No Revenge Trading",
    description: "After a loss, wait at least 15 minutes before analyzing the next setup. No impulsive entries.",
  },
];

const defaultSopRulesZh: SopRule[] = [
  {
    id: "sop1",
    category: "entry",
    title: "顺势交易",
    description: "仅顺 H4 趋势方向进场。价格必须在 EMA 50 上方/下方。",
  },
  {
    id: "sop2",
    category: "entry",
    title: "多重确认",
    description: "进场前至少需要 2 个共振因素（支撑/阻力、K 线形态、指标信号）。",
  },
  {
    id: "sop3",
    category: "risk",
    title: "单笔风险",
    description: "每笔交易最大风险 1%账户资金。进场前必须设置止损。",
  },
  {
    id: "sop4",
    category: "risk",
    title: "每日亏损上限",
    description: "连续亏损 3 笔或日内回撤 3% 后停止交易。",
  },
  {
    id: "sop5",
    category: "exit",
    title: "部分止盈",
    description: "在 1R 处止盈 50%，止损移至保本。剩余仓位至少持有到 2R。",
  },
  {
    id: "sop6",
    category: "psychology",
    title: "禁止报复交易",
    description: "亏损后至少等待 15 分钟再分析下一个机会。禁止冲动进场。",
  },
];

function getDefaultSopRules(lang: Language): SopRule[] {
  return lang === "zh" ? defaultSopRulesZh : defaultSopRulesEn;
}

function buildDefaultSopSet(lang: Language): SopSet {
  return {
    id: "sop-default",
    name: lang === "zh" ? "默认 SOP" : "Default SOP",
    rules: getDefaultSopRules(lang),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// 旧版英文默认规则的 ID 列表,用于判断是否需要迁移
const oldDefaultRuleIds = ["sop1", "sop2", "sop3", "sop4", "sop5", "sop6"];

// 从 store 状态中获取当前激活的 AI 配置,找不到时返回 null
export function getActiveAiConfig(state: { aiConfigs: AiConfigEntry[]; activeAiConfigId: string }): AiConfig | null {
  const entry = state.aiConfigs.find((c) => c.id === state.activeAiConfigId);
  if (!entry) return null;
  return { endpoint: entry.endpoint, apiKey: entry.apiKey, model: entry.model };
}

export function getActiveSopRules(state: { sopSets: SopSet[]; activeSopSetId: string }): SopRule[] {
  const set = state.sopSets.find((s) => s.id === state.activeSopSetId);
  return set ? set.rules : state.sopSets[0]?.rules ?? [];
}

export function getSopSetById(state: { sopSets: SopSet[] }, id: string): SopSet | undefined {
  return state.sopSets.find((s) => s.id === id);
}

interface SettingsStore {
  language: Language;
  currency: CurrencyCode;
  // 多 AI 配置(替代旧版单一 aiConfig)
  aiConfigs: AiConfigEntry[];
  activeAiConfigId: string;
  sopSets: SopSet[];
  activeSopSetId: string;
  chatMessages: ChatMessage[];
  // 经济日历偏好
  calendarPrefs: CalendarPreferences;
  // AI 生成的经济日历内容(持久化,用户手动刷新才更新)
  calendarContent: string;
  calendarUpdatedAt: string;
  // 开盘前 Checklist 历史
  preMarketChecks: PreMarketCheck[];
  // 仓位计算器历史
  positionCalcHistory: PositionCalcRecord[];
  // 回撤事件记录(用户手动复盘用)
  drawdownEvents: DrawdownEvent[];
  // 自定义品种
  customSymbols: string[];
  // 用户头像
  avatarUrl: string;

  // 云端同步配置
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseUserEmail: string;
  supabaseSessionToken: string;
  syncEnabled: boolean;
  lastSyncedAt: number;
  clientUpdatedAt: number;

  setLanguage: (lang: Language) => void;
  setCurrency: (cur: CurrencyCode) => void;
  // AI 配置管理
  addAiConfigEntry: (entry: Omit<AiConfigEntry, "id">) => string;
  updateAiConfigEntry: (id: string, patch: Partial<Omit<AiConfigEntry, "id">>) => void;
  removeAiConfigEntry: (id: string) => void;
  setActiveAiConfigId: (id: string) => void;
  setSopSets: (sets: SopSet[]) => void;
  setActiveSopSetId: (id: string) => void;
  addSopSet: (set: SopSet) => void;
  renameSopSet: (id: string, name: string) => void;
  deleteSopSet: (id: string) => void;
  setSopRules: (rules: SopRule[]) => void;
  setChatMessages: (msgs: ChatMessage[]) => void;
  addSopRule: (rule: SopRule) => void;
  updateSopRule: (rule: SopRule) => void;
  deleteSopRule: (id: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  deleteChatMessage: (id: string) => void;
  clearChatMessages: () => void;
  applySopProposals: (proposals: SopProposal[]) => void;
  setCalendarPrefs: (prefs: CalendarPreferences) => void;
  setCalendarContent: (content: string) => void;
  addPreMarketCheck: (check: PreMarketCheck) => void;
  deletePreMarketCheck: (id: string) => void;
  addPositionCalcRecord: (record: PositionCalcRecord) => void;
  deletePositionCalcRecord: (id: string) => void;
  addDrawdownEvent: (event: DrawdownEvent) => void;
  updateDrawdownEvent: (event: DrawdownEvent) => void;
  deleteDrawdownEvent: (id: string) => void;
  addCustomSymbol: (symbol: string) => void;
  removeCustomSymbol: (symbol: string) => void;
  setAvatarUrl: (url: string) => void;
  
  setSupabaseUrl: (url: string) => void;
  setSupabaseAnonKey: (key: string) => void;
  setSupabaseUserEmail: (email: string) => void;
  setSupabaseSessionToken: (token: string) => void;
  setSyncEnabled: (enabled: boolean) => void;
  setLastSyncedAt: (ts: number) => void;
  updateClientTimestamp: () => void;

  t: () => TranslationKeys;
  hydrateFromDisk: () => Promise<void>;
}

// 同时写 localStorage(offline 缓存) + 本地 JSON 文件(真·持久化)
const settingsDualStorage: PersistStorage<SettingsStore> = {
  getItem: (name) => {
    const raw = localStorage.getItem(name);
    return raw ? (JSON.parse(raw) as StorageValue<SettingsStore>) : null;
  },
  setItem: (name, value) => {
    localStorage.setItem(name, JSON.stringify(value));
    if (getLocation() === "filesystem" && value.state) {
      const s = value.state;
      if (s.sopSets !== undefined) saveSopToDisk(s.sopSets).catch(() => {});
      // settings 包含 language/currency/aiConfigs/calendarPrefs,统一存一份
      const settings = {
        language: s.language,
        currency: s.currency,
        aiConfigs: s.aiConfigs,
        activeAiConfigId: s.activeAiConfigId,
        calendarPrefs: s.calendarPrefs,
        calendarContent: s.calendarContent,
        calendarUpdatedAt: s.calendarUpdatedAt,
        preMarketChecks: s.preMarketChecks,
        positionCalcHistory: s.positionCalcHistory,
        drawdownEvents: s.drawdownEvents,
      };
      saveSettingsToDisk(settings).catch(() => {});
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
};

// 使用 persist 保存到 localStorage,修改系统代码后配置不会丢失
export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      language: "en",
      currency: "USD",
      aiConfigs: [],
      activeAiConfigId: "",
      sopSets: [buildDefaultSopSet("en")],
      activeSopSetId: "sop-default",
      chatMessages: [],
      calendarPrefs: defaultCalendarPrefs,
      calendarContent: "",
      calendarUpdatedAt: "",
      preMarketChecks: [],
      drawdownEvents: [],
      customSymbols: [],
      avatarUrl: "",
      positionCalcHistory: [],
      
      supabaseUrl: "https://imemwbgtxnkfodncfgal.supabase.co",
      supabaseAnonKey: "sb_publishable_CWNd8zRNESxUvpNZ7BA16Q_UA1DjMuO",
      supabaseUserEmail: "",
      supabaseSessionToken: "",
      syncEnabled: false,
      lastSyncedAt: 0,
      clientUpdatedAt: 0,
      setSupabaseUrl: (url) => set({ supabaseUrl: url }),
      setSupabaseAnonKey: (key) => set({ supabaseAnonKey: key }),
      setSupabaseUserEmail: (email) => set({ supabaseUserEmail: email }),
      setSupabaseSessionToken: (token) => set({ supabaseSessionToken: token }),
      setSyncEnabled: (enabled) => set({ syncEnabled: enabled }),
      setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
      updateClientTimestamp: () => set({ clientUpdatedAt: Date.now() }),

      setLanguage: (lang) => {
        set((state) => {
          const activeSet = state.sopSets.find((s) => s.id === state.activeSopSetId);
          if (!activeSet) return { language: lang };
          const isDefault =
            activeSet.rules.length === oldDefaultRuleIds.length &&
            activeSet.rules.every((r) => oldDefaultRuleIds.includes(r.id));
          if (!isDefault) return { language: lang };
          const updatedSet = { ...activeSet, rules: getDefaultSopRules(lang), name: lang === "zh" ? "默认 SOP" : "Default SOP", updatedAt: Date.now() };
          return {
            language: lang,
            sopSets: state.sopSets.map((s) => (s.id === updatedSet.id ? updatedSet : s)),
          };
        });
        onDataMutation();
      },
      setCurrency: (cur) => {
        set({ currency: cur });
        onDataMutation();
      },
      // AI 配置管理 ============================================
      addAiConfigEntry: (entry) => {
        const id = `ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        set((state) => {
          const next = [...state.aiConfigs, { id, ...entry }];
          // 第一个添加的配置自动设为 active
          const activeAiConfigId = state.activeAiConfigId || id;
          return { aiConfigs: next, activeAiConfigId };
        });
        onDataMutation();
        return id;
      },
      updateAiConfigEntry: (id, patch) => {
        set((state) => ({
          aiConfigs: state.aiConfigs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
        onDataMutation();
      },
      removeAiConfigEntry: (id) => {
        set((state) => {
          const next = state.aiConfigs.filter((c) => c.id !== id);
          // 如果删的是当前激活的,自动切到第一个剩余的(若有)
          let activeAiConfigId = state.activeAiConfigId;
          if (activeAiConfigId === id) activeAiConfigId = next[0]?.id ?? "";
          return { aiConfigs: next, activeAiConfigId };
        });
        onDataMutation();
      },
      setActiveAiConfigId: (id) => {
        set({ activeAiConfigId: id });
        onDataMutation();
      },
      // =========================================================
      setSopSets: (sopSets) => set({ sopSets }),
      setActiveSopSetId: (id) => {
        set({ activeSopSetId: id });
        onDataMutation();
      },
      addSopSet: (sopSet) => {
        set((state) => ({ sopSets: [...state.sopSets, sopSet] }));
        onDataMutation();
      },
      renameSopSet: (id, name) => {
        set((state) => ({
          sopSets: state.sopSets.map((s) => (s.id === id ? { ...s, name, updatedAt: Date.now() } : s)),
        }));
        onDataMutation();
      },
      deleteSopSet: (id) => {
        set((state) => {
          if (state.sopSets.length <= 1) return state;
          const next = state.sopSets.filter((s) => s.id !== id);
          const activeSopSetId = state.activeSopSetId === id ? next[0]?.id ?? "" : state.activeSopSetId;
          return { sopSets: next, activeSopSetId };
        });
        onDataMutation();
      },
      setSopRules: (rules) => {
        set((state) => ({
          sopSets: state.sopSets.map((s) =>
            s.id === state.activeSopSetId ? { ...s, rules, updatedAt: Date.now() } : s
          ),
        }));
      },
      setChatMessages: (chatMessages) => set({ chatMessages }),
      addSopRule: (rule) => {
        set((state) => ({
          sopSets: state.sopSets.map((s) =>
            s.id === state.activeSopSetId ? { ...s, rules: [...s.rules, rule], updatedAt: Date.now() } : s
          ),
        }));
        onDataMutation();
      },
      updateSopRule: (rule) => {
        set((state) => ({
          sopSets: state.sopSets.map((s) =>
            s.id === state.activeSopSetId
              ? { ...s, rules: s.rules.map((r) => (r.id === rule.id ? rule : r)), updatedAt: Date.now() }
              : s
          ),
        }));
        onDataMutation();
      },
      deleteSopRule: (id) => {
        set((state) => ({
          sopSets: state.sopSets.map((s) =>
            s.id === state.activeSopSetId
              ? { ...s, rules: s.rules.filter((r) => r.id !== id), updatedAt: Date.now() }
              : s
          ),
        }));
        onDataMutation();
      },
      applySopProposals: (proposals) => {
        set((state) => {
          const activeSet = state.sopSets.find((s) => s.id === state.activeSopSetId);
          if (!activeSet) return state;
          let rules = [...activeSet.rules];
          const toCategory = (c: SopProposal["category"]): SopRule["category"] => {
            if (c === "entry" || c === "exit" || c === "risk" || c === "psychology") return c;
            return "psychology";
          };
          for (const p of proposals) {
            if (p.action === "add") {
              const newRule: SopRule = {
                id: p.id || `sop${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                category: toCategory(p.category),
                title: p.title,
                description: p.description,
              };
              rules.push(newRule);
            } else if (p.action === "update" && p.ruleId) {
              rules = rules.map((r) =>
                r.id === p.ruleId
                  ? { ...r, category: toCategory(p.category), title: p.title, description: p.description }
                  : r
              );
            } else if (p.action === "remove" && p.ruleId) {
              rules = rules.filter((r) => r.id !== p.ruleId);
            }
          }
          return {
            sopSets: state.sopSets.map((s) =>
              s.id === state.activeSopSetId ? { ...s, rules, updatedAt: Date.now() } : s
            ),
          };
        });
        onDataMutation();
      },
      addChatMessage: (msg) =>
        set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
      deleteChatMessage: (id) =>
        set((state) => ({ chatMessages: state.chatMessages.filter((m) => m.id !== id) })),
      clearChatMessages: () => set({ chatMessages: [] }),
      setCalendarPrefs: (calendarPrefs) => {
        set({ calendarPrefs });
        onDataMutation();
      },
      setCalendarContent: (content) => {
        set({ calendarContent: content, calendarUpdatedAt: new Date().toISOString() });
        onDataMutation();
      },
      addPreMarketCheck: (check) => {
        set((state) => ({ preMarketChecks: [check, ...state.preMarketChecks] }));
        onDataMutation();
      },
      deletePreMarketCheck: (id) => {
        set((state) => ({ preMarketChecks: state.preMarketChecks.filter((c) => c.id !== id) }));
        onDataMutation();
      },
      addPositionCalcRecord: (record) => {
        set((state) => ({ positionCalcHistory: [record, ...state.positionCalcHistory].slice(0, 50) }));
        onDataMutation();
      },
      deletePositionCalcRecord: (id) => {
        set((state) => ({ positionCalcHistory: state.positionCalcHistory.filter((r) => r.id !== id) }));
        onDataMutation();
      },
      addDrawdownEvent: (event) => {
        set((state) => ({ drawdownEvents: [event, ...state.drawdownEvents] }));
        onDataMutation();
      },
      updateDrawdownEvent: (event) => {
        set((state) => ({
          drawdownEvents: state.drawdownEvents.map((e) => (e.id === event.id ? event : e)),
        }));
        onDataMutation();
      },
      deleteDrawdownEvent: (id) => {
        set((state) => ({ drawdownEvents: state.drawdownEvents.filter((e) => e.id !== id) }));
        onDataMutation();
      },
      addCustomSymbol: (symbol) => {
        const sym = symbol.trim().toUpperCase();
        if (!sym) return;
        set((state) => {
          if (state.customSymbols.includes(sym)) return state;
          return { customSymbols: [...state.customSymbols, sym] };
        });
        onDataMutation();
      },
      removeCustomSymbol: (symbol) => {
        set((state) => ({ customSymbols: state.customSymbols.filter((s) => s !== symbol) }));
        onDataMutation();
      },
      setAvatarUrl: (url) => {
        set({ avatarUrl: url });
        onDataMutation();
      },
      t: () => translations[get().language] as unknown as TranslationKeys,

      // 从磁盘读取真实数据(覆盖 localStorage 旧值)
      hydrateFromDisk: async () => {
        const [sopData, settings] = await Promise.all([
          loadSopFromDisk<SopRule[] | SopSet[] | null>(null),
          loadSettingsFromDisk<{ language?: Language; currency?: string; aiConfigs?: AiConfigEntry[]; activeAiConfigId?: string; calendarPrefs?: CalendarPreferences; calendarContent?: string; calendarUpdatedAt?: string; preMarketChecks?: PreMarketCheck[]; positionCalcHistory?: PositionCalcRecord[]; drawdownEvents?: DrawdownEvent[]; sopSets?: SopSet[]; activeSopSetId?: string } | null>(null),
        ]);
        if (sopData && sopData.length > 0) {
          const first = sopData[0] as SopRule | SopSet;
          if ("rules" in first && Array.isArray((first as SopSet).rules)) {
            const loadedSets = sopData as SopSet[];
            set({ sopSets: loadedSets });
          } else {
            set({ sopSets: [{ id: "sop-default", name: "Default SOP", rules: sopData as SopRule[], createdAt: Date.now(), updatedAt: Date.now() }] });
          }
        }
        if (settings) {
          if (settings.sopSets && settings.sopSets.length > 0) set({ sopSets: settings.sopSets });
          if (settings.activeSopSetId) set({ activeSopSetId: settings.activeSopSetId });
          if (settings.language) set({ language: settings.language });
          if (settings.currency) set({ currency: settings.currency as CurrencyCode });
          if (settings.aiConfigs) set({ aiConfigs: settings.aiConfigs });
          if (settings.activeAiConfigId !== undefined) set({ activeAiConfigId: settings.activeAiConfigId });
          if (settings.calendarPrefs) set({ calendarPrefs: settings.calendarPrefs });
          if (settings.calendarContent !== undefined) set({ calendarContent: settings.calendarContent });
          if (settings.calendarUpdatedAt !== undefined) set({ calendarUpdatedAt: settings.calendarUpdatedAt });
          if (settings.preMarketChecks) set({ preMarketChecks: settings.preMarketChecks });
          if (settings.positionCalcHistory) set({ positionCalcHistory: settings.positionCalcHistory });
          if (settings.drawdownEvents) set({ drawdownEvents: settings.drawdownEvents });
        }
      },
    }),
    {
      name: "tj-settings-store",
      storage: settingsDualStorage,
      version: 9,
      // 持久化配置和聊天记录(聊天图片已压缩,不会超限)
      partialize: ((state: SettingsStore) => ({
        language: state.language,
        currency: state.currency,
        aiConfigs: state.aiConfigs,
        activeAiConfigId: state.activeAiConfigId,
        sopSets: state.sopSets,
        activeSopSetId: state.activeSopSetId,
        chatMessages: state.chatMessages,
        calendarPrefs: state.calendarPrefs,
        calendarContent: state.calendarContent,
        calendarUpdatedAt: state.calendarUpdatedAt,
        preMarketChecks: state.preMarketChecks,
        positionCalcHistory: state.positionCalcHistory,
        drawdownEvents: state.drawdownEvents,
        customSymbols: state.customSymbols,
        avatarUrl: state.avatarUrl,
        supabaseUrl: state.supabaseUrl,
        supabaseAnonKey: state.supabaseAnonKey,
        supabaseUserEmail: state.supabaseUserEmail,
        supabaseSessionToken: state.supabaseSessionToken,
        syncEnabled: state.syncEnabled,
        lastSyncedAt: state.lastSyncedAt,
        clientUpdatedAt: state.clientUpdatedAt,
      })) as (state: SettingsStore) => SettingsStore,
      migrate: ((persistedState: unknown, version: number) => {
        const s = persistedState as Partial<SettingsStore> & { aiConfig?: AiConfig; syncPasscode?: string; sopRules?: SopRule[] };
        // 从 v1 迁移: 如果用户仍在使用旧版英文默认规则,替换为当前语言的版本
        if (version < 2 && s.sopRules && s.language) {
          const isOldDefault =
            s.sopRules.length === oldDefaultRuleIds.length &&
            s.sopRules.every((r) => oldDefaultRuleIds.includes(r.id));
          if (isOldDefault) {
            s.sopRules = getDefaultSopRules(s.language);
          }
        }
        // v2→v3: 聊天记录之前不持久化,v3 起新增持久化,无需迁移
        if (!s.chatMessages) s.chatMessages = [];
        // v3→v4: 把旧版单一 aiConfig 转换成新的 aiConfigs[] 列表
        if (version < 4) {
          if (!s.aiConfigs) s.aiConfigs = [];
          if (!s.activeAiConfigId) s.activeAiConfigId = "";
          if (s.aiConfigs.length === 0 && s.aiConfig) {
            // 把旧版单一配置迁移为列表的第一项
            const legacy = s.aiConfig;
            if (legacy.endpoint || legacy.apiKey || legacy.model) {
              const id = `ai_legacy_${Date.now()}`;
              // name 用 model 兜底
              const name = legacy.model || "Default";
              s.aiConfigs = [{ id, name, ...legacy }];
              s.activeAiConfigId = id;
            }
          }
          // 清掉旧字段
          delete s.aiConfig;
        }
        // v4→v5: 新增经济日历偏好(calendarPrefs)
        if (version < 5) {
          s.calendarPrefs = defaultCalendarPrefs;
          s.calendarContent = "";
          s.calendarUpdatedAt = "";
          s.preMarketChecks = [];
          s.positionCalcHistory = [];
        }
        // v5→v6: 新增同步配置
        if (version < 6) {
          s.syncPasscode = "";
          s.syncEnabled = false;
          s.lastSyncedAt = 0;
          s.clientUpdatedAt = 0;
        }
        // v6→v7: 迁移到 Supabase 凭据并清理旧的 syncPasscode
        if (version < 7) {
          s.supabaseUrl = "";
          s.supabaseAnonKey = "";
          s.supabaseUserEmail = "";
          s.supabaseSessionToken = "";
          if (s.syncPasscode) {
            delete s.syncPasscode;
          }
        }
        // v7→v8: sopRules → sopSets + activeSopSetId
        if (version < 8) {
          const oldRules = (s as Record<string, unknown>).sopRules as SopRule[] | undefined;
          if (Array.isArray(oldRules) && oldRules.length > 0) {
            s.sopSets = [{ id: "sop-default", name: "Default SOP", rules: oldRules, createdAt: Date.now(), updatedAt: Date.now() }];
          } else if (!s.sopSets) {
            s.sopSets = [buildDefaultSopSet((s.language as Language) || "en")];
          }
          s.activeSopSetId = "sop-default";
          delete (s as Record<string, unknown>).sopRules;
        }
        // v8→v9: 新增 drawdownEvents(回撤事件日志)
        if (version < 9) {
          s.drawdownEvents = [];
        }
        return s as unknown as SettingsStore;
      }) as (persistedState: unknown, version: number) => SettingsStore,
    }
  )
);
