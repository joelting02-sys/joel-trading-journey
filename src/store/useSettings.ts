import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import type { Language, TranslationKeys } from "@/i18n/translations";
import { translations } from "@/i18n/translations";
import type {
  AiConfig,
  AiConfigEntry,
  SopRule,
  ChatMessage,
  SopProposal,
  CalendarPreferences,
  CalendarCountryCode,
  CalendarInstrumentCode,
  CalendarImportanceFilter,
  PreMarketCheck,
  PositionCalcRecord,
} from "@/types";
import {
  getLocation,
  saveSettingsToDisk,
  saveSopToDisk,
  loadSettingsFromDisk,
  loadSopFromDisk,
} from "@/services/dataStorage";
import { onDataMutation } from "@/services/syncService";

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

// 旧版英文默认规则的 ID 列表,用于判断是否需要迁移
const oldDefaultRuleIds = ["sop1", "sop2", "sop3", "sop4", "sop5", "sop6"];

// 从 store 状态中获取当前激活的 AI 配置,找不到时返回 null
export function getActiveAiConfig(state: { aiConfigs: AiConfigEntry[]; activeAiConfigId: string }): AiConfig | null {
  const entry = state.aiConfigs.find((c) => c.id === state.activeAiConfigId);
  if (!entry) return null;
  return { endpoint: entry.endpoint, apiKey: entry.apiKey, model: entry.model };
}

interface SettingsStore {
  language: Language;
  currency: CurrencyCode;
  // 多 AI 配置(替代旧版单一 aiConfig)
  aiConfigs: AiConfigEntry[];
  activeAiConfigId: string;
  sopRules: SopRule[];
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

  // 云端同步配置
  syncPasscode: string;
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
  
  setSyncPasscode: (code: string) => void;
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
      if (s.sopRules !== undefined) saveSopToDisk(s.sopRules).catch(() => {});
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
      sopRules: getDefaultSopRules("en"),
      chatMessages: [],
      calendarPrefs: defaultCalendarPrefs,
      calendarContent: "",
      calendarUpdatedAt: "",
      preMarketChecks: [],
      positionCalcHistory: [],
      
      syncPasscode: "",
      syncEnabled: false,
      lastSyncedAt: 0,
      clientUpdatedAt: 0,
      setSyncPasscode: (code) => set({ syncPasscode: code }),
      setSyncEnabled: (enabled) => set({ syncEnabled: enabled }),
      setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
      updateClientTimestamp: () => set({ clientUpdatedAt: Date.now() }),

