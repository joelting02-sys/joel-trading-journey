import { createClient, SupabaseClient } from "@supabase/supabase-js";
    import { useSettings } from "@/store/useSettings";
    import { useTradeStore } from "@/store/useTradeStore";

    let cachedClient: SupabaseClient | null = null;
    let cachedUrl = "";
    let cachedKey = "";

    const DEFAULT_URL = "https://imemwbgtxnkfodncfgal.supabase.co";
    const DEFAULT_KEY = "sb_publishable_CWNd8zRNESxUvpNZ7BA16Q_UA1DjMuO";

    export function getSupabaseClient(): SupabaseClient | null {
      const state = useSettings.getState();
      const supabaseUrl = state.supabaseUrl || DEFAULT_URL;
      const supabaseAnonKey = state.supabaseAnonKey || DEFAULT_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        cachedClient = null;
        cachedUrl = "";
        cachedKey = "";
        return null;
      }
      if (cachedClient && cachedUrl === supabaseUrl && cachedKey === supabaseAnonKey) {
        return cachedClient;
      }
      try {
        cachedUrl = supabaseUrl;
        cachedKey = supabaseAnonKey;
        
        // 使用同源代理以绕过 GFW 和浏览器对 supabase.co 域名的直接拦截/CORS 限制
        const finalUrl = typeof window !== "undefined"
          ? `${window.location.origin}/api/supabase`
          : supabaseUrl;

        cachedClient = createClient(finalUrl, supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
          }
        });
        return cachedClient;
      } catch (err) {
        console.error("Failed to create Supabase client:", err);
        cachedClient = null;
        cachedUrl = "";
        cachedKey = "";
        return null;
      }
    }

    export async function initializeSupabaseListener() {
      const client = getSupabaseClient();
      if (!client) return;

      try {
        const { data: { session } } = await client.auth.getSession();
        if (session && session.user) {
          useSettings.setState({
            supabaseUserEmail: session.user.email || "",
            supabaseSessionToken: session.access_token || "",
            syncEnabled: true
          });
          registerDevice(client).catch(() => {});
          triggerSupabaseSync().catch(() => {});
        }
      } catch {
        // session 恢复失败静默处理
      }

      client.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
          useSettings.setState({
            supabaseUserEmail: session.user.email || "",
            supabaseSessionToken: session.access_token || "",
            syncEnabled: true
          });
          registerDevice(client).catch(() => {});
          triggerSupabaseSync().catch(() => {});
        } else {
          useSettings.setState({
            supabaseUserEmail: "",
            supabaseSessionToken: "",
            syncEnabled: false
          });
        }
      });

      // 1) 标签页可见性切换时立即触发一次同步（例如唤醒电脑或切回标签页）
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            const settings = useSettings.getState();
            if (settings.syncEnabled && settings.supabaseSessionToken) {
              triggerSupabaseSync().catch(() => {});
            }
          }
        });
      }

      // 2) 定期轮詢（每 30 秒），在網頁處於可見狀態時，自動拉取其他裝置上傳的最新數據
      setInterval(() => {
        const settings = useSettings.getState();
        if (
          settings.syncEnabled &&
          settings.supabaseSessionToken &&
          typeof document !== "undefined" &&
          document.visibilityState === "visible"
        ) {
          triggerSupabaseSync().catch(() => {});
          updateDeviceSeen(client).catch(() => {});
        }
      }, 30000);
    }

    export async function triggerSupabaseSync(): Promise<{ success: boolean; status?: string; error?: string }> {
      const client = getSupabaseClient();
      if (!client) {
        return { success: false, error: "Supabase URL and Key are not configured." };
      }

      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) {
        return { success: false, error: "User is not logged in or session expired." };
      }

      const settingsState = useSettings.getState();
      const tradeStoreState = useTradeStore.getState();
      const clientUpdatedAt = settingsState.clientUpdatedAt;

      try {
        const { data: record, error: fetchError } = await client
          .from("user_sync")
          .select("*")
          .maybeSingle();

        if (fetchError && fetchError.code !== "PGRST116") {
          throw fetchError;
        }

        // 1) First sync / No record found on server -> Write client data
        if (!record) {
          const { error: insertError } = await client
            .from("user_sync")
            .upsert({
              id: user.id,
              trades_data: tradeStoreState.trades,
              accounts_data: tradeStoreState.accounts,
              settings_data: {
                language: settingsState.language,
                currency: settingsState.currency,
                aiConfigs: settingsState.aiConfigs,
                activeAiConfigId: settingsState.activeAiConfigId,
                calendarPrefs: settingsState.calendarPrefs,
                calendarContent: settingsState.calendarContent,
                calendarUpdatedAt: settingsState.calendarUpdatedAt,
                preMarketChecks: settingsState.preMarketChecks,
                positionCalcHistory: settingsState.positionCalcHistory,
                drawdownEvents: settingsState.drawdownEvents,
                activeAccountId: tradeStoreState.activeAccountId
              },
              sop_data: settingsState.sopSets,
              updated_at: clientUpdatedAt || Date.now()
            });

          if (insertError) throw insertError;

          const serverTS = clientUpdatedAt || Date.now();
          useSettings.setState({ lastSyncedAt: serverTS, clientUpdatedAt: serverTS });
          return { success: true, status: "synced" };
        }

        const serverUpdatedAt = Number(record.updated_at) || 0;

        // 2) Client has newer data -> Write to server
        if (clientUpdatedAt > serverUpdatedAt) {
          const { error: updateError } = await client
            .from("user_sync")
            .upsert({
              id: user.id,
              trades_data: tradeStoreState.trades,
              accounts_data: tradeStoreState.accounts,
              settings_data: {
                language: settingsState.language,
                currency: settingsState.currency,
                aiConfigs: settingsState.aiConfigs,
                activeAiConfigId: settingsState.activeAiConfigId,
                calendarPrefs: settingsState.calendarPrefs,
                calendarContent: settingsState.calendarContent,
                calendarUpdatedAt: settingsState.calendarUpdatedAt,
                preMarketChecks: settingsState.preMarketChecks,
                positionCalcHistory: settingsState.positionCalcHistory,
                drawdownEvents: settingsState.drawdownEvents,
                activeAccountId: tradeStoreState.activeAccountId
              },
              sop_data: settingsState.sopSets,
              updated_at: clientUpdatedAt
            });

          if (updateError) throw updateError;

          useSettings.setState({ lastSyncedAt: clientUpdatedAt });
          return { success: true, status: "updated_server" };
        }

        // 3) Server has newer data -> Overwrite local client state
        if (serverUpdatedAt > clientUpdatedAt) {
          const trades = record.trades_data || [];
          const accounts = record.accounts_data || [];
          const sop = record.sop_data || [];
          const s = record.settings_data || {};

          tradeStoreState.setTrades(trades);
          tradeStoreState.setAccounts(accounts);
          if (s.activeAccountId) tradeStoreState.setActiveAccountId(s.activeAccountId);
          if (Array.isArray(sop) && sop.length > 0) {
            const first = sop[0];
            if (first && typeof first === "object" && "rules" in first && Array.isArray(first.rules)) {
              settingsState.setSopSets(sop);
            } else {
              settingsState.setSopSets([{ id: "sop-default", name: "Default SOP", rules: sop, createdAt: Date.now(), updatedAt: Date.now() }]);
            }
          }

          const settingsUpdate: Partial<any> = {};
          if (s.language) settingsUpdate.language = s.language;
          if (s.currency) settingsUpdate.currency = s.currency;
          if (s.aiConfigs) settingsUpdate.aiConfigs = s.aiConfigs;
          if (s.activeAiConfigId !== undefined) settingsUpdate.activeAiConfigId = s.activeAiConfigId;
          if (s.calendarPrefs) settingsUpdate.calendarPrefs = s.calendarPrefs;
          if (s.calendarContent !== undefined) settingsUpdate.calendarContent = s.calendarContent;
          if (s.calendarUpdatedAt !== undefined) settingsUpdate.calendarUpdatedAt = s.calendarUpdatedAt;
          if (s.preMarketChecks) settingsUpdate.preMarketChecks = s.preMarketChecks;
          if (s.positionCalcHistory) settingsUpdate.positionCalcHistory = s.positionCalcHistory;
          if (s.drawdownEvents) settingsUpdate.drawdownEvents = s.drawdownEvents;

          settingsUpdate.clientUpdatedAt = serverUpdatedAt;
          settingsUpdate.lastSyncedAt = serverUpdatedAt;

          useSettings.setState(settingsUpdate);
          return { success: true, status: "updated_client" };
        }

        // 4) Already in sync
        useSettings.setState({ lastSyncedAt: serverUpdatedAt });
        return { success: true, status: "in_sync" };

      } catch (err: any) {
        return { success: false, error: err.message || String(err) };
      }
    }

    let syncTimeoutId: any = null;

    export function onDataMutation() {
      const settings = useSettings.getState();
      if (settings.syncEnabled && settings.supabaseSessionToken) {
        settings.updateClientTimestamp();
        
        if (syncTimeoutId) {
          clearTimeout(syncTimeoutId);
        }
        syncTimeoutId = setTimeout(() => {
          triggerSupabaseSync().catch(() => {});
          syncTimeoutId = null;
        }, 1500);
      }
    }

    // ─── Device Tracking ───────────────────────────────────────────

    const DEVICE_ID_KEY = "tj-device-id";
    const DEVICE_SEEN_INTERVAL = 60_000;

    export interface DeviceInfo {
      id: string;
      device_name: string;
      browser: string;
      os: string;
      last_seen: string;
      created_at: string;
      isCurrent?: boolean;
    }

    function getDeviceId(): string {
      let id = localStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(DEVICE_ID_KEY, id);
      }
      return id;
    }

    function parseUserAgent(): { browser: string; os: string; deviceName: string } {
      const ua = navigator.userAgent || "";
      let browser = "Unknown";
      if (ua.includes("Firefox/")) browser = "Firefox";
      else if (ua.includes("Edg/")) browser = "Edge";
      else if (ua.includes("Chrome/") && !ua.includes("Chromium")) browser = "Chrome";
      else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
      else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";

      let os = "Unknown";
      if (ua.includes("Windows NT 10")) os = "Windows 10/11";
      else if (ua.includes("Windows")) os = "Windows";
      else if (ua.includes("Mac OS X")) os = "macOS";
      else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
      else if (ua.includes("Android")) os = "Android";
      else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

      const isMobile = /Android|iPhone|iPad|iPod/.test(ua);
      const deviceName = isMobile ? `${os} Mobile` : `${os} Desktop`;

      return { browser, os, deviceName };
    }

    let lastDeviceSeenAt = 0;

    export async function registerDevice(client: SupabaseClient): Promise<void> {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      const deviceId = getDeviceId();
      const { browser, os, deviceName } = parseUserAgent();
      const now = new Date().toISOString();

      try {
        await client.from("user_devices").upsert({
          user_id: user.id,
          device_id: deviceId,
          device_name: deviceName,
          browser,
          os,
          last_seen: now,
        }, { onConflict: "user_id,device_id" });
        lastDeviceSeenAt = Date.now();
      } catch {
        // silent
      }
    }

    export async function updateDeviceSeen(client: SupabaseClient): Promise<void> {
      if (Date.now() - lastDeviceSeenAt < DEVICE_SEEN_INTERVAL) return;
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      const deviceId = getDeviceId();
      try {
        await client.from("user_devices").update({ last_seen: new Date().toISOString() })
          .match({ user_id: user.id, device_id: deviceId });
        lastDeviceSeenAt = Date.now();
      } catch {
        // silent
      }
    }

    export async function removeCurrentDevice(client: SupabaseClient): Promise<void> {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      const deviceId = getDeviceId();
      try {
        await client.from("user_devices").delete()
          .match({ user_id: user.id, device_id: deviceId });
      } catch {
        // silent
      }
    }

    export async function fetchDevices(client: SupabaseClient): Promise<DeviceInfo[]> {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return [];

      try {
        const { data, error } = await client.from("user_devices")
          .select("id, device_id, device_name, browser, os, last_seen, created_at")
          .eq("user_id", user.id)
          .order("last_seen", { ascending: false });

        if (error || !data) return [];
        const currentDeviceId = getDeviceId();
        return data.map((d: any) => ({
          id: d.device_id,
          device_name: d.device_name,
          browser: d.browser,
          os: d.os,
          last_seen: d.last_seen,
          created_at: d.created_at,
          isCurrent: d.device_id === currentDeviceId,
        }));
      } catch {
        return [];
      }
    }
