import { useSettings } from "@/store/useSettings";
import { useTradeStore } from "@/store/useTradeStore";

// Compute SHA-256 hash using native browser Web Crypto API
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface SyncResult {
  success: boolean;
  status?: "synced" | "updated_server" | "updated_client" | "in_sync";
  error?: string;
}

export async function triggerSync(): Promise<SyncResult> {
  const settingsState = useSettings.getState();
  const tradeStoreState = useTradeStore.getState();

  const passcode = settingsState.syncPasscode || "";
  const syncEnabled = settingsState.syncEnabled;
  const clientUpdatedAt = settingsState.clientUpdatedAt;

  if (!syncEnabled || !passcode.trim()) {
    return { success: false, error: "Sync is not enabled or passcode is empty." };
  }

  try {
    const passcodeHash = await sha256(passcode.trim());

    const body = {
      passcodeHash,
      clientUpdatedAt,
      trades: tradeStoreState.trades,
      accounts: tradeStoreState.accounts,
      settings: {
        language: settingsState.language,
        currency: settingsState.currency,
        aiConfigs: settingsState.aiConfigs,
        activeAiConfigId: settingsState.activeAiConfigId,
        calendarPrefs: settingsState.calendarPrefs,
        calendarContent: settingsState.calendarContent,
        calendarUpdatedAt: settingsState.calendarUpdatedAt,
        preMarketChecks: settingsState.preMarketChecks,
        positionCalcHistory: settingsState.positionCalcHistory,
      },
      sop: settingsState.sopRules,
    };

    const response = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Server returned error (${response.status}): ${errorText}` };
    }

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    // Handle results
    if (data.status === "synced" || data.status === "updated_server" || data.status === "in_sync") {
      settingsState.setLastSyncedAt(data.serverUpdatedAt || Date.now());
      return { success: true, status: data.status };
    }

    if (data.status === "updated_client") {
      // Server has newer data -> Overwrite local state
      if (data.trades) tradeStoreState.setTrades(data.trades);
      if (data.accounts) tradeStoreState.setAccounts(data.accounts);
      if (data.sop) settingsState.setSopRules(data.sop);

      const s = data.settings || {};
      if (s.language) settingsState.setLanguage(s.language);
      if (s.currency) settingsState.setCurrency(s.currency);
      
      // Update fields directly on settings state
      const settingsUpdate: Partial<any> = {};
      if (s.aiConfigs) settingsUpdate.aiConfigs = s.aiConfigs;
      if (s.activeAiConfigId !== undefined) settingsUpdate.activeAiConfigId = s.activeAiConfigId;
      if (s.calendarPrefs) settingsUpdate.calendarPrefs = s.calendarPrefs;
      if (s.calendarContent !== undefined) settingsUpdate.calendarContent = s.calendarContent;
      if (s.calendarUpdatedAt !== undefined) settingsUpdate.calendarUpdatedAt = s.calendarUpdatedAt;
      if (s.preMarketChecks) settingsUpdate.preMarketChecks = s.preMarketChecks;
      if (s.positionCalcHistory) settingsUpdate.positionCalcHistory = s.positionCalcHistory;
      
      // Sync timestamps
      const serverTS = data.serverUpdatedAt || Date.now();
      settingsUpdate.clientUpdatedAt = serverTS;
      settingsUpdate.lastSyncedAt = serverTS;
      
      useSettings.setState(settingsUpdate);

      return { success: true, status: "updated_client" };
    }

    return { success: false, error: `Unknown status: ${data.status}` };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

export function onDataMutation() {
  const settings = useSettings.getState();
  if (settings.syncEnabled && (settings.syncPasscode || "").trim()) {
    settings.updateClientTimestamp();
    // Trigger sync in background
    triggerSync().catch(() => {});
  }
}