      setLanguage: (lang) =>
        set((state) => {
          // 如果当前仍为默认规则,切换语言时同步替换为对应语言版本
          const isDefault =
            state.sopRules.length === oldDefaultRuleIds.length &&
            state.sopRules.every((r) => oldDefaultRuleIds.includes(r.id));
          return {
            language: lang,
            ...(isDefault ? { sopRules: getDefaultSopRules(lang) } : {}),
          };
        }),
      setCurrency: (cur) => set({ currency: cur }),
      // AI 配置管理 ============================================
      addAiConfigEntry: (entry) => {
        const id = `ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        set((state) => {
          const next = [...state.aiConfigs, { id, ...entry }];
          // 第一个添加的配置自动设为 active
          const activeAiConfigId = state.activeAiConfigId || id;
          return { aiConfigs: next, activeAiConfigId };
        });
        return id;
      },
      updateAiConfigEntry: (id, patch) =>
        set((state) => ({
          aiConfigs: state.aiConfigs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeAiConfigEntry: (id) =>
        set((state) => {
          const next = state.aiConfigs.filter((c) => c.id !== id);
          // 如果删的是当前激活的,自动切到第一个剩余的(若有)
          let activeAiConfigId = state.activeAiConfigId;
          if (activeAiConfigId === id) activeAiConfigId = next[0]?.id ?? "";
          return { aiConfigs: next, activeAiConfigId };
        }),
      setActiveAiConfigId: (id) => set({ activeAiConfigId: id }),
      // =========================================================
      setSopRules: (sopRules) => set({ sopRules }),
      setChatMessages: (chatMessages) => set({ chatMessages }),
      addSopRule: (rule) => {
        set((state) => ({ sopRules: [...state.sopRules, rule] }));
        onDataMutation();
      },
      updateSopRule: (rule) => {
        set((state) => ({
          sopRules: state.sopRules.map((r) => (r.id === rule.id ? rule : r)),
        }));
        onDataMutation();
      },
      deleteSopRule: (id) => {
        set((state) => ({ sopRules: state.sopRules.filter((r) => r.id !== id) }));
        onDataMutation();
      },
      // 一次性应用多个 AI 提议(按 add / update / remove 顺序处理)
      applySopProposals: (proposals) => {
        set((state) => {
          let rules = [...state.sopRules];
          // AI 提议的 category 可能为 "general",映射到 SopCategory(用 psychology 兜底)
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
          return { sopRules: rules };
        });
        onDataMutation();
      },
      addChatMessage: (msg) =>
        set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
      deleteChatMessage: (id) =>
        set((state) => ({ chatMessages: state.chatMessages.filter((m) => m.id !== id) })),
      clearChatMessages: () => set({ chatMessages: [] }),
      setCalendarPrefs: (calendarPrefs) => set({ calendarPrefs }),
      setCalendarContent: (content) => set({ calendarContent: content, calendarUpdatedAt: new Date().toISOString() }),
      addPreMarketCheck: (check) =>
        set((state) => ({ preMarketChecks: [check, ...state.preMarketChecks] })),
      deletePreMarketCheck: (id) =>
        set((state) => ({ preMarketChecks: state.preMarketChecks.filter((c) => c.id !== id) })),
      addPositionCalcRecord: (record) =>
        set((state) => ({ positionCalcHistory: [record, ...state.positionCalcHistory].slice(0, 50) })),
      deletePositionCalcRecord: (id) =>
        set((state) => ({ positionCalcHistory: state.positionCalcHistory.filter((r) => r.id !== id) })),
      t: () => translations[get().language] as unknown as TranslationKeys,

      // 从磁盘读取真实数据(覆盖 localStorage 旧值)
      hydrateFromDisk: async () => {
        const [sopRules, settings] = await Promise.all([
          loadSopFromDisk<SopRule[] | null>(null),
          loadSettingsFromDisk<{ language?: Language; currency?: string; aiConfigs?: AiConfigEntry[]; activeAiConfigId?: string; calendarPrefs?: CalendarPreferences; calendarContent?: string; calendarUpdatedAt?: string; preMarketChecks?: PreMarketCheck[]; positionCalcHistory?: PositionCalcRecord[] } | null>(null),
        ]);
        if (sopRules && sopRules.length > 0) set({ sopRules });
        if (settings) {
          if (settings.language) set({ language: settings.language });
          if (settings.currency) set({ currency: settings.currency as CurrencyCode });
          if (settings.aiConfigs) set({ aiConfigs: settings.aiConfigs });
          if (settings.activeAiConfigId !== undefined) set({ activeAiConfigId: settings.activeAiConfigId });
          if (settings.calendarPrefs) set({ calendarPrefs: settings.calendarPrefs });
          if (settings.calendarContent !== undefined) set({ calendarContent: settings.calendarContent });
          if (settings.calendarUpdatedAt !== undefined) set({ calendarUpdatedAt: settings.calendarUpdatedAt });
          if (settings.preMarketChecks) set({ preMarketChecks: settings.preMarketChecks });
          if (settings.positionCalcHistory) set({ positionCalcHistory: settings.positionCalcHistory });
        }
      },
    }),
    {
      name: "tj-settings-store",
      storage: settingsDualStorage,
      version: 6,
      // 持久化配置和聊天记录(聊天图片已压缩,不会超限)
      partialize: ((state: SettingsStore) => ({
        language: state.language,
        currency: state.currency,
        aiConfigs: state.aiConfigs,
        activeAiConfigId: state.activeAiConfigId,
        sopRules: state.sopRules,
        chatMessages: state.chatMessages,
        calendarPrefs: state.calendarPrefs,
        calendarContent: state.calendarContent,
        calendarUpdatedAt: state.calendarUpdatedAt,
        preMarketChecks: state.preMarketChecks,
        positionCalcHistory: state.positionCalcHistory,
        syncPasscode: state.syncPasscode,
        syncEnabled: state.syncEnabled,
        lastSyncedAt: state.lastSyncedAt,
        clientUpdatedAt: state.clientUpdatedAt,
      })) as (state: SettingsStore) => SettingsStore,
      migrate: ((persistedState: unknown, version: number) => {
        const s = persistedState as Partial<SettingsStore> & { aiConfig?: AiConfig };
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
        return s as unknown as SettingsStore;
      }) as (persistedState: unknown, version: number) => SettingsStore,
    }
  )
);
