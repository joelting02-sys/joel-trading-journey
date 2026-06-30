import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string;
  valueColor?: string;
  badge?: ReactNode;
  delay?: number;
}

export default function KpiCard({
  label,
  value,
  valueColor,
  badge,
  delay = 0,
}: KpiCardProps) {
  return (
    <div
      className="animate-fade-in-up rounded-md border border-border bg-bg-surface px-5 py-4"
      style={{ animationDelay: `${delay}ms`, opacity: 0 }}
    >
      <div className="mb-2 font-body text-xs font-medium text-text-secondary">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={`tj-number whitespace-nowrap text-2xl font-semibold ${valueColor ?? "text-text"}`}
        >
          {value}
        </span>
      </div>
      {badge && <div className="mt-1.5">{badge}</div>}
    </div>
  );
}
