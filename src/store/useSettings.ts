import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/i18n/translations";
import { translations } from "@/i18n/translations";
import type { AiConfig, SopRule, ChatMessage } from "@/types";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "MYR";

// 默认 SOP 规则
const defaultSopRules: SopRule[] = [
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

interface SettingsStore {
  language: Language;
  currency: CurrencyCode;
  aiConfig: AiConfig;
  sopRules: SopRule[];
  chatMessages: ChatMessage[];
  setLanguage: (lang: Language) => void;
  setCurrency: (cur: CurrencyCode) => void;
  setAiConfig: (config: Partial<AiConfig>) => void;
  setSopRules: (rules: SopRule[]) => void;
  setChatMessages: (msgs: ChatMessage[]) => void;
  addSopRule: (rule: SopRule) => void;
  updateSopRule: (rule: SopRule) => void;
  deleteSopRule: (id: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChatMessages: () => void;
  t: () => (typeof translations)["en"];
}

// 使用 persist 保存到 localStorage，修改系统代码后配置不会丢失
export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      language: "en",
      currency: "USD",
      aiConfig: {
        endpoint: "",
        apiKey: "",
        model: "",
      },
      sopRules: defaultSopRules,
      chatMessages: [],
      setLanguage: (lang) => set({ language: lang }),
      setCurrency: (cur) => set({ currency: cur }),
      setAiConfig: (config) =>
        set((state) => ({ aiConfig: { ...state.aiConfig, ...config } })),
      setSopRules: (sopRules) => set({ sopRules }),
      setChatMessages: (chatMessages) => set({ chatMessages }),
      addSopRule: (rule) =>
        set((state) => ({ sopRules: [...state.sopRules, rule] })),
      updateSopRule: (rule) =>
        set((state) => ({
          sopRules: state.sopRules.map((r) => (r.id === rule.id ? rule : r)),
        })),
      deleteSopRule: (id) =>
        set((state) => ({ sopRules: state.sopRules.filter((r) => r.id !== id) })),
      addChatMessage: (msg) =>
        set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
      clearChatMessages: () => set({ chatMessages: [] }),
      t: () => translations[get().language] as (typeof translations)["en"],
    }),
    {
      name: "tj-settings-store",
      // 持久化所有配置，但不持久化聊天记录（太大）
      partialize: (state) => ({
        language: state.language,
        currency: state.currency,
        aiConfig: state.aiConfig,
        sopRules: state.sopRules,
      }),
    }
  )
);
