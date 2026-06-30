import { useMemo, useState, type FormEvent } from "react";
import { Wallet, TrendingUp, TrendingDown, Check, Pencil, Trash2, Plus, X } from "lucide-react";
import Layout from "@/components/Layout";
import Badge from "@/components/Badge";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";
import { formatCurrencyConverted, formatSignedCurrencyConverted } from "@/utils/currency";
import { calcAccountEquity } from "@/utils/tradeMetrics";
import type { Account } from "@/types";

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "JPY", "MYR"];

export default function Accounts() {
  const accounts = useTradeStore((s) => s.accounts);
  const trades = useTradeStore((s) => s.trades);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const setActiveAccount = useTradeStore((s) => s.setActiveAccount);
  const addAccount = useTradeStore((s) => s.addAccount);
  const updateAccount = useTradeStore((s) => s.updateAccount);
  const deleteAccount = useTradeStore((s) => s.deleteAccount);
  const t = useSettings((s) => s.t());
  const currency = useSettings((s) => s.currency);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // 用实际交易数据计算权益
  const accountEquities = useMemo(
    () => accounts.map((a) => ({ account: a, equity: calcAccountEquity(a, trades) })),
    [accounts, trades]
  );
  const totalEquity = useMemo(
    () => accountEquities.reduce((s, { equity }) => s + equity, 0),
    [accountEquities]
  );
  const totalPnl = useMemo(
    () => accountEquities.reduce((s, { account, equity }) => s + (equity - account.balance), 0),
    [accountEquities]
  );

  const openAdd = () => { setEditingAccount(null); setDialogOpen(true); };
  const openEdit = (a: Account) => { setEditingAccount(a); setDialogOpen(true); };
  const handleDelete = (a: Account) => { if (window.confirm(t.accountsPage.deleteConfirm)) deleteAccount(a.id); };
  const handleSave = (data: Omit<Account, "id">) => {
    if (editingAccount) updateAccount({ ...editingAccount, ...data });
    else addAccount({ id: `acc${Date.now()}`, ...data });
    setDialogOpen(false);
    setEditingAccount(null);
  };

  return (
    <Layout title={t.title.accounts}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-bg-surface px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-xs text-text-muted">{t.accountsPage.totalEquity}</div>
            <div className="tj-number text-lg font-semibold text-text">{formatCurrencyConverted(totalEquity, currency)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalPnl >= 0 ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-loss" />}
          <div>
            <div className="text-xs text-text-muted">{t.accountsPage.combinedPnl}</div>
            <div className={`tj-number text-lg font-semibold ${totalPnl >= 0 ? "text-primary" : "text-loss"}`}>
              {formatSignedCurrencyConverted(totalPnl, currency)}
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <div className="h-9 w-px bg-border" />
          <div>
            <div className="text-xs text-text-muted">{t.accountsPage.accounts}</div>
            <div className="tj-number text-lg font-semibold text-text">{accounts.length}</div>
          </div>
        </div>
        <button type="button" onClick={openAdd} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          {t.accountsPage.addAccount}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accountEquities.map(({ account, equity }) => (
          <AccountCard key={account.id} account={account} equity={equity} isActive={account.id === activeAccountId}
            onSelect={() => setActiveAccount(account.id)} onEdit={() => openEdit(account)} onDelete={() => handleDelete(account)} />
        ))}
      </div>

      {dialogOpen && (
        <AccountDialog account={editingAccount} onClose={() => { setDialogOpen(false); setEditingAccount(null); }} onSave={handleSave} />
      )}
    </Layout>
  );
}

interface AccountCardProps {
  account: Account;
  equity: number;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function AccountCard({ account, equity, isActive, onSelect, onEdit, onDelete }: AccountCardProps) {
  const t = useSettings((s) => s.t());
  const currency = useSettings((s) => s.currency);
  const pnl = equity - account.balance;
  const isProfit = pnl >= 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(); }}
      className={`group relative w-full cursor-pointer rounded-md border bg-bg-surface px-5 py-4 text-left transition-all hover:bg-bg-hover ${
        isActive ? "border-primary ring-1 ring-primary/30" : "border-border"
      }`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isActive ? "bg-primary/12" : "bg-bg-hover"}`}>
            <Wallet className={`h-4 w-4 ${isActive ? "text-primary" : "text-text-secondary"}`} />
          </div>
          <div>
            <div className="font-display text-sm font-semibold tracking-tight text-text">{account.name}</div>
            <div className="text-xs text-text-secondary">{account.broker}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
            <Badge variant="primary">
              <span className="mr-1 inline-flex"><Check className="h-3 w-3" /></span>
              {t.accountsPage.active}
            </Badge>
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="rounded p-1 text-text-muted opacity-0 transition-opacity hover:bg-bg-hover hover:text-text group-hover:opacity-100"
            title={t.accountsPage.editAccount}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded p-1 text-text-muted opacity-0 transition-opacity hover:bg-loss/10 hover:text-loss group-hover:opacity-100"
            title={t.accountsPage.delete}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-text-muted">{t.accountsPage.equity}</div>
        <div className="tj-number text-2xl font-semibold text-text">{formatCurrencyConverted(equity, currency)}</div>
      </div>

      <div className="flex items-center justify-between border-t border-border-subtle pt-3">
        <div>
          <div className="text-xs text-text-muted">{t.accountsPage.balance}</div>
          <div className="tj-number text-sm font-medium text-text-secondary">{formatCurrencyConverted(account.balance, currency)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-muted">{t.accountsPage.pnl}</div>
          <div className={`tj-number text-sm font-semibold ${isProfit ? "text-primary" : "text-loss"}`}>
            {formatSignedCurrencyConverted(pnl, currency)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-muted">{t.accountsPage.currency}</div>
          <div className="tj-number text-sm font-medium text-text-secondary">{account.currency}</div>
        </div>
      </div>
    </div>
  );
}

function AccountDialog({ account, onClose, onSave }: {
  account: Account | null;
  onClose: () => void;
  onSave: (data: Omit<Account, "id">) => void;
}) {
  const t = useSettings((s) => s.t());
  const [name, setName] = useState(account?.name ?? "");
  const [broker, setBroker] = useState(account?.broker ?? "");
  const [balance, setBalance] = useState(account?.balance?.toString() ?? "");
  const [accCurrency, setAccCurrency] = useState(account?.currency ?? "USD");
  const [error, setError] = useState("");
  const cls = "w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t.accountsPage.nameRequired);
    const bal = Number(balance) || 0;
    // equity 初始等于 balance，之后由交易盈亏自动计算
    onSave({ name: name.trim(), broker: broker.trim(), balance: bal, equity: bal, currency: accCurrency });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-text">{account ? t.accountsPage.editAccount : t.accountsPage.addAccount}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">{t.accountsPage.accountName}</span>
            <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} className={cls} />
            {error && <span className="text-xs text-loss">{error}</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">{t.accountsPage.broker}</span>
            <input type="text" value={broker} onChange={(e) => setBroker(e.target.value)} className={cls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">Balance (USD)</span>
              <input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} className={cls} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">{t.accountsPage.currency}</span>
            <select value={accCurrency} onChange={(e) => setAccCurrency(e.target.value)} className={cls}>
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border bg-bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-bg-hover">
              {t.accountsPage.cancel}
            </button>
            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90">
              {t.accountsPage.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
