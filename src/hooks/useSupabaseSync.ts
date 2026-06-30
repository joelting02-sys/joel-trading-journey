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

/**
 * 把本地 store 增量同步到 Supabase。
 * - 登录后挂上
 * - 退出登录后停掉
 * - 任何写操作(addTrade / deleteTrade / addAccount / ...)都会触发同步
 */
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

    // Trade 同步
    const unsubTrades = useTradeStore.subscribe((state) => {
      const prev = prevTradesRef.current;
      const next = state.trades;
      // 找差量:新增/更新
      const nextIds = new Set(next.map((t) => t.id));
      const prevIds = new Set(prev.map((t) => t.id));
      // 新增或更新
      next.forEach((t) => {
        if (!prevIds.has(t.id) || prev.find((p) => p.id === t.id) !== t) {
          upsertTrade(t, user.id).catch((e) => console.error("[sync] trade upsert failed", e));
        }
      });
      // 删除
      prev.forEach((t) => {
        if (!nextIds.has(t.id)) {
          deleteTradeFromDb(t.id).catch((e) => console.error("[sync] trade delete failed", e));
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
          upsertAccount(a, user.id).catch((e) => console.error("[sync] account upsert failed", e));
        }
      });
      prev.forEach((a) => {
        if (!nextIds.has(a.id)) {
          deleteAccountFromDb(a.id).catch((e) => console.error("[sync] account delete failed", e));
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
          upsertSopRule(r, user.id).catch((e) => console.error("[sync] sop upsert failed", e));
        } else if (prev.find((p) => p.id === r.id) !== r) {
          upsertSopRule(r, user.id).catch((e) => console.error("[sync] sop update failed", e));
        }
      });
      prev.forEach((r) => {
        if (!nextIds.has(r.id)) {
          deleteSopRuleFromDb(r.id).catch((e) => console.error("[sync] sop delete failed", e));
        }
      });
      prevSopRef.current = next;
    });

    // Settings 同步(语言/币种/AI/聊天) - 整体 upsert
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
          console.error("[sync] settings upsert failed", e)
        );
        prevSettingsRef.current = next;
      }
    });

    return () => {
      unsubTrades();
      unsubAccounts();
      unsubSop();
      unsubSettings();
    };
  }, [user]);
}
