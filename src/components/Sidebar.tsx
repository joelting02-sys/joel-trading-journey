import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  ListChecks,
  PlusCircle,
  TrendingUp,
  Wallet,
  Bot,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  Calculator,
  History,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useTradeStore();
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);

  const navItems = [
    { key: "dashboard", label: t.nav.dashboard, path: "/", icon: LayoutGrid },
    { key: "trades", label: t.nav.trades, path: "/trades", icon: ListChecks },
    { key: "new-trade", label: t.nav.newTrade, path: "/new-trade", icon: PlusCircle },
    { key: "analytics", label: t.nav.analytics, path: "/analytics", icon: TrendingUp },
    { key: "accounts", label: t.nav.accounts, path: "/accounts", icon: Wallet },
    { key: "assistant", label: t.nav.assistant, path: "/assistant", icon: Bot },
    { key: "calendar", label: t.nav.calendar, path: "/calendar", icon: CalendarDays },
    { key: "backtest", label: t.nav.backtest, path: "/backtest", icon: History },
    { key: "position-calc", label: t.nav.positionCalc, path: "/position-calc", icon: Calculator },
    { key: "sop", label: t.nav.sop, path: "/sop", icon: ClipboardList },
  ];

  return (
    <>
      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 flex w-[220px] flex-col border-r border-border bg-bg-elevated transition-transform duration-200 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-2.5 px-4 pb-6 pt-5">
          <div className="flex items-center gap-2.5">
            <img
              src="/joel-logo.svg"
              alt="JOEL 2026"
              className="h-10 w-10 rounded-sm object-cover"
            />
            <span className="font-display text-[11px] font-normal tracking-wide text-text-secondary">
              {language === "zh" ? "交易日志" : "Trading Journal"}
            </span>
          </div>
          <button
            className="text-text-secondary hover:text-text md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-0.5 pb-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === "/"}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `nav-item flex items-center gap-3 border-l-2 px-4 py-2.5 font-body text-[13px] transition-all duration-150 ${
                    isActive
                      ? "border-primary bg-primary-ghost text-primary"
                      : "border-transparent text-text-secondary hover:bg-bg-hover hover:text-text"
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom: Settings */}
        <div className="border-t border-border-subtle px-0 py-2 pb-4">
          <NavLink
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `nav-item flex items-center gap-3 border-l-2 px-4 py-2.5 font-body text-[13px] transition-all duration-150 ${
                isActive
                  ? "border-primary bg-primary-ghost text-primary"
                  : "border-transparent text-text-muted hover:bg-bg-hover hover:text-text"
              }`
            }
          >
            <SettingsIcon size={18} strokeWidth={1.8} />
            <span>{t.nav.settings}</span>
          </NavLink>
        </div>
      </aside>
    </>
  );
}
