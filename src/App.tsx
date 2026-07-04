import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Trades from "@/pages/Trades";
import NewTrade from "@/pages/NewTrade";
import Analytics from "@/pages/Analytics";
import Accounts from "@/pages/Accounts";
import Settings from "@/pages/Settings";
import Assistant from "@/pages/Assistant";
import Sop from "@/pages/Sop";
import EconomicCalendar from "@/pages/EconomicCalendar";
// PreMarket removed — SOP already covers pre-session checklist
import PositionCalculator from "@/pages/PositionCalculator";
import TradeDetail from "@/pages/TradeDetail";
import ChartReview from "@/pages/ChartReview";
import { tryRestoreDirectory } from "@/services/dataStorage";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";
import { initializeSupabaseListener } from "@/services/supabaseService";
import { useDialogStore } from "@/store/useDialogStore";
import DialogHost from "@/components/DialogHost";

export default function App() {
  // 捕捉全局 JS 崩溃错误并进行友好弹窗提示
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // 用内置弹窗替换原生 alert
      useDialogStore.getState().alert({
        title: "检测到页面错误",
        message: `${event.message}\n发生在：${event.filename}:${event.lineno}`,
        variant: "warning",
      });
    };
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  // 启动时尝试恢复已保存的目录句柄,然后从磁盘 hydrate
  useEffect(() => {
    (async () => {
      const ok = await tryRestoreDirectory();
      if (ok) {
        await useTradeStore.getState().hydrateFromDisk();
        await useSettings.getState().hydrateFromDisk();
      }
      try {
        await initializeSupabaseListener();
      } catch {
        // Supabase 初始化失败不影响本地使用
      }
    })();
  }, []);

  const sessionToken = useSettings((s) => s.supabaseSessionToken);

  if (!sessionToken) {
    return <Login />;
  }

  return (
    <>
      <DialogHost />
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/trades/:id" element={<TradeDetail />} />
          <Route path="/new-trade" element={<NewTrade />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/calendar" element={<EconomicCalendar />} />
          <Route path="/position-calc" element={<PositionCalculator />} />
           <Route path="/sop" element={<Sop />} />
          <Route path="/chart-review" element={<ChartReview />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Router>
    </>
  );
}
