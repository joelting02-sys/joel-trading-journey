// 数字转字符串,保留完整的原始精度(去尾零,无科学计数法)
// 例: 1.14100 -> "1.141", 1.14123000 -> "1.14123", 1245.67 -> "1245.67", 0 -> "0"
export function numberToString(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  // 避免 1e-7 这种科学计数法
  const str = Math.abs(value).toString();
  if (str.includes("e")) {
    // 转成正常十进制
    return Math.abs(value).toFixed(20).replace(/\.?0+$/, "");
  }
  // 整数:直接返回
  if (!str.includes(".")) return str;
  // 去掉尾部的 0,保留所有有效小数位
  return str.replace(/0+$/, "").replace(/\.$/, "");
}

// 格式化货币(完整原始精度,只去掉尾零)
export function formatCurrency(value: number, _decimals?: number): string {
  const prefix = value >= 0 ? "$" : "-$";
  const numStr = numberToString(value);
  // 千分位处理(只对整数部分加)
  const [intPart, decPart] = numStr.split(".");
  const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined
    ? `${prefix}${intWithCommas}.${decPart}`
    : `${prefix}${intWithCommas}`;
}

// 格式化带正负号的货币(完整原始精度,只去掉尾零)
export function formatSignedCurrency(value: number, _decimals?: number): string {
  const prefix = value >= 0 ? "+$" : "-$";
  const numStr = numberToString(value);
  const [intPart, decPart] = numStr.split(".");
  const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined
    ? `${prefix}${intWithCommas}.${decPart}`
    : `${prefix}${intWithCommas}`;
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
