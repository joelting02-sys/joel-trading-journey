import { useNavigate } from "react-router-dom";
import { Menu, Languages, User } from "lucide-react";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  const navigate = useNavigate();
  const toggleSidebar = useTradeStore((s) => s.toggleSidebar);
  const { language, setLanguage } = useSettings();
  const avatarUrl = useSettings((s) => s.avatarUrl);
  const supabaseUserEmail = useSettings((s) => s.supabaseUserEmail);

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "zh" : "en");
  };

  const initial = supabaseUserEmail ? supabaseUserEmail[0].toUpperCase() : "";

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
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleLanguage}
          title={language === "en" ? "切换到中文" : "Switch to English"}
          className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-text-secondary transition-all duration-150 hover:border-primary hover:bg-bg-hover hover:text-primary"
        >
          <Languages size={15} strokeWidth={1.8} />
          <span className="text-xs font-medium">{language === "en" ? "EN" : "中"}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate("/settings")}
          title={language === "zh" ? "设置" : "Settings"}
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-bg-elevated text-text-secondary transition-all duration-150 hover:border-primary hover:text-primary"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : initial ? (
            <span className="flex h-full w-full items-center justify-center bg-primary/15 text-xs font-bold text-primary">
              {initial}
            </span>
          ) : (
            <User size={15} />
          )}
        </button>
      </div>
    </header>
  );
}
