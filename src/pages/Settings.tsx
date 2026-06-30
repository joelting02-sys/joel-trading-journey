import { useState, type ReactNode } from "react";
import { Settings as SettingsIcon, Download, Trash2, Database, Palette, Info, Bot } from "lucide-react";
import Layout from "@/components/Layout";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings, type CurrencyCode } from "@/store/useSettings";
import type { Language } from "@/i18n/translations";

export default function Settings() {
  const accounts = useTradeStore((s) => s.accounts);
  const t = useSettings((s) => s.t());
  const { currency, setCurrency, language, setLanguage, aiConfig, setAiConfig } = useSettings();

  const [defaultAccount, setDefaultAccount] = useState(accounts[0]?.id ?? "");
  const [dateFormat, setDateFormat] = useState("MMM DD, YYYY");
  const [tradesPerPage, setTradesPerPage] = useState("25");
  const [compactMode, setCompactMode] = useState(false);
  const [showPnlInPips, setShowPnlInPips] = useState(false);

  const selectClass =
    "w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary";

  return (
    <Layout title={t.title.settings}>
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        {/* Preferences */}
        <SettingsSection
          icon={<SettingsIcon className="h-4 w-4" />}
          title={t.settingsPage.preferences}
          description={t.settingsPage.preferencesDesc}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.settingsPage.defaultAccount}>
              <select value={defaultAccount} onChange={(e) => setDefaultAccount(e.target.value)} className={selectClass}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {a.broker}</option>
                ))}
              </select>
            </Field>
            <Field label={t.settingsPage.dateFormat}>
              <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className={selectClass}>
                <option value="MMM DD, YYYY">MMM DD, YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </Field>
            <Field label={t.settingsPage.tradesPerPage}>
              <select value={tradesPerPage} onChange={(e) => setTradesPerPage(e.target.value)} className={selectClass}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </Field>
            <Field label={t.settingsPage.language}>
              <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={selectClass}>
                <option value="en">{t.settingsPage.english}</option>
                <option value="zh">{t.settingsPage.chinese}</option>
              </select>
            </Field>
          </div>
        </SettingsSection>

        {/* AI Configuration */}
        <SettingsSection
          icon={<Bot className="h-4 w-4" />}
          title={t.settingsPage.aiConfig}
          description={t.settingsPage.aiConfigDesc}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.settingsPage.apiEndpoint}>
              <input
                type="text"
                value={aiConfig.endpoint}
                onChange={(e) => setAiConfig({ endpoint: e.target.value })}
                placeholder={t.settingsPage.apiEndpointPlaceholder}
                className={selectClass}
              />
            </Field>
            <Field label={t.settingsPage.apiKey}>
              <input
                type="password"
                value={aiConfig.apiKey}
                onChange={(e) => setAiConfig({ apiKey: e.target.value })}
                placeholder={t.settingsPage.apiKeyPlaceholder}
                className={selectClass}
              />
            </Field>
            <Field label={t.settingsPage.modelName}>
              <input
                type="text"
                value={aiConfig.model}
                onChange={(e) => setAiConfig({ model: e.target.value })}
                placeholder={t.settingsPage.modelPlaceholder}
                className={selectClass}
              />
            </Field>
          </div>
          <p className="mt-3 text-xs text-text-muted">{t.settingsPage.aiConfigHint}</p>
        </SettingsSection>

        {/* Display */}
        <SettingsSection
          icon={<Palette className="h-4 w-4" />}
          title={t.settingsPage.display}
          description={t.settingsPage.displayDesc}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ToggleRow
              label={t.settingsPage.compactMode}
              hint={t.settingsPage.compactModeHint}
              checked={compactMode}
              onChange={setCompactMode}
            />
            <ToggleRow
              label={t.settingsPage.showPnlInPips}
              hint={t.settingsPage.showPnlInPipsHint}
              checked={showPnlInPips}
              onChange={setShowPnlInPips}
            />
            <Field label={t.settingsPage.currencyDisplay}>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className={selectClass}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="MYR">MYR (RM)</option>
              </select>
              <span className="text-xs text-text-muted">{t.settingsPage.currencyHint}</span>
            </Field>
          </div>
        </SettingsSection>

        {/* Data Management */}
        <SettingsSection
          icon={<Database className="h-4 w-4" />}
          title={t.settingsPage.dataManagement}
          description={t.settingsPage.dataManagementDesc}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-bg-hover">
              <Download className="h-4 w-4" />
              {t.settingsPage.exportCsv}
            </button>
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md border border-loss/30 bg-loss/8 px-4 py-2 text-sm font-medium text-loss transition-colors hover:bg-loss/14">
              <Trash2 className="h-4 w-4" />
              {t.settingsPage.clearAllTrades}
            </button>
          </div>
        </SettingsSection>

        {/* About */}
        <SettingsSection
          icon={<Info className="h-4 w-4" />}
          title={t.settingsPage.about}
          description={t.settingsPage.aboutDesc}
        >
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{t.settingsPage.application}</span>
              <span className="font-medium text-text">Trading Journal</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{t.settingsPage.version}</span>
              <span className="tj-number font-medium text-text">1.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{t.settingsPage.build}</span>
              <span className="tj-number font-medium text-text">2026.06.30</span>
            </div>
          </div>
        </SettingsSection>
      </div>
    </Layout>
  );
}

function SettingsSection({ icon, title, description, children }: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-bg-surface px-5 py-4">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-hover text-text-secondary">
          {icon}
        </div>
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight text-text">{title}</h2>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({ label, hint, checked, onChange }: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2.5">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-text">{label}</span>
        {hint && <span className="text-xs text-text-muted">{hint}</span>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-bg-hover"
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-4" : "translate-x-1"
      }`} />
    </button>
  );
}
