import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Dashboard from "@/pages/Dashboard";
import Trades from "@/pages/Trades";
import NewTrade from "@/pages/NewTrade";
import Analytics from "@/pages/Analytics";
import Accounts from "@/pages/Accounts";
import Settings from "@/pages/Settings";
import Assistant from "@/pages/Assistant";
import Sop from "@/pages/Sop";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import { useEffect, useState, type ReactNode } from "react";
import { fetchAccounts, fetchTrades, fetchSopRules, fetchUserSettings } from "@/services/dataService";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg text-text-muted">
      <div className="text-sm">Loading...</div>
    </div>
  );
}

// 未登录用户重定向到 /login(只在 Supabase 已配置时)
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const configured = isSupabaseConfigured();

  if (!configured) return <>{children}</>;
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// 已登录用户自动从 /login 跳到主页
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const configured = isSupabaseConfigured();
  if (!configured) return <>{children}</>;
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// 把 Supabase 数据 hydrate 到本地 store
function useHydrateOnLogin() {
  const { user } = useAuth();
  const setTrades = useTradeStore((s) => s.setTrades);
  const setAccounts = useTradeStore((s) => s.setAccounts);
  const setActiveAccountId = useTradeStore((s) => s.setActiveAccountId);
  const trades = useTradeStore((s) => s.trades);
  const accounts = useTradeStore((s) => s.accounts);
  const [hydrated, setHydrated] = useState(false);

  const setLanguage = useSettings((s) => s.setLanguage);
  const setCurrency = useSettings((s) => s.setCurrency);
  const setAiConfig = useSettings((s) => s.setAiConfig);
  const setSopRules = useSettings((s) => s.setSopRules);
  const setChatMessages = useSettings((s) => s.setChatMessages);

  useEffect(() => {
    if (!user) {
      setHydrated(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [fetchedAccounts, fetchedTrades, fetchedSop, fetchedSettings] = await Promise.all([
          fetchAccounts(user.id),
          fetchTrades(user.id),
          fetchSopRules(user.id),
          fetchUserSettings(user.id),
        ]);
        if (cancelled) return;
        setAccounts(fetchedAccounts);
        setTrades(fetchedTrades);
        if (fetchedAccounts[0]) setActiveAccountId(fetchedAccounts[0].id);
        setSopRules(fetchedSop);
        if (fetchedSettings) {
          setLanguage(fetchedSettings.language);
          setCurrency(fetchedSettings.currency as "USD" | "EUR" | "GBP" | "JPY" | "MYR");
          setAiConfig(fetchedSettings.aiConfig);
          setChatMessages(fetchedSettings.chatMessages);
        }
        setHydrated(true);
      } catch (err) {
        console.error("[hydrate] failed:", err);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { hydrated, trades, accounts };
}

function HydrationGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const configured = isSupabaseConfigured();
  const { hydrated, trades, accounts } = useHydrateOnLogin();
  // 登录后挂上自动同步
  useSupabaseSync();

  if (!configured) return <>{children}</>;
  if (loading) return <LoadingScreen />;
  if (user && !hydrated) return <LoadingScreen />;
  void trades; void accounts;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
          <Route path="/signup" element={<RedirectIfAuthed><Signup /></RedirectIfAuthed>} />
          <Route path="/" element={<RequireAuth><HydrationGate><Dashboard /></HydrationGate></RequireAuth>} />
          <Route path="/trades" element={<RequireAuth><HydrationGate><Trades /></HydrationGate></RequireAuth>} />
          <Route path="/new-trade" element={<RequireAuth><HydrationGate><NewTrade /></HydrationGate></RequireAuth>} />
          <Route path="/analytics" element={<RequireAuth><HydrationGate><Analytics /></HydrationGate></RequireAuth>} />
          <Route path="/accounts" element={<RequireAuth><HydrationGate><Accounts /></HydrationGate></RequireAuth>} />
          <Route path="/assistant" element={<RequireAuth><HydrationGate><Assistant /></HydrationGate></RequireAuth>} />
          <Route path="/sop" element={<RequireAuth><HydrationGate><Sop /></HydrationGate></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><HydrationGate><Settings /></HydrationGate></RequireAuth>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
