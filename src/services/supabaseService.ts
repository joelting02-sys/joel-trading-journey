import { createClient, SupabaseClient } from "@supabase/supabase-js";
    import { useSettings } from "@/store/useSettings";
    import { useTradeStore } from "@/store/useTradeStore";

    let cachedClient: SupabaseClient | null = null;
    let cachedUrl = "";
    let cachedKey = "";

    export function getSupabaseClient(): SupabaseClient | null {
      const { supabaseUrl, supabaseAnonKey } = useSettings.getState();
      if (!supabaseUrl || !supabaseAnonKey) {
        cachedClient = null;
        cachedUrl = "";
        cachedKey = "";
        return null;
      }
      if (cachedClient && cachedUrl === supabaseUrl && cachedKey === supabaseAnonKey) {
        return cachedClient;
      }
      cachedUrl = supabaseUrl;
      cachedKey = supabaseAnonKey;
      cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      });
      return cachedClient;
    }

    export function initializeSupabaseListener() {
      const client = getSupabaseClient();
      if (!client) return;

      client.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
          useSettings.setState({
            supabaseUserEmail: session.user.email || "",
            supabaseSessionToken: session.access_token || ""
          });
        } else {
          useSettings.setState({
            supabaseUserEmail: "",
            supabaseSessionToken: ""
          });
        }
      });
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
                positionCalcHistory: settingsState.positionCalcHistory
              },
              sop_data: settingsState.sopRules,
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
                positionCalcHistory: settingsState.positionCalcHistory
              },
              sop_data: settingsState.sopRules,
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
          settingsState.setSopRules(sop);

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

    export function onDataMutation() {
      const settings = useSettings.getState();
      if (settings.syncEnabled && settings.supabaseSessionToken) {
        settings.updateClientTimestamp();
        triggerSupabaseSync().catch(() => {});
      }
    }
