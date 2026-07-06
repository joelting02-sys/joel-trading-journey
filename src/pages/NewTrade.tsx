import { useState, useMemo, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save, CheckCircle2, Circle, ChevronDown } from "lucide-react";
import Layout from "@/components/Layout";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings, getActiveSopRules, getSopSetById } from "@/store/useSettings";
import Select from "@/components/Select";
import SymbolPicker from "@/components/SymbolPicker";
import { formatSignedCurrencyConverted } from "@/utils/currency";
import type { Trade, Direction, TradeStatus, SopCategory, SopRule } from "@/types";

interface FormState {
  symbol: string;
  direction: Direction;
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  fee: string;
  status: TradeStatus;
  account: string;
  openDate: string;
  closeDate: string;
  notes: string;
  sopCompliance: string[];
}

const today = () => new Date().toISOString().slice(0, 10);
const inputClasses =
  "w-full rounded-md border bg-bg px-3 py-2 font-mono text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary";
const labelClasses = "text-text-secondary text-xs font-medium";

export default function NewTrade() {
  const navigate = useNavigate();
  const addTrade = useTradeStore((s) => s.addTrade);
  const accounts = useTradeStore((s) => s.accounts);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const currency = useSettings((s) => s.currency);
  const sopSets = useSettings((s) => s.sopSets);
  const activeSopSetId = useSettings((s) => s.activeSopSetId);

  const [form, setForm] = useState<FormState>({
    symbol: "",
    direction: "long",
    entryPrice: "",
    exitPrice: "",
    quantity: "1",
    fee: "0",
    status: "closed",
    account: activeAccountId || accounts[0]?.id || "",
    openDate: today(),
    closeDate: today(),
    notes: "",
    sopCompliance: [],
  });
  const [errors, setErrors] = useState<{ symbol?: string; entryPrice?: string }>({});
  const [showSopChecklist, setShowSopChecklist] = useState(false);

  // 根据所选账户加载 SOP 规则(账户绑定了 sopSetId 就用它的,否则用当前激活的 SOP 集)
  const selectedAccount = accounts.find((a) => a.id === form.account);
  const sopRules = useMemo(() => {
    const setId = selectedAccount?.sopSetId;
    if (setId) return getSopSetById({ sopSets }, setId)?.rules ?? [];
    return getActiveSopRules({ sopSets, activeSopSetId });
  }, [selectedAccount, sopSets, activeSopSetId]);

  const rulesByCategory = useMemo(() => {
    const map: Record<SopCategory, SopRule[]> = { entry: [], exit: [], risk: [], psychology: [] };
    for (const r of sopRules) map[r.category].push(r);
    return map;
  }, [sopRules]);

  const categoryMeta: { key: SopCategory; label: string; dot: string }[] = [
    { key: "entry", label: t.sopPage.entryRules, dot: "bg-primary" },
    { key: "exit", label: t.sopPage.exitRules, dot: "bg-info" },
    { key: "risk", label: t.sopPage.riskRules, dot: "bg-warning" },
    { key: "psychology", label: t.sopPage.psychologyRules, dot: "bg-loss" },
  ];

  function toggleSopRule(ruleId: string) {
    setForm((f) => ({
      ...f,
      sopCompliance: f.sopCompliance.includes(ruleId)
        ? f.sopCompliance.filter((id) => id !== ruleId)
        : [...f.sopCompliance, ruleId],
    }));
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "symbol" || key === "entryPrice") {
      setErrors((e) => ({ ...e, [key]: undefined }));
    }
  }

  const entry = parseFloat(form.entryPrice);
  const exit = parseFloat(form.exitPrice);
  const qty = parseFloat(form.quantity);
  const feeValue = parseFloat(form.fee) || 0;
  const hasPnlInputs = !isNaN(entry) && !isNaN(exit) && !isNaN(qty) && qty > 0;
  // P&L 只算价格×数量的差异,绝不包括手续费
  const pnl = hasPnlInputs
    ? form.direction === "long"
      ? (exit - entry) * qty
      : (entry - exit) * qty
    : 0;
  const pnlPercent = hasPnlInputs && entry > 0 ? (pnl / (entry * qty)) * 100 : 0;
  // 净 P&L = P&L + 手续费(手续费为负数,直接相加)
  const netPnl = pnl + feeValue;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!form.symbol.trim()) nextErrors.symbol = t.newTradePage.symbolRequired;
    if (!form.entryPrice || isNaN(entry)) nextErrors.entryPrice = t.newTradePage.entryRequired;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const exitPrice = form.exitPrice ? exit : 0;
    const quantity = form.quantity ? qty : 0;
    const calcPnl = hasPnlInputs
      ? form.direction === "long"
        ? (exitPrice - entry) * quantity
        : (entry - exitPrice) * quantity
      : 0;
    const calcPnlPercent = entry > 0 && quantity > 0 ? (calcPnl / (entry * quantity)) * 100 : 0;

    const trade: Trade = {
      id: `T${Date.now()}`,
      symbol: form.symbol.trim(),
      direction: form.direction,
      entryPrice: entry,
      exitPrice,
      quantity,
      pnl: Number(calcPnl.toFixed(2)),
      pnlPercent: Number(calcPnlPercent.toFixed(2)),
      fee: feeValue,
      openDate: form.openDate,
      closeDate: form.closeDate,
      status: "closed",
      notes: form.notes.trim() || undefined,
      account: form.account,
      sopCompliance: form.sopCompliance.length > 0 ? form.sopCompliance : undefined,
    };
    addTrade(trade);
    navigate("/trades");
  };

  const border = (err?: string) => (err ? "border-loss" : "border-border");
  const dirBtn = (active: boolean, tone: "primary" | "loss") =>
    `flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? tone === "primary"
          ? "border-primary bg-primary text-white"
          : "border-loss bg-loss text-white"
        : "border-border bg-bg text-text-secondary hover:bg-bg-hover"
    }`;
  return (
    <Layout title={t.title.newTrade}>
      <button
        type="button"
        onClick={() => navigate("/trades")}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t.newTradePage.backToTrades}
      </button>

      <form onSubmit={handleSubmit} className="rounded-md border border-border bg-bg-surface px-5 py-4">
        {/* P&L Preview */}
        <div className="mb-5 flex items-center justify-between rounded-sm border border-border-subtle bg-bg px-4 py-3">
          <div>
            <div className={labelClasses}>P&L (不含手续费)</div>
            <div className="mt-0.5 text-[11px] text-text-muted">
              {form.direction === "long" ? "(exit − entry) × qty" : "(entry − exit) × qty"}
            </div>
            <div className="mt-1 text-[11px] text-text-muted">
              手续费: {feeValue !== 0 ? formatSignedCurrencyConverted(feeValue, currency) : "$0.00"}
            </div>
            <div className="mt-0.5 text-[11px] text-text-muted">
              净 P&L: {hasPnlInputs ? formatSignedCurrencyConverted(netPnl, currency) : "—"}
            </div>
          </div>
          <div className="text-right">
            <div className={`tj-number text-lg font-semibold ${pnl > 0 ? "text-primary" : pnl < 0 ? "text-loss" : "text-text"}`}>
              {hasPnlInputs ? formatSignedCurrencyConverted(pnl, currency) : "—"}
            </div>
            <div className={`tj-number text-xs ${pnl > 0 ? "text-primary" : pnl < 0 ? "text-loss" : "text-text-muted"}`}>
              {hasPnlInputs && pnlPercent !== 0
                ? `${pnlPercent > 0 ? "+" : ""}${pnlPercent.toFixed(2)}%`
                : ""}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClasses} htmlFor="symbol">{t.newTradePage.symbol}</label>
            <div className="mt-1">
              <SymbolPicker value={form.symbol} onChange={(v) => update("symbol", v)} language={language} />
            </div>
            {errors.symbol && <p className="mt-1 text-xs text-loss">{errors.symbol}</p>}
          </div>

          <div>
            <span className={labelClasses}>{t.newTradePage.direction}</span>
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => update("direction", "long")} className={dirBtn(form.direction === "long", "primary")}>{t.newTradePage.long}</button>
              <button type="button" onClick={() => update("direction", "short")} className={dirBtn(form.direction === "short", "loss")}>{t.newTradePage.short}</button>
            </div>
          </div>

          <div>
            <label className={labelClasses} htmlFor="entryPrice">{t.newTradePage.entryPrice}</label>
            <input id="entryPrice" type="number" step="any" value={form.entryPrice} placeholder="0.00"
              onChange={(e) => update("entryPrice", e.target.value)}
              className={`mt-1 ${inputClasses} ${border(errors.entryPrice)}`} />
            {errors.entryPrice && <p className="mt-1 text-xs text-loss">{errors.entryPrice}</p>}
          </div>

          <div>
            <label className={labelClasses} htmlFor="exitPrice">{t.newTradePage.exitPrice}</label>
            <input id="exitPrice" type="number" step="any" value={form.exitPrice} placeholder="0.00"
              onChange={(e) => update("exitPrice", e.target.value)}
              className={`mt-1 ${inputClasses} ${border()}`} />
          </div>

          <div>
            <label className={labelClasses} htmlFor="quantity">{t.newTradePage.quantity}</label>
            <input id="quantity" type="number" step="any" value={form.quantity} placeholder="0"
              onChange={(e) => update("quantity", e.target.value)}
              className={`mt-1 ${inputClasses} ${border()}`} />
          </div>

          <div>
            <label className={labelClasses} htmlFor="fee">
              {t.newTradePage.fee || "Fee (手续费)"} <span className="text-text-muted">({t.newTradePage.feeHint || "负数,如 -0.8"})</span>
            </label>
            <input id="fee" type="number" step="any" value={form.fee} placeholder="0"
              onChange={(e) => update("fee", e.target.value)}
              className={`mt-1 ${inputClasses} ${border()}`} />
          </div>

          <div>
            <label className={labelClasses} htmlFor="account">{t.newTradePage.account}</label>
            <div className="mt-1">
              <Select
                value={form.account}
                onChange={(v) => update("account", v)}
                options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.broker}` }))}
                placeholder={language === "zh" ? "选择账户" : "Select account"}
              />
            </div>
          </div>

          <div>
            <label className={labelClasses} htmlFor="openDate">{t.newTradePage.openDate}</label>
            <input id="openDate" type="date" value={form.openDate}
              onChange={(e) => update("openDate", e.target.value)}
              className={`mt-1 ${inputClasses} ${border()}`} />
          </div>

          <div>
            <label className={labelClasses} htmlFor="closeDate">{t.newTradePage.closeDate}</label>
            <input id="closeDate" type="date" value={form.closeDate}
              onChange={(e) => update("closeDate", e.target.value)}
              className={`mt-1 ${inputClasses} ${border()}`} />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClasses} htmlFor="notes">{t.newTradePage.notes}</label>
          <textarea id="notes" rows={3} value={form.notes} placeholder={t.newTradePage.notesPlaceholder}
            onChange={(e) => update("notes", e.target.value)}
            className="mt-1 w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary" />
        </div>

        {/* SOP 合规检查清单 */}
        <div className="mt-4 rounded-md border border-border bg-bg-surface">
          <button
            type="button"
            onClick={() => setShowSopChecklist((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text">{t.newTradePage.sopChecklist}</span>
              {form.sopCompliance.length > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {form.sopCompliance.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-text-muted">{t.newTradePage.sopChecklistHint}</span>
              <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${showSopChecklist ? "rotate-180" : ""}`} />
            </div>
          </button>

          {showSopChecklist && (
            <div className="border-t border-border px-4 py-3">
              {sopRules.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <p className="text-xs text-text-muted">{t.newTradePage.noSopRules}</p>
                  <Link to="/sop" className="text-xs font-medium text-primary hover:opacity-80">
                    {t.newTradePage.configureSop} →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {categoryMeta.map(({ key, label, dot }) => {
                    const rules = rulesByCategory[key];
                    if (rules.length === 0) return null;
                    return (
                      <div key={key}>
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
                          <span className="text-[11px] font-semibold text-text-secondary">{label}</span>
                        </div>
                        <div className="space-y-1">
                          {rules.map((rule) => {
                            const checked = form.sopCompliance.includes(rule.id);
                            return (
                              <button
                                key={rule.id}
                                type="button"
                                onClick={() => toggleSopRule(rule.id)}
                                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
                              >
                                {checked ? (
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                ) : (
                                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                                )}
                                <div className="min-w-0">
                                  <div className={`text-xs font-medium ${checked ? "text-text" : "text-text-secondary"}`}>
                                    {rule.title}
                                  </div>
                                  {rule.description && (
                                    <div className="text-[11px] text-text-muted">{rule.description}</div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
          <button type="button" onClick={() => navigate("/trades")}
            className="rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover">
            {t.newTradePage.cancel}
          </button>
          <button type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
            <Save className="h-4 w-4" />
            {t.newTradePage.saveTrade}
          </button>
        </div>
      </form>
    </Layout>
  );
}
