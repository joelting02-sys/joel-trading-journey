// 格式化货币
export function formatCurrency(value: number, decimals = 2): string {
  const prefix = value >= 0 ? "$" : "-$";
  return `${prefix}${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// 格式化带正负号的货币
export function formatSignedCurrency(value: number, decimals = 2): string {
  const prefix = value >= 0 ? "+$" : "-$";
  return `${prefix}${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// 格式化百分比
export function formatPercent(value: number, decimals = 1): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(decimals)}%`;
}

// 格式化数字（带千分位）
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// 格式化日期 (Jun 29)
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// 格式化完整日期
export function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// 计算持仓天数
export function calcHoldDays(openDate: string, closeDate: string): number {
  const open = new Date(openDate);
  const close = new Date(closeDate);
  const diff = close.getTime() - open.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24) * 10) / 10;
}
