import { Link, useNavigate } from "react-router-dom";
import { Plus, Menu, Languages, LogOut } from "lucide-react";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  const toggleSidebar = useTradeStore((s) => s.toggleSidebar);
  const { language, setLanguage } = useSettings();
  const t = useSettings((s) => s.t());
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const showLogout = isSupabaseConfigured() && !!user;

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "zh" : "en");
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          className="text-text-secondary hover:text-text md:hidden"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <h1 className="m-0 font-display text-lg font-semibold leading-tight tracking-tight text-text">
          {title}
        </h1>
        {user && (
          <span className="hidden text-xs text-text-muted sm:inline">· {user.email}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* 语言切换 */}
        <button
          onClick={toggleLanguage}
          title={language === "en" ? "切换到中文" : "Switch to English"}
          className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-text-secondary transition-all duration-150 hover:border-primary hover:bg-bg-hover hover:text-primary"
        >
          <Languages size={15} strokeWidth={1.8} />
          <span className="text-xs font-medium">{language === "en" ? "EN" : "中"}</span>
        </button>
        {/* 新建交易 */}
        <Link
          to="/new-trade"
          title="New Trade"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-secondary transition-all duration-150 hover:border-primary hover:bg-bg-hover hover:text-primary"
        >
          <Plus size={16} strokeWidth={2} />
        </Link>
        {/* 退出登录(只在登录后显示) */}
        {showLogout && (
          <button
            onClick={handleLogout}
            title={t.auth.logout}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-secondary transition-all duration-150 hover:border-loss hover:bg-loss/5 hover:text-loss"
          >
            <LogOut size={15} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </header>
  );
}
