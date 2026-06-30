import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Trade, Account, JournalEntry } from "@/types";

// 不预设任何账号和交易记录，首次使用为空
const initialTrades: Trade[] = [];
const initialAccounts: Account[] = [];
const initialJournalEntries: JournalEntry[] = [];

interface TradeStore {
  trades: Trade[];
  accounts: Account[];
  journalEntries: JournalEntry[];
  activeAccountId: string;
  sidebarOpen: boolean;

  addTrade: (trade: Trade) => void;
  deleteTrade: (id: string) => void;
  addAccount: (account: Account) => void;
  updateAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  setActiveAccount: (id: string) => void;
  setActiveAccountId: (id: string) => void;
  setTrades: (trades: Trade[]) => void;
  setAccounts: (accounts: Account[]) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

// 使用 persist 中间件将数据保存到 localStorage 作为离线缓存
// Supabase 是单一真源,登录后会从云端 hydrate
export const useTradeStore = create<TradeStore>()(
  persist(
    (set) => ({
      trades: initialTrades,
      accounts: initialAccounts,
      journalEntries: initialJournalEntries,
      activeAccountId: "",
      sidebarOpen: false,

      addTrade: (trade) =>
        set((state) => ({ trades: [trade, ...state.trades] })),

      deleteTrade: (id) =>
        set((state) => ({ trades: state.trades.filter((t) => t.id !== id) })),

      addAccount: (account) =>
        set((state) => ({ accounts: [...state.accounts, account] })),

      updateAccount: (account) =>
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === account.id ? account : a)),
        })),

      deleteAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
          trades: state.trades.filter((t) => t.account !== id),
          activeAccountId:
            state.activeAccountId === id
              ? state.accounts.find((a) => a.id !== id)?.id ?? ""
              : state.activeAccountId,
        })),

      setActiveAccount: (id) => set({ activeAccountId: id }),
      setActiveAccountId: (id) => set({ activeAccountId: id }),
      setTrades: (trades) => set({ trades }),
      setAccounts: (accounts) => set({ accounts }),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: "tj-trade-store",
      partialize: (state) => ({
        trades: state.trades,
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
        journalEntries: state.journalEntries,
      }),
    }
  )
);
