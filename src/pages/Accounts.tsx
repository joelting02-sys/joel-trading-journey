import { useMemo, useState, type FormEvent } from "react";
import { Wallet, TrendingUp, TrendingDown, Check, Pencil, Trash2, Plus, X, ChevronDown, ChevronUp, AlertTriangle, Trophy, Target, Database } from "lucide-react";
import Layout from "@/components/Layout";
import Badge from "@/components/Badge";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";
import { formatCurrencyConverted, formatSignedCurrencyConverted } from "@/utils/currency";
import { calcAccountEquity } from "@/utils/tradeMetrics";
import { evaluatePropFirm } from "@/utils/propFirm";
import type { Account, PropFirmChallenge, Trade } from "@/types";

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "JPY", "MYR"];

const EMPTY_PROP_FIRM: PropFirmChallenge = {
  enabled: false,
  startingBalance: 0,
  liquidationPoint: 0,
  lowestEquityEver: 0,
  minTradingDays: 0,
  permittedDailyDrawdown: 0,
  permittedTotalDrawdown: 0,
  profitTarget: 0,
  startDate: new Date().toISOString().slice(0, 10),
};

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

  const realEquity = useMemo(() => {
    return accountEquities
      .filter(({ account }) => {
        const type = account.accountType ?? (account.propFirm?.enabled ? "prop" : "real");
        return type === "real";
      })
      .reduce((s, { equity }) => s + equity, 0);
  }, [accountEquities]);

  const realPnl = useMemo(() => {
    return accountEquities
      .filter(({ account }) => {
        const type = account.accountType ?? (account.propFirm?.enabled ? "prop" : "real");
        return type === "real";
      })
      .reduce((s, { account, equity }) => s + (equity - account.balance), 0);
  }, [accountEquities]);

  const propEquity = useMemo(() => {
    return accountEquities
      .filter(({ account }) => {
        const type = account.accountType ?? (account.propFirm?.enabled ? "prop" : "real");
        return type === "prop";
      })
      .reduce((s, { equity }) => s + equity, 0);
  }, [accountEquities]);

  const propPnl = useMemo(() => {
    return accountEquities
      .filter(({ account }) => {
        const type = account.accountType ?? (account.propFirm?.enabled ? "prop" : "real");
        return type === "prop";
      })
      .reduce((s, { account, equity }) => s + (equity - account.balance), 0);
  }, [accountEquities]);

  const demoEquity = useMemo(() => {
    return accountEquities
      .filter(({ account }) => {
        const type = account.accountType ?? (account.propFirm?.enabled ? "prop" : "real");
        return type === "demo";
      })
      .reduce((s, { equity }) => s + equity, 0);
  }, [accountEquities]);

  const demoPnl = useMemo(() => {
    return accountEquities
      .filter(({ account }) => {
        const type = account.accountType ?? (account.propFirm?.enabled ? "prop" : "real");
        return type === "demo";
      })
      .reduce((s, { account, equity }) => s + (equity - account.balance), 0);
  }, [accountEquities]);

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
      <div className="mb-5 flex flex-col gap-4 rounded-md border border-border bg-bg-surface p-5">
        {/* Three Columns Grid for Balances */}
        <div className="grid grid-cols-1 gap-4 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {/* Real Money */}
          <div className="flex items-center gap-3 pb-3 sm:pb-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-xs text-text-muted">{t.accountsPage.typeReal}</div>
              <div className="tj-number text-lg font-semibold text-text">{formatCurrencyConverted(realEquity, currency)}</div>
              <div className={`tj-number text-xs font-medium ${realPnl >= 0 ? "text-primary" : "text-loss"}`}>
                {realPnl >= 0 ? "+" : ""}{formatSignedCurrencyConverted(realPnl, currency)}
              </div>
            </div>
          </div>

          {/* Prop Firm */}
          <div className="flex items-center gap-3 pt-3 sm:pl-4 sm:pt-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/12">
              <Trophy className="h-4 w-4 text-warning" />
            </div>
            <div>
              <div className="text-xs text-text-muted">{t.accountsPage.typeProp}</div>
              <div className="tj-number text-lg font-semibold text-text">{formatCurrencyConverted(propEquity, currency)}</div>
              <div className={`tj-number text-xs font-medium ${propPnl >= 0 ? "text-primary" : "text-loss"}`}>
                {propPnl >= 0 ? "+" : ""}{formatSignedCurrencyConverted(propPnl, currency)}
              </div>
            </div>
          </div>

          {/* Demo */}
          <div className="flex items-center gap-3 pt-3 sm:pl-4 sm:pt-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info/12">
              <Database className="h-4 w-4 text-info" />
            </div>
            <div>
              <div className="text-xs text-text-muted">{t.accountsPage.typeDemo}</div>
              <div className="tj-number text-lg font-semibold text-text">{formatCurrencyConverted(demoEquity, currency)}</div>
              <div className={`tj-number text-xs font-medium ${demoPnl >= 0 ? "text-primary" : "text-loss"}`}>
                {demoPnl >= 0 ? "+" : ""}{formatSignedCurrencyConverted(demoPnl, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar with Add Account */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="text-xs text-text-muted">{t.accountsPage.accounts}:</div>
              <div className="tj-number text-sm font-semibold text-text">{accounts.length}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-text-muted">{t.accountsPage.totalEquity}:</div>
              <div className="tj-number text-sm font-semibold text-text">{formatCurrencyConverted(totalEquity, currency)}</div>
            </div>
          </div>
          <button type="button" onClick={openAdd} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            {t.accountsPage.addAccount}
          </button>
        </div>
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
  const trades = useTradeStore((s) => s.trades);
  const pnl = equity - account.balance;
  const isProfit = pnl >= 0;
  const propFirm = account.propFirm?.enabled
    ? evaluatePropFirm(account, trades.filter((tr) => tr.account === account.id), equity)
    : null;

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
          {isActive && !propFirm && (
            <Badge variant="primary">
              <span className="mr-1 inline-flex"><Check className="h-3 w-3" /></span>
              {t.accountsPage.active}
            </Badge>
          )}
          {propFirm && (
            propFirm.status === "passed" ? (
              <Badge variant="primary">
                <Trophy className="mr-1 h-3 w-3" />
                {t.accountsPage.propFirmPassed}
              </Badge>
            ) : propFirm.status === "failed" ? (
              <Badge variant="loss">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {t.accountsPage.propFirmFailed}
              </Badge>
            ) : (
              <Badge variant="warning">{t.accountsPage.propFirmActive}</Badge>
            )
          )}
          {!propFirm && account.accountType && (
            account.accountType === "real" ? (
              <Badge variant="primary">{t.accountsPage.typeReal}</Badge>
            ) : account.accountType === "demo" ? (
              <Badge variant="info">{t.accountsPage.typeDemo}</Badge>
            ) : account.accountType === "prop" ? (
              <Badge variant="warning">{t.accountsPage.typeProp}</Badge>
            ) : (
              <Badge variant="neutral">{t.accountsPage.typeOther}</Badge>
            )
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

      {/* Prop Firm 考试信息 */}
      {propFirm && account.propFirm && (
        <div className="mt-3 rounded-md border border-dashed border-border-subtle bg-bg-elevated px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-medium uppercase tracking-wider text-text-muted">
              {t.accountsPage.propFirm}
            </span>
            <span className="tj-number text-text-secondary">
              {t.accountsPage.liquidationPoint}: {formatCurrencyConverted(account.propFirm.liquidationPoint, currency)}
            </span>
          </div>
          <div className="space-y-1.5">
            {propFirm.rules.map((rule) => {
              // target=0 的规则(如 minTradingDays=0)视为"无要求",默认通过且进度条满格
              const isUnset = rule.target === 0 && rule.current === 0 && rule.key === "minTradingDays";
              const effectivePassed = rule.passed || isUnset;
              const ratio = isUnset ? 1 : (rule.target > 0 ? Math.min(rule.current / rule.target, 1) : 0);
              const ratioLabel = rule.unit === "%"
                ? `${rule.current.toFixed(2)}% / ${rule.target}%`
                : rule.unit === "$"
                  ? `$${rule.current.toFixed(0)} / $${rule.target}`
                  : `${rule.current} / ${rule.target}d`;
              const barColor = effectivePassed
                ? "bg-primary"
                : rule.current > rule.target
                  ? "bg-loss"
                  : "bg-warning";
              return (
                <div key={rule.key} className="flex items-center gap-2 text-[11px]">
                  <span className="w-24 shrink-0 text-text-secondary">{rule.label}</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-bg-hover">
                    <div
                      className={`absolute inset-y-0 left-0 ${barColor} transition-all`}
                      style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
                    />
                  </div>
                  <span className={`tj-number w-28 shrink-0 text-right ${effectivePassed ? "text-primary font-semibold" : "text-text-secondary"}`}>
                    {effectivePassed && <span className="mr-0.5">✓</span>}
                    {ratioLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 个人账户目标(Target Balance + 日内回撤) */}
      {!propFirm && (account.targetBalance || account.dailyDrawdownLimit) && (
        <PersonalGoalsCard
          account={account}
          equity={equity}
          trades={trades.filter((tr) => tr.account === account.id)}
        />
      )}
    </div>
  );
}

// 个人账户目标可视化卡片(样式与 Prop Firm 区块保持一致)
function PersonalGoalsCard({
  account, equity, trades,
}: {
  account: Account;
  equity: number;
  trades: Trade[];
}) {
  const t = useSettings((s) => s.t());
  const currency = useSettings((s) => s.currency);
  const language = useSettings((s) => s.language);

  // 计算今日已平仓 P&L(用于日内回撤)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayPnl = trades
    .filter((tr) => tr.status === "closed" && tr.closeDate === today)
    .reduce((sum, tr) => sum + tr.pnl, 0);
  const drawdown = todayPnl < 0 ? Math.abs(todayPnl) : 0;

  const rows: JSX.Element[] = [];

  // 行 1: 目标资金进度
  if (account.targetBalance && account.targetBalance > 0) {
    const target = account.targetBalance;
    const ratio = Math.min(equity / target, 1);
    const reached = equity >= target;
    rows.push(
      <div key="target" className="flex items-center gap-2 text-[11px]">
        <span className="w-24 shrink-0 text-text-secondary">
          {t.accountsPage.targetBalance}
        </span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-bg-hover">
          <div
            className={`absolute inset-y-0 left-0 transition-all ${reached ? "bg-primary" : "bg-primary/60"}`}
            style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
          />
        </div>
        <span className={`tj-number w-28 shrink-0 text-right ${reached ? "text-primary font-semibold" : "text-text-secondary"}`}>
          {reached && <span className="mr-0.5">✓</span>}
          {language === "zh"
            ? `$${equity.toFixed(0)} / $${target}`
            : `$${equity.toFixed(0)} / $${target}`}
        </span>
      </div>
    );
  }

  // 行 2: 日内回撤进度(亏损越多越满,超限变红)
  if (account.dailyDrawdownLimit && account.dailyDrawdownLimit > 0) {
    const limit = account.dailyDrawdownLimit;
    const ratio = Math.min(drawdown / limit, 1);
    const breached = drawdown >= limit;
    const warning = !breached && drawdown >= limit * 0.8;
    const barColor = breached ? "bg-loss" : warning ? "bg-warning" : "bg-primary/60";
    const valueColor = breached
      ? "text-loss font-semibold"
      : warning
        ? "text-warning font-semibold"
        : "text-text-secondary";
    rows.push(
      <div key="drawdown" className="flex items-center gap-2 text-[11px]">
        <span className="w-24 shrink-0 text-text-secondary">
          {t.accountsPage.dailyDrawdownLimit}
        </span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-bg-hover">
          <div
            className={`absolute inset-y-0 left-0 transition-all ${barColor}`}
            style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
          />
        </div>
        <span className={`tj-number w-28 shrink-0 text-right ${valueColor}`}>
          {breached && <span className="mr-0.5">⚠</span>}
          {language === "zh"
            ? `$${drawdown.toFixed(0)} / $${limit}`
            : `$${drawdown.toFixed(0)} / $${limit}`}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-dashed border-border-subtle bg-bg-elevated px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 font-medium uppercase tracking-wider text-text-muted">
          <Target className="h-3 w-3" />
          {t.accountsPage.personalGoals}
        </span>
        <span className="tj-number text-text-secondary">
          {language === "zh" ? "当前权益" : "Equity"}: {formatCurrencyConverted(equity, currency)}
        </span>
      </div>
      <div className="space-y-1.5">
        {rows}
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
  const [pfOpen, setPfOpen] = useState(!!account?.propFirm?.enabled);
  const [pf, setPf] = useState<PropFirmChallenge>(
    account?.propFirm ?? { ...EMPTY_PROP_FIRM }
  );
  const [accountType, setAccountType] = useState<"real" | "prop" | "demo" | "other">(
    account?.accountType ?? (account?.propFirm?.enabled ? "prop" : "real")
  );
  // 个人账户可选:目标资金 + 日内回撤上限
  const [targetBalance, setTargetBalance] = useState(
    account?.targetBalance?.toString() ?? ""
  );
  const [dailyDrawdownLimit, setDailyDrawdownLimit] = useState(
    account?.dailyDrawdownLimit?.toString() ?? ""
  );
  const [error, setError] = useState("");
  const cls = "w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t.accountsPage.nameRequired);
    const bal = Number(balance) || 0;
    onSave({
      name: name.trim(),
      broker: broker.trim(),
      balance: bal,
      equity: bal,
      currency: accCurrency,
      accountType,
      // 只有 Prop Firm 类型才保存 propFirm 数据,其他类型清空
      propFirm: accountType === "prop" && pf.enabled
        ? { ...pf, startingBalance: pf.startingBalance || bal }
        : undefined,
      // 非 prop 账户:保存可选的 Target 和 日内回撤(prop 账户用 PropFirm 字段)
      targetBalance: accountType !== "prop" && targetBalance.trim()
        ? Number(targetBalance) || undefined
        : undefined,
      dailyDrawdownLimit: accountType !== "prop" && dailyDrawdownLimit.trim()
        ? Number(dailyDrawdownLimit) || undefined
        : undefined,
    });
  };

  const setPfField = <K extends keyof PropFirmChallenge>(key: K, val: PropFirmChallenge[K]) => {
    setPf((p) => ({ ...p, [key]: val }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
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
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">{t.accountsPage.currency}</span>
              <select value={accCurrency} onChange={(e) => setAccCurrency(e.target.value)} className={cls}>
                {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          {/* 账户类型标签 */}
          <div className="mt-1 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">
              {t.accountsPage.accountType}
            </span>
            <div className="flex flex-wrap gap-2">
              {([
                { v: "real", label: t.accountsPage.typeReal, color: "primary" },
                { v: "prop", label: t.accountsPage.typeProp, color: "warning" },
                { v: "demo", label: t.accountsPage.typeDemo, color: "info" },
                { v: "other", label: t.accountsPage.typeOther, color: "neutral" },
              ] as const).map((opt) => {
                const active = accountType === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setAccountType(opt.v)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? opt.v === "real"
                          ? "border-primary bg-primary-ghost text-primary"
                          : opt.v === "prop"
                            ? "border-warning bg-warning-ghost text-warning"
                            : opt.v === "demo"
                              ? "border-info bg-info-ghost text-info"
                              : "border-border bg-bg-hover text-text-secondary"
                        : "border-border bg-bg-surface text-text-muted hover:border-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <span className="text-[10px] text-text-muted">
              {t.accountsPage.accountTypeHint}
            </span>
          </div>

          {/* Prop Firm 折叠区:仅当选中 Prop Firm 类型时显示 */}
          {accountType === "prop" && (
          <div className="mt-2 rounded-md border border-dashed border-border">
            <button
              type="button"
              onClick={() => { setPfOpen((o) => !o); setPfField("enabled", !pfOpen || !pf.enabled); }}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-text">
                <Trophy className="h-3.5 w-3.5 text-warning" />
                {t.accountsPage.propFirmToggle}
              </span>
              {pfOpen ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
            </button>
            {pfOpen && (
              <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-text-secondary">{t.accountsPage.startingBalance}</span>
                    <input type="number" step="0.01" value={pf.startingBalance || ""} onChange={(e) => setPfField("startingBalance", Number(e.target.value) || 0)} className={cls} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-text-secondary">{t.accountsPage.liquidationPoint}</span>
                    <input type="number" step="0.01" value={pf.liquidationPoint || ""} onChange={(e) => setPfField("liquidationPoint", Number(e.target.value) || 0)} className={cls} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-text-secondary">{t.accountsPage.lowestEquityEver}</span>
                    <input type="number" step="0.01" value={pf.lowestEquityEver || ""} onChange={(e) => setPfField("lowestEquityEver", Number(e.target.value) || 0)} className={cls} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-text-secondary">{t.accountsPage.startDate}</span>
                    <input type="date" value={pf.startDate} onChange={(e) => setPfField("startDate", e.target.value)} className={cls} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-text-secondary">{t.accountsPage.minTradingDays} (d)</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={Number.isFinite(pf.minTradingDays) ? pf.minTradingDays : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        // 允许空字符串(用户清空时),不强制变 0
                        setPfField("minTradingDays", v === "" ? 0 : Number(v) || 0);
                      }}
                      className={cls}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-text-secondary">{t.accountsPage.profitTarget} ($)</span>
                    <input type="number" step="0.01" value={pf.profitTarget || ""} onChange={(e) => setPfField("profitTarget", Number(e.target.value) || 0)} className={cls} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-text-secondary">{t.accountsPage.dailyDrawdownPct} (%)</span>
                    <input type="number" step="0.01" min="0" value={pf.permittedDailyDrawdown || ""} onChange={(e) => setPfField("permittedDailyDrawdown", Number(e.target.value) || 0)} className={cls} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-text-secondary">{t.accountsPage.totalDrawdownPct} (%)</span>
                    <input type="number" step="0.01" min="0" value={pf.permittedTotalDrawdown || ""} onChange={(e) => setPfField("permittedTotalDrawdown", Number(e.target.value) || 0)} className={cls} />
                  </label>
                </div>
              </div>
            )}
          </div>
          )}

          {/* 个人账户可选:Target + 日内回撤(非 prop 账户显示) */}
          {accountType !== "prop" && (
            <div className="mt-2 rounded-md border border-dashed border-border px-3 py-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-medium text-text">
                  {t.accountsPage.personalGoals || "Personal Goals"}
                </span>
                <span className="text-[10px] text-text-muted">
                  {t.accountsPage.personalGoalsHint || "(optional)"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">
                    {t.accountsPage.targetBalance || "Target Balance"} ($)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t.accountsPage.targetBalancePlaceholder || "e.g. 10000"}
                    value={targetBalance}
                    onChange={(e) => setTargetBalance(e.target.value)}
                    className={cls}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">
                    {t.accountsPage.dailyDrawdownLimit || "Daily Drawdown Limit"} ($)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t.accountsPage.dailyDrawdownLimitPlaceholder || "e.g. 200"}
                    value={dailyDrawdownLimit}
                    onChange={(e) => setDailyDrawdownLimit(e.target.value)}
                    className={cls}
                  />
                </label>
              </div>
            </div>
          )}

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
