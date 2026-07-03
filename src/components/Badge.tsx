import type { ReactNode } from "react";

type BadgeVariant = "primary" | "loss" | "neutral" | "warning" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: "bg-primary/12 text-primary",
  loss: "bg-loss/12 text-loss",
  neutral: "bg-bg-hover text-text-secondary",
  warning: "bg-warning/12 text-warning",
  info: "bg-info/12 text-info",
};

export default function Badge({
  variant = "neutral",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-2 font-mono text-[11px] font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
