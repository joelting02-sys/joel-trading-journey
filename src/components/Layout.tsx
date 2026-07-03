import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface LayoutProps {
  title: string;
  children: ReactNode;
}

export default function Layout({ title, children }: LayoutProps) {
  const location = useLocation();
  // AI 助手页需要撑满整个高度(没有 padding,自己控制)
  const isAssistant = location.pathname === "/assistant";
  return (
    <div className="flex min-h-screen bg-bg font-body">
      <Sidebar />

      <div className="flex min-h-screen flex-1 md:ml-[220px]">
        <div className="flex min-h-screen flex-1 flex-col bg-bg">
          <TopBar title={title} />
          <div className={`tj-scroll flex-1 overflow-y-auto ${isAssistant ? "p-0" : "p-4 md:p-6"}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
