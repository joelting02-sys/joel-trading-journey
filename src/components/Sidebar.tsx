import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  ListChecks,
  PlusCircle,
  TrendingUp,
  Wallet,
  CalendarDays,
  ClipboardList,
  Calculator,
  BarChart3,
  Settings as SettingsIcon,
  X,
  Bot,
  type LucideIcon,
} from "lucide-react";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";

type NavIcon = LucideIcon;

function NavIconRender({ icon, isActive }: { icon: NavIcon; isActive: boolean }) {
  const LucideComp = icon as LucideIcon;
  return <LucideComp size={18} strokeWidth={1.8} />;
}

type NavGroup = {
  key: string;
  label: string;
  items: NavItem[];
};

type NavItem = {
  key: string;
  label: string;
  path: string;
  icon: NavIcon;
};

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useTradeStore();
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const location = useLocation();

  const navGroups: NavGroup[] = [
    {
      key: "trading",
      label: language === "zh" ? "交易" : "Trading",
      items: [
        { key: "dashboard", label: t.nav.dashboard, path: "/", icon: LayoutGrid },
        { key: "trades", label: t.nav.trades, path: "/trades", icon: ListChecks },
        { key: "new-trade", label: t.nav.newTrade, path: "/new-trade", icon: PlusCircle },
        { key: "analytics", label: t.nav.analytics, path: "/analytics", icon: TrendingUp },
        { key: "accounts", label: t.nav.accounts, path: "/accounts", icon: Wallet },
      ],
    },
    {
      key: "tools",
      label: language === "zh" ? "工具" : "Tools",
      items: [
        { key: "calendar", label: t.nav.calendar, path: "/calendar", icon: CalendarDays },
        { key: "chart-review", label: t.nav.chartReview, path: "/chart-review", icon: BarChart3 },
        { key: "position-calc", label: t.nav.positionCalc, path: "/position-calc", icon: Calculator },
      ],
    },
    {
      key: "rules",
      label: language === "zh" ? "规则" : "Rules",
      items: [
        { key: "sop", label: t.nav.sop, path: "/sop", icon: ClipboardList },
      ],
    },
    {
      key: "ai",
      label: language === "zh" ? "AI 助手" : "AI Assistant",
      items: [
        { key: "assistant", label: t.nav.assistant, path: "/assistant", icon: Bot },
      ],
    },
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
        <nav className="flex flex-1 flex-col gap-3 overflow-y-auto pb-2">
          {navGroups.map((group) => (
            <div key={group.key} className="flex flex-col gap-0.5">
              <div className="px-4 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {group.label}
              </div>
              {group.items.map((item) => {
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
                    <NavIconRender icon={item.icon} isActive={location.pathname === item.path} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
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
