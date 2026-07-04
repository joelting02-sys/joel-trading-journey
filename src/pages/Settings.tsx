import { useState, useEffect, type ReactNode } from "react";
import { Settings as SettingsIcon, Download, Upload, Trash2, Database, Palette, Info, Bot, Plus, Star, X, Eye, EyeOff, FolderOpen, FolderCheck, AlertTriangle, RefreshCw, CalendarDays, FolderTree, FileJson, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings, type CurrencyCode } from "@/store/useSettings";
import type { AiConfigEntry, CalendarCountryCode, CalendarInstrumentCode, CalendarImportanceFilter } from "@/types";
import type { Language } from "@/i18n/translations";
import {
  isFileSystemSupported,
  pickDataDirectory,
  getLocation,
  requestDirectoryPermission,
  unbindDirectory,
  saveTradesToDisk,
  saveAccountsToDisk,
  saveSettingsToDisk,
  saveSopToDisk,
  getDirName,
  listDataFiles,
  readDataFileText,
  type DataLocation,
  exportAllToFile,
} from "@/services/dataStorage";
import { triggerSupabaseSync, getSupabaseClient } from "@/services/supabaseService";

export default function Settings() {
  const accounts = useTradeStore((s) => s.accounts);
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const { currency, setCurrency, setLanguage } = useSettings();
  const aiConfigs = useSettings((s) => s.aiConfigs);
  const activeAiConfigId = useSettings((s) => s.activeAiConfigId);
  const addAiConfigEntry = useSettings((s) => s.addAiConfigEntry);
  const updateAiConfigEntry = useSettings((s) => s.updateAiConfigEntry);
  const removeAiConfigEntry = useSettings((s) => s.removeAiConfigEntry);
  const setActiveAiConfigId = useSettings((s) => s.setActiveAiConfigId);
  const calendarPrefs = useSettings((s) => s.calendarPrefs);
  const setCalendarPrefs = useSettings((s) => s.setCalendarPrefs);
  const supabaseUrl = useSettings((s) => s.supabaseUrl);
  const supabaseAnonKey = useSettings((s) => s.supabaseAnonKey);
  const supabaseUserEmail = useSettings((s) => s.supabaseUserEmail);
  const supabaseSessionToken = useSettings((s) => s.supabaseSessionToken);
  const syncEnabled = useSettings((s) => s.syncEnabled);
  const lastSyncedAt = useSettings((s) => s.lastSyncedAt);

  const [defaultAccount, setDefaultAccount] = useState(accounts[0]?.id ?? "");
  const [dateFormat, setDateFormat] = useState("MMM DD, YYYY");
  const [tradesPerPage, setTradesPerPage] = useState("25");
  const [compactMode, setCompactMode] = useState(false);
  const [showPnlInPips, setShowPnlInPips] = useState(false);

  // 本地数据目录相关状态
  const [dataLocation, setDataLocation] = useState<DataLocation>(getLocation());
  const [migrating, setMigrating] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [locationError, setLocationError] = useState("");
  
  // 备份导入状态
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);

  // 文件夹浏览弹窗
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [fileList, setFileList] = useState<Array<{ name: string; size: number; lastModified: number }>>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState(false);

  // 云端同步相关状态
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [showSupabasePassword, setShowSupabasePassword] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  async function handleCloudSync() {
    setSyncingCloud(true);
    setSyncError("");
    setSyncSuccess(false);
    setSyncStatusMsg("");
    try {
      const res = await triggerSupabaseSync();
      if (res.success) {
        setSyncSuccess(true);
        if (res.status === "synced") {
          setSyncStatusMsg(language === "zh" ? "同步成功：数据已保存至云端。" : "Synced: Data uploaded to cloud.");
        } else if (res.status === "updated_server") {
          setSyncStatusMsg(language === "zh" ? "云端数据已成功更新为最新本地数据。" : "Cloud data updated to latest local data.");
        } else if (res.status === "updated_client") {
          setSyncStatusMsg(language === "zh" ? "本地数据已成功更新为最新云端数据。" : "Local data updated to latest cloud data.");
        } else if (res.status === "in_sync") {
          setSyncStatusMsg(language === "zh" ? "两端数据已是一致，无需更新。" : "Data is already in sync.");
        }
      } else {
        setSyncError(res.error || "Sync failed");
      }
    } catch (e) {
      setSyncError((e as Error).message || "Sync failed");
    } finally {
      setSyncingCloud(false);
    }
  }

  async function handleAuth() {
    if (!email.trim() || !password) {
      setSyncError(language === "zh" ? "请输入邮箱和密码" : "Please enter email and password");
      return;
    }
    setAuthenticating(true);
    setSyncError("");
    setSyncSuccess(false);
    setSyncStatusMsg("");
    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error(language === "zh" ? "请先配置并保存 Supabase URL 和 Anon Key" : "Please configure Supabase URL and Anon Key first");
      }

      if (authMode === "login") {
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (data.session && data.user) {
          useSettings.setState({
            supabaseUserEmail: data.user.email || "",
            supabaseSessionToken: data.session.access_token || ""
          });
          // Wait a bit and trigger initial sync
          setTimeout(handleCloudSync, 200);
        }
      } else {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        setSyncSuccess(true);
        setSyncStatusMsg(language === "zh" ? "注册成功！请检查你的邮箱以确认账号，或直接尝试登录。" : "Sign up successful! Please check your email or try logging in.");
        setAuthMode("login");
      }
    } catch (e) {
      setSyncError((e as Error).message || "Auth failed");
    } finally {
      setAuthenticating(false);
    }
  }

  async function handleSignOut() {
    setSyncError("");
    setSyncSuccess(false);
    setSyncStatusMsg("");
    try {
      const client = getSupabaseClient();
      if (client) {
        await client.auth.signOut();
      }
    } catch (e) {
      // Ignore auth error on sign out
    } finally {
      useSettings.setState({
        supabaseUserEmail: "",
        supabaseSessionToken: "",
        lastSyncedAt: 0
      });
      setEmail("");
      setPassword("");
    }
  }

  // 自动填充默认的 Supabase 凭证
  useEffect(() => {
    const settings = useSettings.getState();
    if (!settings.supabaseUrl) {
      settings.setSupabaseUrl("https://imemwbgtxnkfodncfgal.supabase.co");
    }
    if (!settings.supabaseAnonKey) {
      settings.setSupabaseAnonKey("sb_publishable_CWNd8zRNESxUvpNZ7BA16Q_UA1DjMuO");
    }
  }, []);



  async function handlePickFolder() {
    setLocationError("");
    try {
      await pickDataDirectory();
      setDataLocation("filesystem");
      // 立即触发一次全量写入,把现有数据落地
      await migrateToDisk();
    } catch (e) {
      setLocationError((e as Error).message || "Failed to pick folder");
    }
  }

  async function handleReauth() {
    setLocationError("");
    try {
      const ok = await requestDirectoryPermission();
      if (ok) {
        setDataLocation("filesystem");
        await migrateToDisk();
      } else {
        setLocationError(language === "zh" ? "权限被拒绝" : "Permission denied");
      }
    } catch (e) {
      setLocationError((e as Error).message || "Failed");
    }
  }

  async function handleUnbind() {
    if (!window.confirm(language === "zh"
      ? "确定解除绑定?解除后将只使用浏览器缓存(数据有丢失风险)。"
      : "Unbind? Will only use browser cache after this (data loss risk)."
    )) return;
    await unbindDirectory();
    setDataLocation("none");
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError("");
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error(language === "zh" ? "读取文件失败" : "Failed to read file");

        const parsed = JSON.parse(text);

        // 定义待应用的 Store 状态
        let tradesToSet: any[] | null = null;
        let accountsToSet: any[] | null = null;
        let settingsToSet: any = null;
        let sopRulesToSet: any[] | null = null;

        // 1) 检测合并备份格式 (即由「导出备份数据」生成的包含 tradesStore 或 settingsStore 的 JSON)
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed.tradesStore || parsed.settingsStore || parsed.trades || parsed.settings)) {
          const tradesObj = parsed.tradesStore || parsed.trades;
          if (tradesObj) {
            const tState = tradesObj.state || tradesObj;
            if (Array.isArray(tState.trades)) tradesToSet = tState.trades;
            if (Array.isArray(tState.accounts)) accountsToSet = tState.accounts;
          }
          const settingsObj = parsed.settingsStore || parsed.settings;
          if (settingsObj) {
            const sState = settingsObj.state || settingsObj;
            settingsToSet = sState;
            if (Array.isArray(sState.sopRules)) sopRulesToSet = sState.sopRules;
          }
        }
        // 2) 检测单个 Array 结构文件 (如 trades.json, accounts.json, sop.json)
        else if (Array.isArray(parsed)) {
          if (parsed.length === 0) {
            throw new Error(language === "zh" ? "上传的 JSON 数组为空，无法判断数据类型" : "Uploaded JSON array is empty, cannot determine type");
          }
          const firstItem = parsed[0];
          if (firstItem && typeof firstItem === "object") {
            if ("symbol" in firstItem && "entryPrice" in firstItem) {
              tradesToSet = parsed; // trades.json
            } else if ("balance" in firstItem && "equity" in firstItem) {
              accountsToSet = parsed; // accounts.json
            } else if ("category" in firstItem && "title" in firstItem) {
              sopRulesToSet = parsed; // sop.json
            } else {
              throw new Error(language === "zh" ? "无法识别的 JSON 数组结构" : "Unrecognized JSON array structure");
            }
          } else {
            throw new Error(language === "zh" ? "无效的 JSON 数组类型" : "Invalid JSON array type");
          }
        }
        // 3) 检测单个 Object 结构文件 (如 settings.json)
        else if (parsed && typeof parsed === "object") {
          if ("aiConfigs" in parsed || "language" in parsed || "currency" in parsed) {
            settingsToSet = parsed; // settings.json
            if (Array.isArray(parsed.sopRules)) {
              sopRulesToSet = parsed.sopRules;
            }
          } else {
            throw new Error(language === "zh" ? "无法识别的 JSON 对象结构" : "Unrecognized JSON object structure");
          }
        } else {
          throw new Error(language === "zh" ? "无效的 JSON 数据" : "Invalid JSON data");
        }

        // 应用解析出的数据到相应 Zustand 仓库
        let updatedAny = false;

        if (tradesToSet !== null) {
          useTradeStore.setState({ trades: tradesToSet });
          updatedAny = true;
        }
        if (accountsToSet !== null) {
          useTradeStore.setState({ 
            accounts: accountsToSet,
            activeAccountId: accountsToSet[0]?.id || ""
          });
          updatedAny = true;
        }
        if (sopRulesToSet !== null) {
          useSettings.setState({ sopRules: sopRulesToSet });
          updatedAny = true;
        }
        if (settingsToSet !== null) {
          const s = settingsToSet;
          const currentSettings = useSettings.getState();
          useSettings.setState({
            language: s.language || currentSettings.language,
            currency: s.currency || currentSettings.currency,
            aiConfigs: Array.isArray(s.aiConfigs) ? s.aiConfigs : currentSettings.aiConfigs,
            activeAiConfigId: s.activeAiConfigId || currentSettings.activeAiConfigId,
            calendarPrefs: s.calendarPrefs || currentSettings.calendarPrefs,
            calendarContent: s.calendarContent !== undefined ? s.calendarContent : currentSettings.calendarContent,
            preMarketChecks: Array.isArray(s.preMarketChecks) ? s.preMarketChecks : currentSettings.preMarketChecks,
            positionCalcHistory: Array.isArray(s.positionCalcHistory) ? s.positionCalcHistory : currentSettings.positionCalcHistory,
          });
          updatedAny = true;
        }

        if (!updatedAny) {
          throw new Error(language === "zh" ? "未检测到可导入的有效数据" : "No valid data detected to import");
        }

        // 强制更新时间戳以触发云端同步
        useSettings.getState().updateClientTimestamp();

        setImportSuccess(true);
        
        // If logged in, trigger supabase sync immediately
        const client = getSupabaseClient();
        const sessionToken = useSettings.getState().supabaseSessionToken;
        if (client && sessionToken) {
          setSyncStatusMsg(language === "zh" ? "导入成功！正在同步至云端..." : "Import successful! Syncing to cloud...");
          const res = await triggerSupabaseSync();
          if (res.success) {
            setSyncSuccess(true);
            setSyncStatusMsg(language === "zh" ? "导入成功且云端同步完成！" : "Import successful and synced to cloud!");
          } else {
            setSyncError(res.error || "Cloud sync failed");
          }
        } else {
          setSyncStatusMsg(language === "zh" ? "导入成功！(数据已保存在本地)" : "Import successful! (Data saved locally)");
        }
      } catch (err: any) {
        setImportError(err.message || String(err));
      } finally {
        setImporting(false);
        e.target.value = "";
      }
    };

    reader.onerror = () => {
      setImportError(language === "zh" ? "读取文件出错" : "Error reading file");
      setImporting(false);
      e.target.value = "";
    };

    reader.readAsText(file);
  }

  // 把当前 store 数据全量写一次到磁盘
  async function migrateToDisk() {
    setMigrating(true);
    setMigrated(false);
    try {
      const ts = useTradeStore.getState();
      const ss = useSettings.getState();
      await Promise.all([
        saveTradesToDisk(ts.trades),
        saveAccountsToDisk(ts.accounts),
        saveSopToDisk(ss.sopRules),
        saveSettingsToDisk({
          language: ss.language,
          currency: ss.currency,
          aiConfigs: ss.aiConfigs,
          activeAiConfigId: ss.activeAiConfigId,
          calendarPrefs: ss.calendarPrefs,
          calendarContent: ss.calendarContent,
          calendarUpdatedAt: ss.calendarUpdatedAt,
        }),
      ]);
      setMigrated(true);
      setTimeout(() => setMigrated(false), 3000);
    } catch (e) {
      setLocationError((e as Error).message || "Migration failed");
    } finally {
      setMigrating(false);
    }
  }

  // 打开文件夹浏览器弹窗
  async function handleOpenFolder() {
    setShowFileBrowser(true);
    setSelectedFile(null);
    setFileContent("");
    try {
      const files = await listDataFiles();
      setFileList(files);
    } catch (e) {
      setFileList([]);
    }
  }

  // 查看单个文件内容
  async function handleViewFile(name: string) {
    setSelectedFile(name);
    setLoadingFile(true);
    setFileContent("");
    try {
      const text = await readDataFileText(name);
      setFileContent(text);
    } catch (e) {
      setFileContent(language === "zh" ? "读取失败" : "Read failed");
    } finally {
      setLoadingFile(false);
    }
  }

  // 下载单个文件
  function handleDownloadFile(name: string, content: string) {
    const blob = new Blob([content], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleAddConfig() {
    addAiConfigEntry({
      name: language === "zh" ? `配置 ${aiConfigs.length + 1}` : `Config ${aiConfigs.length + 1}`,
      endpoint: "",
      apiKey: "",
      model: "",
    });
  }

  const selectClass =
    "w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary";
  const inputClass = selectClass;

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
          {aiConfigs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-bg-elevated/40 px-4 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-text-secondary">
                {t.settingsPage.aiConfigEmpty}
              </p>
              <button
                type="button"
                onClick={handleAddConfig}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                {t.settingsPage.aiAddConfig}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {aiConfigs.map((cfg) => (
                <AiConfigCard
                  key={cfg.id}
                  config={cfg}
                  isActive={cfg.id === activeAiConfigId}
                  onSetActive={() => setActiveAiConfigId(cfg.id)}
                  onUpdate={(patch) => updateAiConfigEntry(cfg.id, patch)}
                  onRemove={() => removeAiConfigEntry(cfg.id)}
                  inputClass={inputClass}
                  language={language}
                  labels={{
                    setActive: t.settingsPage.aiSetActive,
                    active: t.settingsPage.aiActive,
                    configName: t.settingsPage.aiConfigName,
                    apiEndpoint: t.settingsPage.apiEndpoint,
                    apiKey: t.settingsPage.apiKey,
                    modelName: t.settingsPage.modelName,
                    apiEndpointPlaceholder: t.settingsPage.apiEndpointPlaceholder,
                    apiKeyPlaceholder: t.settingsPage.apiKeyPlaceholder,
                    modelPlaceholder: t.settingsPage.modelPlaceholder,
                    delete: t.settingsPage.aiDeleteConfig,
                    deleteConfirm: t.settingsPage.aiDeleteConfirm,
                  }}
                />
              ))}
              <button
                type="button"
                onClick={handleAddConfig}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-bg-surface px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-primary hover:bg-bg-hover hover:text-text"
              >
                <Plus className="h-4 w-4" />
                {t.settingsPage.aiAddConfig}
              </button>
            </div>
          )}
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

        {/* 经济日历偏好 - 用于 AI 周历汇总 */}
        <SettingsSection
          icon={<CalendarDays className="h-4 w-4" />}
          title={language === "zh" ? "经济日历偏好" : "Economic Calendar Preferences"}
          description={
            language === "zh"
              ? "在 AI 面板点击「本周经济日历」时,AI 会按下方配置生成结构化周历。"
              : "Used by the AI Assistant's 'This Week's Calendar' quick action."
          }
        >
          <CalendarPrefsEditor
            prefs={calendarPrefs}
            onChange={setCalendarPrefs}
            language={language}
          />
        </SettingsSection>

        {/* Local Data Backup & Recovery */}
        <SettingsSection
          icon={<Database className="h-4 w-4" />}
          title={language === "zh" ? "本地数据备份与恢复" : "Local Data Backup & Recovery"}
          description={
            language === "zh"
              ? "您可以导出当前所有数据的 JSON 备份文件，或上传备份文件来恢复数据。上传的备份数据將自动同步至云端数据库。"
              : "Export a JSON backup of all your data, or upload a backup file to restore your data. Restored data will sync to the cloud database automatically."
          }
        >
          {importError && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-loss/30 bg-loss/5 px-3 py-2 text-xs text-loss">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{importError}</span>
            </div>
          )}
          {importSuccess && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
              <FolderCheck className="h-3.5 w-3.5 shrink-0" />
              <span>
                {language === "zh"
                  ? "数据恢复成功！已更新本地状态。"
                  : "Data restored successfully! Local state updated."}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {/* Upload Data Button */}
            <label className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 cursor-pointer">
              <Upload className="h-4 w-4" />
              {importing
                ? (language === "zh" ? "正在导入..." : "Importing...")
                : (language === "zh" ? "上传备份数据" : "Upload Backup Data")}
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                disabled={importing}
                className="hidden"
              />
            </label>

            {/* Export Data Button */}
            <button
              type="button"
              onClick={exportAllToFile}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-bg-hover"
            >
              <Download className="h-4 w-4" />
              {language === "zh" ? "导出备份数据" : "Export Backup Data"}
            </button>
          </div>
        </SettingsSection>

        {/* Supabase Cloud Sync */}
        <SettingsSection
          icon={<RefreshCw className="h-4 w-4" />}
          title={language === "zh" ? "Supabase 云端账号同步" : "Supabase Cloud Sync"}
          description={
            language === "zh"
              ? "使用 Supabase 用户认证与 Postgres 数据库，在手机与电脑之间多端同步你的交易日志。"
              : "Sync your journal data between mobile and desktop devices using Supabase Auth & Postgres."
          }
        >
          {syncError && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-loss/30 bg-loss/5 px-3 py-2 text-xs text-loss">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{syncError}</span>
            </div>
          )}
          {syncSuccess && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
              <FolderCheck className="h-3.5 w-3.5 shrink-0" />
              <span>{syncStatusMsg}</span>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Supabase Connection Status (Fully Private & Encrypted) */}
            <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary font-medium">
              <FolderCheck className="h-4 w-4 shrink-0" />
              <span>
                {language === "zh"
                  ? "已加密内置云端数据库连接（安全保密）"
                  : "Private Cloud Database Connected (Secure)"}
              </span>
            </div>

            {/* Authentication Form / Logged in status */}
            {supabaseSessionToken ? (
              <div className="rounded-md border border-border bg-bg-surface/50 p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-text-muted block">
                        {language === "zh" ? "已登录账号" : "Logged in as"}
                      </span>
                      <span className="text-sm font-medium text-text">
                        {supabaseUserEmail}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="rounded-md border border-loss/30 px-3 py-1.5 text-xs font-medium text-loss transition-colors hover:bg-loss/5"
                    >
                      {language === "zh" ? "退出登录" : "Logout"}
                    </button>
                  </div>

                  <div className="border-t border-border pt-3 mt-1">
                    <ToggleRow
                      label={language === "zh" ? "启用云同步" : "Enable Cloud Sync"}
                      hint={
                        language === "zh"
                          ? "开启后，本设备发生数据修改时会自动与云端进行静默同步。"
                          : "Automatically sync data to the cloud in the background when changes are made."
                      }
                      checked={syncEnabled}
                      onChange={(val) => {
                        useSettings.setState({ syncEnabled: val });
                        if (val) {
                          setTimeout(handleCloudSync, 100);
                        }
                      }}
                    />
                  </div>

                  {syncEnabled && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 mt-1">
                      <button
                        type="button"
                        onClick={handleCloudSync}
                        disabled={syncingCloud}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 ${syncingCloud ? "animate-spin" : ""}`} />
                        {language === "zh" ? "立即同步" : "Sync Now"}
                      </button>
                      {(lastSyncedAt || 0) > 0 && (
                        <span className="text-xs text-text-muted">
                          {language === "zh" ? "上次同步时间: " : "Last synced: "}
                          {new Date(lastSyncedAt || 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-border bg-bg-surface/50 p-4">
                <div className="mb-4 border-b border-border pb-2 flex gap-4">
                  <button
                    type="button"
                    onClick={() => { setAuthMode("login"); setSyncError(""); }}
                    className={`text-sm pb-2 font-medium border-b-2 transition-all ${authMode === "login" ? "border-primary text-primary" : "border-transparent text-text-muted"}`}
                  >
                    {language === "zh" ? "账号登录" : "Login"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode("register"); setSyncError(""); }}
                    className={`text-sm pb-2 font-medium border-b-2 transition-all ${authMode === "register" ? "border-primary text-primary" : "border-transparent text-text-muted"}`}
                  >
                    {language === "zh" ? "注册新账号" : "Register"}
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <Field label={language === "zh" ? "邮箱" : "Email"}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className={inputClass}
                      disabled={!supabaseUrl || !supabaseAnonKey}
                    />
                  </Field>
                  <Field label={language === "zh" ? "密码" : "Password"}>
                    <div className="relative flex items-center">
                      <input
                        type={showSupabasePassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${inputClass} pr-10`}
                        disabled={!supabaseUrl || !supabaseAnonKey}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSupabasePassword(!showSupabasePassword)}
                        className="absolute right-3 text-text-muted hover:text-text"
                      >
                        {showSupabasePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>

                  <button
                    type="button"
                    onClick={handleAuth}
                    disabled={authenticating || !supabaseUrl || !supabaseAnonKey}
                    className="w-full justify-center inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 mt-2"
                  >
                    {authenticating ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    {authMode === "login"
                      ? (language === "zh" ? "登 录" : "Log In")
                      : (language === "zh" ? "注 册" : "Sign Up")}
                  </button>

                  {(!supabaseUrl || !supabaseAnonKey) && (
                    <p className="text-xs text-warning mt-1">
                      {language === "zh" ? "⚠️ 请先在上方配置 Supabase URL 与 Anon Key 凭证才能登录。" : "⚠️ Please enter your Supabase URL & Anon Key credentials first."}
                    </p>
                  )}
                </div>
              </div>
            )}
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

      {/* 文件夹浏览弹窗 */}
      {showFileBrowser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowFileBrowser(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <FolderTree className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-body text-base font-semibold text-text">
                    {language === "zh" ? "数据文件夹" : "Data Folder"}
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    {getDirName() || (language === "zh" ? "未命名文件夹" : "Unnamed folder")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFileBrowser(false)}
                className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* 弹窗内容：左侧文件列表 + 右侧文件内容 */}
            <div className="flex min-h-0 flex-1">
              {/* 左侧文件列表 */}
              <div className="w-56 shrink-0 border-r border-border bg-bg-base/50 p-3">
                <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  {language === "zh" ? "文件列表" : "Files"}
                </p>
                <div className="flex flex-col gap-1">
                  {fileList.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-text-muted">
                      {language === "zh" ? "暂无文件" : "No files"}
                    </p>
                  ) : (
                    fileList.map((f) => (
                      <button
                        key={f.name}
                        type="button"
                        onClick={() => handleViewFile(f.name)}
                        className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                          selectedFile === f.name
                            ? "bg-primary/10 text-primary"
                            : "text-text-secondary hover:bg-bg-hover hover:text-text"
                        }`}
                      >
                        <FileJson className="h-3.5 w-3.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{f.name}</div>
                          <div className="text-[10px] text-text-muted">
                            {(f.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        {selectedFile === f.name && (
                          <ChevronRight className="h-3 w-3 shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* 右侧文件内容 */}
              <div className="flex min-w-0 flex-1 flex-col">
                {selectedFile ? (
                  <>
                    <div className="flex items-center justify-between border-b border-border px-4 py-2">
                      <span className="font-mono text-xs text-text-secondary">
                        {selectedFile}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(selectedFile, fileContent)}
                        disabled={!fileContent || loadingFile}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-surface px-2.5 py-1 text-[11px] font-medium text-text transition-colors hover:bg-bg-hover disabled:opacity-50"
                      >
                        <Download className="h-3 w-3" />
                        {language === "zh" ? "下载" : "Download"}
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto p-4">
                      {loadingFile ? (
                        <div className="flex h-full items-center justify-center">
                          <RefreshCw className="h-5 w-5 animate-spin text-text-muted" />
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-text">
                          {fileContent || (language === "zh" ? "（空文件）" : "(empty)")}
                        </pre>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                    <FileJson className="h-10 w-10 text-text-muted opacity-40" />
                    <p className="text-sm text-text-muted">
                      {language === "zh"
                        ? "点击左侧文件查看内容"
                        : "Click a file on the left to view content"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 弹窗底部提示 */}
            <div className="border-t border-border px-5 py-2.5">
              <p className="text-[10px] text-text-muted">
                {language === "zh"
                  ? "💡 浏览器安全限制下无法直接打开系统文件管理器，可在此查看和下载数据文件。"
                  : "💡 Browser security prevents opening the system file manager directly. You can view and download data files here."}
              </p>
            </div>
          </div>
        </div>
      )}
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

// 单个 AI 配置卡片:含名称/端点/密钥/模型,带 active 标记和删除按钮
function AiConfigCard({
  config, isActive, onSetActive, onUpdate, onRemove, inputClass, language, labels,
}: {
  config: AiConfigEntry;
  isActive: boolean;
  onSetActive: () => void;
  onUpdate: (patch: Partial<Omit<AiConfigEntry, "id">>) => void;
  onRemove: () => void;
  inputClass: string;
  language: Language;
  labels: {
    setActive: string;
    active: string;
    configName: string;
    apiEndpoint: string;
    apiKey: string;
    modelName: string;
    apiEndpointPlaceholder: string;
    apiKeyPlaceholder: string;
    modelPlaceholder: string;
    delete: string;
    deleteConfirm: string;
  };
}) {
  const [showKey, setShowKey] = useState(false);
  const isZh = language === "zh";
  return (
    <div
      className={`rounded-md border bg-bg-surface px-4 py-3 transition-colors ${
        isActive ? "border-primary/40 bg-primary/5" : "border-border"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        {/* Active 单选按钮(圆圈) */}
        <button
          type="button"
          onClick={onSetActive}
          title={isActive ? labels.active : labels.setActive}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            isActive ? "border-primary bg-primary text-white" : "border-border bg-bg-surface text-transparent hover:border-text-secondary"
          }`}
        >
          {isActive && <Star className="h-3 w-3" fill="currentColor" />}
        </button>
        <input
          type="text"
          value={config.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder={labels.configName}
          className={`flex-1 rounded-sm border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-text outline-none transition-colors hover:border-border focus:border-primary ${
            isActive ? "" : ""
          }`}
        />
        {isActive && (
          <span className="rounded-sm bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            {labels.active}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(labels.deleteConfirm)) onRemove();
          }}
          title={labels.delete}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-loss/10 hover:text-loss"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={labels.apiEndpoint}>
          <input
            type="text"
            value={config.endpoint}
            onChange={(e) => onUpdate({ endpoint: e.target.value })}
            placeholder={labels.apiEndpointPlaceholder}
            className={inputClass}
          />
        </Field>
        <Field label={labels.apiKey}>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => onUpdate({ apiKey: e.target.value })}
              placeholder={labels.apiKeyPlaceholder}
              className={inputClass + " pr-9"}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              title={showKey ? (isZh ? "隐藏" : "Hide") : (isZh ? "显示" : "Show")}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </Field>
        <Field label={labels.modelName}>
          <input
            type="text"
            value={config.model}
            onChange={(e) => onUpdate({ model: e.target.value })}
            placeholder={labels.modelPlaceholder}
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}

// 经济日历偏好编辑器(国家/品种/重要性三维度勾选 + 两个开关)
function CalendarPrefsEditor({
  prefs,
  onChange,
  language,
}: {
  prefs: import("@/types").CalendarPreferences;
  onChange: (prefs: import("@/types").CalendarPreferences) => void;
  language: Language;
}) {
  const isZh = language === "zh";

  // 国家/地区配置(代码、旗帜、中英文名)
  const countryOptions: { code: CalendarCountryCode; flag: string; nameZh: string; nameEn: string }[] = [
    { code: "US", flag: "🇺🇸", nameZh: "美国", nameEn: "United States" },
    { code: "EU", flag: "🇪🇺", nameZh: "欧元区", nameEn: "Eurozone" },
    { code: "GB", flag: "🇬🇧", nameZh: "英国", nameEn: "United Kingdom" },
    { code: "JP", flag: "🇯🇵", nameZh: "日本", nameEn: "Japan" },
    { code: "AU", flag: "🇦🇺", nameZh: "澳大利亚", nameEn: "Australia" },
    { code: "CA", flag: "🇨🇦", nameZh: "加拿大", nameEn: "Canada" },
    { code: "CH", flag: "🇨🇭", nameZh: "瑞士", nameEn: "Switzerland" },
    { code: "CN", flag: "🇨🇳", nameZh: "中国", nameEn: "China" },
    { code: "NZ", flag: "🇳🇿", nameZh: "新西兰", nameEn: "New Zealand" },
  ];

  // 品种配置(标签 + 分组)
  const instrumentOptions: { code: CalendarInstrumentCode; label: string; group: "forex" | "metals" | "indices" }[] = [
    { code: "EURUSD", label: "EUR/USD", group: "forex" },
    { code: "AUDUSD", label: "AUD/USD", group: "forex" },
    { code: "GBPUSD", label: "GBP/USD", group: "forex" },
    { code: "USDJPY", label: "USD/JPY", group: "forex" },
    { code: "USDCAD", label: "USD/CAD", group: "forex" },
    { code: "EURJPY", label: "EUR/JPY", group: "forex" },
    { code: "GBPJPY", label: "GBP/JPY", group: "forex" },
    { code: "AUDJPY", label: "AUD/JPY", group: "forex" },
    { code: "EURGBP", label: "EUR/GBP", group: "forex" },
    { code: "XAUUSD", label: "Gold (XAU/USD)", group: "metals" },
    { code: "XAGUSD", label: "Silver (XAG/USD)", group: "metals" },
    { code: "Copper", label: "Copper", group: "metals" },
    { code: "US500", label: "S&P 500 (US500)", group: "indices" },
    { code: "US30", label: "Dow Jones (US30)", group: "indices" },
    { code: "NAS100", label: "Nasdaq (NAS100)", group: "indices" },
    { code: "GER40", label: "DAX (GER40)", group: "indices" },
  ];

  // 切换国家勾选
  function toggleCountry(code: CalendarCountryCode) {
    const has = prefs.countries.includes(code);
    onChange({
      ...prefs,
      countries: has ? prefs.countries.filter((c) => c !== code) : [...prefs.countries, code],
    });
  }

  // 切换品种勾选
  function toggleInstrument(code: CalendarInstrumentCode) {
    const has = prefs.instruments.includes(code);
    onChange({
      ...prefs,
      instruments: has ? prefs.instruments.filter((c) => c !== code) : [...prefs.instruments, code],
    });
  }

  // 全选/全清当前分组品种
  function toggleInstrumentGroup(group: "forex" | "metals" | "indices") {
    const groupInstruments = instrumentOptions.filter((i) => i.group === group).map((i) => i.code);
    const allSelected = groupInstruments.every((c) => prefs.instruments.includes(c));
    if (allSelected) {
      onChange({ ...prefs, instruments: prefs.instruments.filter((c) => !groupInstruments.includes(c)) });
    } else {
      const merged = new Set([...prefs.instruments, ...groupInstruments]);
      onChange({ ...prefs, instruments: Array.from(merged) });
    }
  }

  // 全部国家
  function toggleAllCountries() {
    if (prefs.countries.length === countryOptions.length) {
      onChange({ ...prefs, countries: [] });
    } else {
      onChange({ ...prefs, countries: countryOptions.map((c) => c.code) });
    }
  }

  // 全部品种
  function toggleAllInstruments() {
    if (prefs.instruments.length === instrumentOptions.length) {
      onChange({ ...prefs, instruments: [] });
    } else {
      onChange({ ...prefs, instruments: instrumentOptions.map((i) => i.code) });
    }
  }

  // 重要性筛选
  const importanceOptions: { value: CalendarImportanceFilter; labelZh: string; labelEn: string; hint: string }[] = [
    { value: "high_only", labelZh: "仅高(⭐⭐⭐)", labelEn: "High only (⭐⭐⭐)", hint: isZh ? "只看对市场影响最大的事件" : "Major market movers only" },
    { value: "medium_and_high", labelZh: "中+高(⭐⭐以上)", labelEn: "Medium & High (⭐⭐+)", hint: isZh ? "推荐设置,平衡信息密度" : "Recommended, balanced" },
    { value: "all", labelZh: "全部(⭐及以上)", labelEn: "All (⭐+)", hint: isZh ? "包含低重要性事件" : "Include low importance" },
  ];

  const groupLabels: Record<"forex" | "metals" | "indices", { zh: string; en: string }> = {
    forex: { zh: "外汇", en: "Forex" },
    metals: { zh: "贵金属/工业金属", en: "Metals" },
    indices: { zh: "指数", en: "Indices" },
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 国家勾选 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary">
            {isZh ? "关注的国家/地区" : "Focus Countries"}
          </span>
          <button
            type="button"
            onClick={toggleAllCountries}
            className="text-[11px] text-text-muted transition-colors hover:text-primary"
          >
            {prefs.countries.length === countryOptions.length
              ? (isZh ? "全部取消" : "Deselect All")
              : (isZh ? "全选" : "Select All")}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {countryOptions.map((c) => {
            const checked = prefs.countries.includes(c.code);
            return (
              <label
                key={c.code}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  checked
                    ? "border-primary/50 bg-primary/5 text-text"
                    : "border-border bg-bg-elevated text-text-muted hover:border-text-muted hover:text-text"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCountry(c.code)}
                  className="h-3.5 w-3.5 cursor-pointer accent-primary"
                />
                <span className="text-base leading-none">{c.flag}</span>
                <span className="font-medium">{isZh ? c.nameZh : c.nameEn}</span>
                <span className="ml-auto text-[10px] text-text-muted">{c.code}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 品种勾选 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary">
            {isZh ? "关注的交易品种" : "Focus Instruments"}
          </span>
          <button
            type="button"
            onClick={toggleAllInstruments}
            className="text-[11px] text-text-muted transition-colors hover:text-primary"
          >
            {prefs.instruments.length === instrumentOptions.length
              ? (isZh ? "全部取消" : "Deselect All")
              : (isZh ? "全选" : "Select All")}
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {(["forex", "metals", "indices"] as const).map((group) => {
            const groupInstruments = instrumentOptions.filter((i) => i.group === group);
            const allSelected = groupInstruments.every((i) => prefs.instruments.includes(i.code));
            return (
              <div key={group}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-medium text-text-muted">
                    {isZh ? groupLabels[group].zh : groupLabels[group].en}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleInstrumentGroup(group)}
                    className="text-[10px] text-text-muted transition-colors hover:text-primary"
                  >
                    {allSelected ? (isZh ? "取消该组" : "Clear group") : (isZh ? "选择该组" : "Select group")}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {groupInstruments.map((inst) => {
                    const checked = prefs.instruments.includes(inst.code);
                    return (
                      <label
                        key={inst.code}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                          checked
                            ? "border-primary/50 bg-primary/5 text-text"
                            : "border-border bg-bg-elevated text-text-muted hover:border-text-muted hover:text-text"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInstrument(inst.code)}
                          className="h-3 w-3 cursor-pointer accent-primary"
                        />
                        <span className="font-medium">{inst.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 重要性筛选 */}
      <div>
        <span className="mb-2 block text-xs font-semibold text-text-secondary">
          {isZh ? "重要性筛选" : "Importance Filter"}
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {importanceOptions.map((opt) => {
            const selected = prefs.importance === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-md border px-3 py-2 transition-colors ${
                  selected
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-bg-elevated hover:border-text-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="calendar-importance"
                    checked={selected}
                    onChange={() => onChange({ ...prefs, importance: opt.value })}
                    className="h-3.5 w-3.5 cursor-pointer accent-primary"
                  />
                  <span className="text-xs font-semibold text-text">
                    {isZh ? opt.labelZh : opt.labelEn}
                  </span>
                </div>
                <span className="pl-5 text-[10px] text-text-muted">{opt.hint}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 附加开关 */}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <ToggleRow
          label={isZh ? "包含银行休市信息" : "Include Bank Holidays"}
          hint={
            isZh
              ? "列出本周相关国家/地区的银行或交易所休市情况"
              : "List bank/exchange holidays in focus countries"
          }
          checked={prefs.includeBankHolidays}
          onChange={(v) => onChange({ ...prefs, includeBankHolidays: v })}
        />
        <ToggleRow
          label={isZh ? "数据公布后标注市场情绪" : "Mark Market Sentiment After Release"}
          hint={
            isZh
              ? "对已公布数据标注📈看多/📉看空/➖中性,并用通俗语言解释"
              : "Annotate 📈 Bullish / 📉 Bearish / ➖ Neutral for released data"
          }
          checked={prefs.includeSentiment}
          onChange={(v) => onChange({ ...prefs, includeSentiment: v })}
        />
      </div>

      <div className="rounded-md border border-dashed border-border bg-bg-elevated/40 px-3 py-2 text-[11px] text-text-muted">
        💡 {isZh
          ? "点击 AI 面板的「📅 本周经济日历」按钮即可让 AI 生成结构化周历。LLM 训练数据可能滞后,实际公布时间以 Investing.com / TradingEconomics / Forex Factory 为准。"
          : "Click the '📅 This Week's Calendar' button in the AI panel. LLM data may be stale; verify on Investing.com / TradingEconomics / Forex Factory."}
      </div>
    </div>
  );
}
