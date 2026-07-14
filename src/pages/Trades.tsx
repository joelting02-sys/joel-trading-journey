import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpDown, Plus, Search, Trash2, FileText, Image as ImageIcon } from "lucide-react";
import Layout from "@/components/Layout";
import Badge from "@/components/Badge";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";
import {
  calcHoldDays,
  formatCurrency,
  formatDate,
  formatPercent,
} from "@/utils/format";
import { formatSignedCurrencyConverted } from "@/utils/currency";
import type { Trade } from "@/types";

type SortKey = "symbol" | "pnl" | "openDate";
type SortDir = "asc" | "desc";

export default function Trades() {
  const allTrades = useTradeStore((s) => s.trades);
  const deleteTrade = useTradeStore((s) => s.deleteTrade);
  const accounts = useTradeStore((s) => s.accounts);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const currency = useSettings((s) => s.currency);
  const navigate = useNavigate();

  const [accountFilter, setAccountFilter] = useState<string>(activeAccountId || "all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("openDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // 按账户筛选交易（所有交易都是已平仓）
  const trades = useMemo(() => {
    if (accountFilter === "all") return allTrades;
    return allTrades.filter((tr) => tr.account === accountFilter);
  }, [allTrades, accountFilter]);

  // 当前筛选集合的汇总：毛利(盈亏)、手续费、净盈亏 — 跟随账户筛选 + 搜索 + 排序实时更新
  const summary = useMemo(() => {
    let pnlTotal = 0;
    let feeTotal = 0;
    for (const tr of trades) {
      pnlTotal += tr.pnl;
      feeTotal += tr.fee ?? 0;
    }
    return { pnlTotal, feeTotal, netTotal: pnlTotal - Math.abs(feeTotal), count: trades.length };
  }, [trades]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = trades.filter((tr) => {
      const matchesQuery = !q || tr.symbol.toLowerCase().includes(q);
      return matchesQuery;
    });

    return list.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === "symbol") {
        av = a.symbol.toLowerCase();
        bv = b.symbol.toLowerCase();
      } else if (sortKey === "pnl") {
        av = a.pnl;
        bv = b.pnl;
      } else {
        av = new Date(a.openDate).getTime();
        bv = new Date(b.openDate).getTime();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [trades, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  return (
    <Layout title={t.title.trades}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* 账户选择器 */}
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="rounded-md border border-border bg-bg-surface py-2 px-3 text-sm text-text outline-none focus:border-primary"
            >
              <option value="all">{t.tradesPage.all} ({allTrades.length})</option>
              {accounts.map((a) => {
                const count = allTrades.filter((tr) => tr.account === a.id).length;
                return (
                  <option key={a.id} value={a.id}>
                    {a.name} ({count})
                  </option>
                );
              })}
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.tradesPage.searchPlaceholder}
                className="w-full rounded-md border border-border bg-bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none sm:w-64"
              />
            </div>
          </div>

          {/* New trade */}
          <Link
            to="/new-trade"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t.tradesPage.newTrade}
          </Link>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border border-border bg-bg-surface">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            {/* 汇总行：紧贴表头之下，跟随账户筛选 + 搜索实时聚合 净盈亏 / 盈亏 / 手续费 */}
            {filtered.length > 0 && (
              <tfoot>
                <tr
                  className="border-b border-border bg-primary/5 text-text"
                  data-testid="trades-summary"
                >
                  <td className="px-3 py-2 font-mono font-medium" colSpan={5}>
                    {language === "zh" ? "合计" : "Total"}{" "}
                    <span className="text-text-muted">({summary.count})</span>
                  </td>
                  <td className={`px-3 py-2 text-right tj-number font-medium ${summary.pnlTotal >= 0 ? "text-primary" : "text-loss"}`}>
                    {formatSignedCurrencyConverted(summary.pnlTotal, currency)}
                  </td>
                  <td className="px-3 py-2 text-right tj-number text-loss">
                    {summary.feeTotal !== 0 ? formatSignedCurrencyConverted(-Math.abs(summary.feeTotal), currency) : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right tj-number font-semibold ${summary.netTotal >= 0 ? "text-primary" : "text-loss"}`}>
                    {formatSignedCurrencyConverted(summary.netTotal, currency)}
                  </td>
                  <td colSpan={6} />
                </tr>
              </tfoot>
            )}
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-left text-text-secondary">
                <SortHeader
                  label={t.tradesPage.symbol}
                  sortKey="symbol"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <th className="px-3 py-2.5 font-medium">{t.tradesPage.direction}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t.tradesPage.entry}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t.tradesPage.exit}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t.tradesPage.qty}</th>
                <SortHeader
                  label={t.tradesPage.pnl}
                  sortKey="pnl"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  align="right"
                />
                <th className="px-3 py-2.5 text-right font-medium">{t.tradesPage.fee}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t.tradesPage.net}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t.tradesPage.pnlPercent}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t.tradesPage.holdDays}</th>
                <th className="px-3 py-2.5 font-medium">{t.tradesPage.status}</th>
                <SortHeader
                  label={t.tradesPage.openDate}
                  sortKey="openDate"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <th className="px-3 py-2.5 text-right font-medium">{t.tradesPage.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trade) => (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  onDelete={deleteTrade}
                  onClick={() => navigate(`/trades/${trade.id}`)}
                  accountName={accounts.find((a) => a.id === trade.account)?.name ?? ""}
                />
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 py-12 text-text-muted">
              <p className="text-sm">{t.tradesPage.noTrades}</p>
              <p className="text-xs">{t.tradesPage.noTradesHint}</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
  align = "left",
}: SortHeaderProps) {
  const active = current === sortKey;
  return (
    <th
      className={`px-3 py-2.5 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-text ${
          align === "right" ? "flex-row-reverse" : ""
        } ${active ? "text-text" : ""}`}
      >
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`}
        />
        {active && (
          <span className="text-[10px] uppercase">
            {dir === "asc" ? "asc" : "desc"}
          </span>
        )}
      </button>
    </th>
  );
}

interface TradeRowProps {
  trade: Trade;
  onDelete: (id: string) => void;
  onClick: () => void;
  accountName: string;
}

function TradeRow({ trade, onDelete, onClick, accountName }: TradeRowProps) {
  const t = useSettings((s) => s.t());
  const currency = useSettings((s) => s.currency);
  const isWin = trade.pnl >= 0;
  const pnlColor = isWin ? "text-primary" : "text-loss";
  // 净 P&L = 毛利 + 手续费(手续费是负数)
  const fee = trade.fee ?? 0;
  const netPnl = trade.pnl + fee;
  const netColor = netPnl >= 0 ? "text-primary" : "text-loss";
  const feeColor = fee < 0 ? "text-loss" : "text-text-muted";
  const hasNotes = !!(trade.sopNotes || trade.mindsetNotes || trade.notes);
  const hasImages = !!(trade.images && trade.images.length > 0);

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-border-subtle transition-colors last:border-0 hover:bg-bg-hover"
    >
      <td className="px-3 py-2.5 font-mono font-medium text-text">
        <div className="flex items-center gap-1.5">
          {trade.symbol}
          {hasNotes && (
            <FileText className="h-3 w-3 text-text-muted" strokeWidth={1.5} />
          )}
          {hasImages && (
            <ImageIcon className="h-3 w-3 text-primary/70" strokeWidth={1.5} />
          )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <Badge variant={trade.direction === "long" ? "primary" : "loss"}>
          {trade.direction === "long" ? t.dashboard.long : t.dashboard.short}
        </Badge>
      </td>
      <td className="px-3 py-2.5 text-right tj-number text-text-secondary">
        {formatCurrency(trade.entryPrice)}
      </td>
      <td className="px-3 py-2.5 text-right tj-number text-text-secondary">
        {formatCurrency(trade.exitPrice)}
      </td>
      <td className="px-3 py-2.5 text-right tj-number text-text-secondary">
        {trade.quantity}
      </td>
      <td className={`px-3 py-2.5 text-right tj-number font-medium ${pnlColor}`}>
        {formatSignedCurrencyConverted(trade.pnl, currency)}
      </td>
      <td className={`px-3 py-2.5 text-right tj-number ${feeColor}`}>
        {fee !== 0 ? formatSignedCurrencyConverted(fee, currency) : "—"}
      </td>
      <td className={`px-3 py-2.5 text-right tj-number font-medium ${netColor}`}>
        {formatSignedCurrencyConverted(netPnl, currency)}
      </td>
      <td className={`px-3 py-2.5 text-right tj-number ${pnlColor}`}>
        {formatPercent(trade.pnlPercent)}
      </td>
      <td className="px-3 py-2.5 text-right tj-number text-text-secondary">
        {trade.closeDate ? calcHoldDays(trade.openDate, trade.closeDate) : 0}
      </td>
      <td className="px-3 py-2.5">
        <Badge variant="neutral">{t.tradesPage.closed}</Badge>
      </td>
      <td className="px-3 py-2.5 text-text-secondary">
        {formatDate(trade.openDate)}
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(trade.id);
          }}
          aria-label="Delete trade"
          className="inline-flex items-center justify-center rounded-sm p-1.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-loss"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
