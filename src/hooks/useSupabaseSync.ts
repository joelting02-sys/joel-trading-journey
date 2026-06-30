// 监听本地 store 变化,自动同步到 Supabase
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  upsertTrade,
  deleteTradeFromDb,
  upsertAccount,
  deleteAccountFromDb,
  upsertSopRule,
  deleteSopRuleFromDb,
  upsertUserSettings,
} from "@/services/dataService";

export function useSupabaseSync() {
  const { user } = useAuth();
  const prevTradesRef = useRef(useTradeStore.getState().trades);
  const prevAccountsRef = useRef(useTradeStore.getState().accounts);
  const prevSopRef = useRef(useSettings.getState().sopRules);
  const prevSettingsRef = useRef({
    language: useSettings.getState().language,
    currency: useSettings.getState().currency,
    aiConfig: useSettings.getState().aiConfig,
    chatMessages: useSettings.getState().chatMessages,
  });

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;

    console.log("[sync] 启动同步, user:", user.id);

    // 先加载云端数据到本地
    useEffect(() => {
      if (!user || !isSupabaseConfigured()) return;
      const loadFromSupabase = async () => {
        try {
          const [accounts, trades, sopRules, settings] = await Promise.all([
            fetchAccounts(user.id),
            fetchTrades(user.id),
            fetchSopRules(user.id),
            fetchUserSettings(user.id),
          ]);
          console.log("[sync] 从 Supabase 加载:", {
            accounts: accounts.length,
            trades: trades.length,
            sopRules: sopRules.length,
            settings: settings ? "有" : "无",
          });
          useTradeStore.getState().setAccounts(accounts);
          useTradeStore.getState().setTrades(trades);
          useSettings.getState().setSopRules(sopRules);
          if (settings) {
            useSettings.getState().setLanguage(settings.language);
            useSettings.getState().setCurrency(settings.currency as "USD" | "EUR" | "GBP" | "JPY" | "MYR");
            useSettings.getState().setAiConfig(settings.aiConfig);
            useSettings.getState().setChatMessages(settings.chatMessages);
          }
        } catch (err) {
          console.error("[sync] ❌ 加载数据失败:", err);
        }
      };
      loadFromSupabase();
    }, [user]);

    // Trade 同步
    const unsubTrades = useTradeStore.subscribe((state) => {
      const prev = prevTradesRef.current;
      const next = state.trades;
      const nextIds = new Set(next.map((t) => t.id));
      const prevIds = new Set(prev.map((t) => t.id));
      // 新增或更新
      next.forEach((t) => {
        if (!prevIds.has(t.id) || prev.find((p) => p.id === t.id) !== t) {
          console.log("[sync] upsert trade:", t.id, t.symbol, "→ user:", user.id);
          upsertTrade(t, user.id)
            .then(() => console.log("[sync] ✅ trade saved:", t.id))
            .catch((e) => console.error("[sync] ❌ trade upsert failed:", e));
        }
      });
      // 删除
      prev.forEach((t) => {
        if (!nextIds.has(t.id)) {
          console.log("[sync] delete trade:", t.id);
          deleteTradeFromDb(t.id).catch((e) => console.error("[sync] ❌ trade delete failed:", e));
        }
      });
      prevTradesRef.current = next;
    });

    // Account 同步
    const unsubAccounts = useTradeStore.subscribe((state) => {
      const prev = prevAccountsRef.current;
      const next = state.accounts;
      const nextIds = new Set(next.map((a) => a.id));
      const prevIds = new Set(prev.map((a) => a.id));
      next.forEach((a) => {
        if (!prevIds.has(a.id) || prev.find((p) => p.id === a.id) !== a) {
          console.log("[sync] upsert account:", a.id, a.name, "→ user:", user.id);
          upsertAccount(a, user.id)
            .then(() => {
              console.log("[sync] ✅ account saved:", a.id);
              // 确保本地数据和云端一致
              const updatedAccounts = [...next];
              useTradeStore.getState().setAccounts(updatedAccounts);
            })
            .catch((e) => console.error("[sync] ❌ account upsert failed:", e));
        }
      });
      prev.forEach((a) => {
        if (!nextIds.has(a.id)) {
          console.log("[sync] delete account:", a.id);
          deleteAccountFromDb(a.id).catch((e) => console.error("[sync] ❌ account delete failed:", e));
        }
      });
      prevAccountsRef.current = next;
    });

    // SOP 同步
    const unsubSop = useSettings.subscribe((state) => {
      const prev = prevSopRef.current;
      const next = state.sopRules;
      const nextIds = new Set(next.map((r) => r.id));
      const prevIds = new Set(prev.map((r) => r.id));
      next.forEach((r) => {
        if (!prevIds.has(r.id)) {
          upsertSopRule(r, user.id).catch((e) => console.error("[sync] ❌ sop upsert failed:", e));
        } else if (prev.find((p) => p.id === r.id) !== r) {
          upsertSopRule(r, user.id).catch((e) => console.error("[sync] ❌ sop update failed:", e));
        }
      });
      prev.forEach((r) => {
        if (!nextIds.has(r.id)) {
          deleteSopRuleFromDb(r.id).catch((e) => console.error("[sync] ❌ sop delete failed:", e));
        }
      });
      prevSopRef.current = next;
    });

    // Settings 同步
    const unsubSettings = useSettings.subscribe((state) => {
      const prev = prevSettingsRef.current;
      const next = {
        language: state.language,
        currency: state.currency,
        aiConfig: state.aiConfig,
        chatMessages: state.chatMessages,
      };
      if (
        prev.language !== next.language ||
        prev.currency !== next.currency ||
        prev.aiConfig !== next.aiConfig ||
        prev.chatMessages !== next.chatMessages
      ) {
        upsertUserSettings(user.id, next).catch((e) =>
          console.error("[sync] ❌ settings upsert failed:", e)
        );
        prevSettingsRef.current = next;
      }
    });

    return () => {
      console.log("[sync] 停止同步");
      unsubTrades();
      unsubAccounts();
      unsubSop();
      unsubSettings();
    };
  }, [user]);
}
