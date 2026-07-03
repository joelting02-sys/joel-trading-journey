import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import { useTradeStore } from "@/store/useTradeStore";
import type { PreMarketCheck, MarketBias, EmotionState } from "@/types";
import {
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
  Trash2,
  Shield,
  Target,
  Eye,
  Brain,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export default function PreMarket() {
  const language = useSettings((s) => s.language);
  const t = useSettings((s) => s.t());
  const accounts = useTradeStore((s) => s.accounts);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const preMarketChecks = useSettings((s) => s.preMarketChecks);
  const addPreMarketCheck = useSettings((s) => s.addPreMarketCheck);
  const deletePreMarketCheck = useSettings((s) => s.deletePreMarketCheck);

  const isZh = language === "zh";
  const today = new Date().toISOString().slice(0, 10);

  // 今天是否已有 checklist
  const todayCheck = useMemo(
    () => preMarketChecks.find((c) => c.date === today && (!activeAccountId || c.accountId === activeAccountId)),
    [preMarketChecks, today, activeAccountId]
  );

  const [form, setForm] = useState<Omit<PreMarketCheck, "id" | "completedAt">>({
    date: today,
    accountId: activeAccountId || accounts[0]?.id || "",
    bias: "neutral",
    biasReason: "",
    supportLevels: "",
    resistanceLevels: "",
    riskLimitType: "percent",
    riskLimitValue: 2,
    maxTrades: 3,
    watchlist: "",
    economicEvents: "",
    emotion: "calm",
    emotionNote: "",
    planNotes: "",
  });

  const [saved, setSaved] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    const check: PreMarketCheck = {
      ...form,
      id: `pm-${Date.now()}`,
      completedAt: new Date().toISOString(),
    };
    // 如果今天已有,先删掉旧的
    if (todayCheck) {
      deletePreMarketCheck(todayCheck.id);
    }
    addPreMarketCheck(check);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // 偏向选项
  const biasOptions: { value: MarketBias; labelZh: string; labelEn: string; icon: typeof TrendingUp; color: string }[] = [
    { value: "bullish", labelZh: "看多", labelEn: "Bullish", icon: TrendingUp, color: "text-profit border-profit/50 bg-profit/5" },
    { value: "bearish", labelZh: "看空", labelEn: "Bearish", icon: TrendingDown, color: "text-loss border-loss/50 bg-loss/5" },
    { value: "neutral", labelZh: "中性", labelEn: "Neutral", icon: Minus, color: "text-text-muted border-border bg-bg-elevated" },
  ];

  // 情绪选项
  const emotionOptions: { value: EmotionState; labelZh: string; labelEn: string; emoji: string }[] = [
    { value: "calm", labelZh: "平静", labelEn: "Calm", emoji: "😌" },
    { value: "confident", labelZh: "自信", labelEn: "Confident", emoji: "💪" },
    { value: "anxious", labelZh: "焦虑", labelEn: "Anxious", emoji: "😰" },
    { value: "excited", labelZh: "兴奋", labelEn: "Excited", emoji: "🤩" },
    { value: "frustrated", labelZh: "挫败", labelEn: "Frustrated", emoji: "😤" },
    { value: "tired", labelZh: "疲惫", labelEn: "Tired", emoji: "😴" },
  ];

  const inputClass = "w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors";
  const labelClass = "mb-1 block text-xs font-medium text-text-secondary";

  return (
    <Layout title={isZh ? "开盘前清单" : "Pre-Market Checklist"}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {/* 顶部说明 */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-surface px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-semibold text-text">
              {isZh ? "开盘前清单" : "Pre-Market Checklist"}
            </h1>
            <p className="text-xs text-text-secondary">
              {isZh
                ? "每天开盘前完成此清单,锁定偏向、风控限额和情绪状态。纪律从准备开始。"
                : "Complete this checklist before each session. Lock in your bias, risk limits, and emotional state."}
            </p>
          </div>
          {todayCheck && (
            <span className="flex items-center gap-1 rounded-full bg-profit/10 px-2.5 py-1 text-[11px] font-medium text-profit">
              <CheckCircle2 className="h-3 w-3" />
              {isZh ? "今日已完成" : "Done today"}
            </span>
          )}
        </div>

        {/* Checklist 表单 */}
        <div className="flex flex-col gap-5 rounded-lg border border-border bg-bg-surface px-5 py-4 shadow-sm">
          {/* 日期 + 账户 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                <CalendarDays className="mr-1 inline h-3 w-3" />
                {isZh ? "日期" : "Date"}
              </label>
              <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>
                <Shield className="mr-1 inline h-3 w-3" />
                {isZh ? "账户" : "Account"}
              </label>
              <select value={form.accountId} onChange={(e) => update("accountId", e.target.value)} className={inputClass}>
                <option value="">{isZh ? "无账户" : "No account"}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 1. 市场偏向 */}
          <Section icon={<Target className="h-4 w-4" />} title={isZh ? "1. 市场偏向" : "1. Market Bias"}>
            <div className="grid grid-cols-3 gap-2">
              {biasOptions.map((opt) => {
                const Icon = opt.icon;
                const selected = form.bias === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("bias", opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-md border px-3 py-3 text-xs font-medium transition-all ${
                      selected ? opt.color : "border-border bg-bg-elevated text-text-muted hover:border-text-muted hover:text-text"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {isZh ? opt.labelZh : opt.labelEn}
                  </button>
                );
              })}
            </div>
            <textarea
              value={form.biasReason}
              onChange={(e) => update("biasReason", e.target.value)}
              placeholder={isZh ? "为什么偏向这个方向? 依据是什么?" : "Why this bias? What's your reasoning?"}
              rows={2}
              className={`${inputClass} mt-2 resize-none`}
            />
          </Section>

          {/* 2. 关键价位 */}
          <Section icon={<Eye className="h-4 w-4" />} title={isZh ? "2. 关键价位" : "2. Key Levels"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  <span className="text-profit">●</span> {isZh ? "支撑位" : "Support Levels"}
                </label>
                <input
                  type="text"
                  value={form.supportLevels}
                  onChange={(e) => update("supportLevels", e.target.value)}
                  placeholder={isZh ? "如: 1.0850, 1.0800" : "e.g. 1.0850, 1.0800"}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <span className="text-loss">●</span> {isZh ? "阻力位" : "Resistance Levels"}
                </label>
                <input
                  type="text"
                  value={form.resistanceLevels}
                  onChange={(e) => update("resistanceLevels", e.target.value)}
                  placeholder={isZh ? "如: 1.0920, 1.0950" : "e.g. 1.0920, 1.0950"}
                  className={inputClass}
                />
              </div>
            </div>
          </Section>

          {/* 3. 风控限额 */}
          <Section icon={<Shield className="h-4 w-4" />} title={isZh ? "3. 风控限额" : "3. Risk Limits"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>{isZh ? "风险限额类型" : "Risk Limit Type"}</label>
                <select
                  value={form.riskLimitType}
                  onChange={(e) => update("riskLimitType", e.target.value as "amount" | "percent")}
                  className={inputClass}
                >
                  <option value="percent">{isZh ? "百分比 (%)" : "Percent (%)"}</option>
                  <option value="amount">{isZh ? "固定金额 ($)" : "Fixed Amount ($)"}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  {isZh ? "风险限额" : "Risk Limit"} {form.riskLimitType === "percent" ? "(%)" : "($)"}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.riskLimitValue}
                  onChange={(e) => update("riskLimitValue", parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{isZh ? "最大交易笔数" : "Max Trades"}</label>
                <input
                  type="number"
                  min="1"
                  value={form.maxTrades}
                  onChange={(e) => update("maxTrades", parseInt(e.target.value) || 1)}
                  className={inputClass}
                />
              </div>
            </div>
          </Section>

          {/* 4. 关注品种 & 经济数据 */}
          <Section icon={<Target className="h-4 w-4" />} title={isZh ? "4. 关注品种 & 经济数据" : "4. Watchlist & Economic Events"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{isZh ? "关注品种" : "Watchlist"}</label>
                <input
                  type="text"
                  value={form.watchlist}
                  onChange={(e) => update("watchlist", e.target.value)}
                  placeholder={isZh ? "EUR/USD, XAU/USD, ..." : "EUR/USD, XAU/USD, ..."}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{isZh ? "今日经济数据" : "Economic Events"}</label>
                <input
                  type="text"
                  value={form.economicEvents}
                  onChange={(e) => update("economicEvents", e.target.value)}
                  placeholder={isZh ? "如: 美国 CPI, 非农" : "e.g. US CPI, NFP"}
                  className={inputClass}
                />
              </div>
            </div>
          </Section>

          {/* 5. 情绪状态 */}
          <Section icon={<Brain className="h-4 w-4" />} title={isZh ? "5. 情绪状态" : "5. Emotional State"}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {emotionOptions.map((opt) => {
                const selected = form.emotion === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("emotion", opt.value)}
                    className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition-all ${
                      selected
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-bg-elevated text-text-muted hover:border-text-muted hover:text-text"
                    }`}
                  >
                    <span className="text-lg leading-none">{opt.emoji}</span>
                    {isZh ? opt.labelZh : opt.labelEn}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={form.emotionNote}
              onChange={(e) => update("emotionNote", e.target.value)}
              placeholder={isZh ? "补充说明(可选): 如昨晚没睡好..." : "Note (optional): e.g. didn't sleep well..."}
              className={`${inputClass} mt-2`}
            />
          </Section>

          {/* 6. 交易计划 */}
          <Section icon={<ClipboardCheck className="h-4 w-4" />} title={isZh ? "6. 交易计划" : "6. Trading Plan"}>
            <textarea
              value={form.planNotes}
              onChange={(e) => update("planNotes", e.target.value)}
              placeholder={isZh
                ? `今日计划:
- 等待什么信号入场?
- 在什么价位进场?
- 止损设在哪里?
- 目标价位是多少?`
                : `Today's plan:
- What signals to wait for?
- Entry price?
- Stop loss?
- Take profit?`}
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </Section>

          {/* 保存按钮 */}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-profit">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isZh ? "已保存" : "Saved"}
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <Save className="h-4 w-4" />
              {todayCheck ? (isZh ? "更新今日清单" : "Update Today's Checklist") : (isZh ? "保存清单" : "Save Checklist")}
            </button>
          </div>
        </div>

        {/* 历史记录 */}
        {preMarketChecks.length > 0 && (
          <div className="rounded-lg border border-border bg-bg-surface px-5 py-4 shadow-sm">
            <h2 className="mb-3 font-display text-sm font-semibold text-text">
              {isZh ? "历史记录" : "History"}
            </h2>
            <div className="flex flex-col gap-2">
              {preMarketChecks.slice(0, 10).map((check) => {
                const biasOpt = biasOptions.find((b) => b.value === check.bias);
                const BiasIcon = biasOpt?.icon;
                const emotionOpt = emotionOptions.find((e) => e.value === check.emotion);
                const acct = accounts.find((a) => a.id === check.accountId);
                return (
                  <div
                    key={check.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-bg-elevated/40 px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-text-muted">{check.date}</span>
                    {BiasIcon && <BiasIcon className={`h-3.5 w-3.5 ${biasOpt?.color.split(" ")[0]}`} />}
                    <span className="text-text-secondary">{isZh ? biasOpt?.labelZh : biasOpt?.labelEn}</span>
                    <span className="text-base leading-none">{emotionOpt?.emoji}</span>
                    <span className="text-text-muted">
                      {check.riskLimitType === "percent"
                        ? `${check.riskLimitValue}%`
                        : `$${check.riskLimitValue}`}
                    </span>
                    <span className="text-text-muted">·</span>
                    <span className="text-text-muted">{isZh ? `${check.maxTrades}笔` : `${check.maxTrades} trades`}</span>
                    {acct && <span className="text-text-muted">· {acct.name}</span>}
                    <button
                      type="button"
                      onClick={() => deletePreMarketCheck(check.id)}
                      className="ml-auto text-text-muted transition-colors hover:text-loss"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
