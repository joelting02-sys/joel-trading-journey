import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import type { Trade, Account, JournalEntry } from "@/types";
import {
  getLocation,
  saveTradesToDisk,
  saveAccountsToDisk,
  loadTradesFromDisk,
  loadAccountsFromDisk,
} from "@/services/dataStorage";

// 不预设任何账号和交易记录,首次使用为空
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
  updateTrade: (trade: Trade) => void;
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

  // 数据迁移:把 localStorage 旧数据搬到当前 store
  hydrateFromDisk: () => Promise<void>;
}

// 同时写 localStorage(offline 缓存) + 本地 JSON 文件(真·持久化)
const dualStorage: PersistStorage<TradeStore> = {
  getItem: (name) => {
    const raw = localStorage.getItem(name);
    return raw ? (JSON.parse(raw) as StorageValue<TradeStore>) : null;
  },
  setItem: (name, value) => {
    // 1) localStorage 缓存(保留原逻辑)
    localStorage.setItem(name, JSON.stringify(value));
    // 2) 如果已经选择了数据目录,同步写 JSON 文件
    if (getLocation() === "filesystem" && value.state) {
      const s = value.state;
      if (s.trades !== undefined) saveTradesToDisk(s.trades).catch(() => {});
      if (s.accounts !== undefined) saveAccountsToDisk(s.accounts).catch(() => {});
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
};

export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      trades: initialTrades,
      accounts: initialAccounts,
      journalEntries: initialJournalEntries,
      activeAccountId: "",
      sidebarOpen: false,

      addTrade: (trade) =>
        set((state) => ({ trades: [trade, ...state.trades] })),

      updateTrade: (trade) =>
        set((state) => ({
          trades: state.trades.map((t) => (t.id === trade.id ? trade : t)),
        })),

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

      // 从磁盘读取真实数据(覆盖 localStorage 的旧值)
      hydrateFromDisk: async () => {
        const [trades, accounts] = await Promise.all([
          loadTradesFromDisk<Trade[]>([]),
          loadAccountsFromDisk<Account[]>([]),
        ]);
        if (trades.length > 0 || accounts.length > 0) {
          set({
            trades: trades.length > 0 ? trades : get().trades,
            accounts: accounts.length > 0 ? accounts : get().accounts,
          });
        }
      },
    }),
    {
      name: "tj-trade-store",
      storage: dualStorage,
      partialize: ((state: TradeStore) => ({
        trades: state.trades,
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
        journalEntries: state.journalEntries,
      })) as (state: TradeStore) => TradeStore,
    }
  )
);
