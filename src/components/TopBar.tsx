import { Link } from "react-router-dom";
import { Plus, Menu, Languages } from "lucide-react";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  const toggleSidebar = useTradeStore((s) => s.toggleSidebar);
  const { language, setLanguage } = useSettings();

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "zh" : "en");
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
        <Link
          to="/new-trade"
          title="New Trade"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-secondary transition-all duration-150 hover:border-primary hover:bg-bg-hover hover:text-primary"
        >
          <Plus size={16} strokeWidth={2} />
        </Link>
      </div>
    </header>
  );
}
