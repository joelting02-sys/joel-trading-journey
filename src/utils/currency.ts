import type { CurrencyCode } from "@/store/useSettings";

// 汇率表（以 USD 为基准，1 USD = X 目标货币）
export const exchangeRates: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 157.5,
  MYR: 4.7,
};

export const currencySymbols: Record<CurrencyCode, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  MYR: "RM",
};

// 将 USD 金额转换为目标货币
export function convertFromUsd(amountUsd: number, target: CurrencyCode): number {
  return amountUsd * exchangeRates[target];
}

// 格式化货币（带转换），USD 为基准
export function formatCurrencyConverted(
  amountUsd: number,
  currency: CurrencyCode,
  decimals?: number
): string {
  const converted = convertFromUsd(amountUsd, currency);
  const symbol = currencySymbols[currency];
  const isNegative = converted < 0;
  const absValue = Math.abs(converted);

  // JPY 和 MYR 通常不显示小数
  const defaultDecimals = currency === "JPY" ? 0 : currency === "MYR" ? 2 : 2;
  const d = decimals ?? defaultDecimals;

  const formatted = absValue.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

  if (isNegative) {
    return `-${symbol}${formatted}`;
  }
  return `${symbol}${formatted}`;
}

// 格式化带正负号的货币（带转换）
export function formatSignedCurrencyConverted(
  amountUsd: number,
  currency: CurrencyCode,
  decimals?: number
): string {
  const converted = convertFromUsd(amountUsd, currency);
  const symbol = currencySymbols[currency];
  const prefix = converted >= 0 ? "+" : "-";
  const absValue = Math.abs(converted);

  const defaultDecimals = currency === "JPY" ? 0 : 2;
  const d = decimals ?? defaultDecimals;

  const formatted = absValue.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

  return `${prefix}${symbol}${formatted}`;
}
