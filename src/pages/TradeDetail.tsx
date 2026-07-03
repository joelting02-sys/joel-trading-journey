import { useState, useEffect, useRef, type ChangeEvent, type ClipboardEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ImagePlus, X, Expand, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import Badge from "@/components/Badge";
import { useTradeStore } from "@/store/useTradeStore";
import { useSettings } from "@/store/useSettings";
import { compressImageToDataUrl } from "@/services/aiService";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  calcHoldDays,
} from "@/utils/format";
import {
  formatCurrencyConverted,
  formatSignedCurrencyConverted,
} from "@/utils/currency";

export default function TradeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const trades = useTradeStore((s) => s.trades);
  const accounts = useTradeStore((s) => s.accounts);
  const updateTrade = useTradeStore((s) => s.updateTrade);
  const t = useSettings((s) => s.t());
  const currency = useSettings((s) => s.currency);

  const trade = trades.find((tr) => tr.id === id);
  const accountName = trade
    ? accounts.find((a) => a.id === trade.account)?.name ?? ""
    : "";

  const [sopNotes, setSopNotes] = useState("");
  const [mindsetNotes, setMindsetNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);
  // 自动保存状态:idle(无变化)/ saving(保存中)/ saved(已保存)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const language = useSettings((s) => s.language);

  // 自动保存相关
  const skipNextSave = useRef(true); // 跳过 trade 切换后的首次同步
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (trade) {
      setSopNotes(trade.sopNotes ?? "");
      setMindsetNotes(trade.mindsetNotes ?? "");
      setNotes(trade.notes ?? "");
      setImages(trade.images ?? []);
      // 标记跳过此次同步触发的自动保存
      skipNextSave.current = true;
      setSaveState("idle");
    }
  }, [trade?.id]);

  // 自动保存:监听 4 个字段变化,debounce 800ms 后保存
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (!trade) return;

    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateTrade({
        ...trade,
        sopNotes: sopNotes.trim() || undefined,
        mindsetNotes: mindsetNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        images: images.length > 0 ? images : undefined,
      });
      setSaveState("saved");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveState("idle"), 1500);
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sopNotes, mindsetNotes, notes, images]);

  // 卸载时清理定时器
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  if (!trade) {
    return (
      <Layout title={t.title.trades}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="mb-2 text-text-secondary">
            {t.tradeDetail.notFound || "Trade not found"}
          </p>
          <button
            onClick={() => navigate("/trades")}
            className="text-primary hover:opacity-80"
          >
            {t.tradeDetail.backToTrades}
          </button>
        </div>
      </Layout>
    );
  }

  const fee = trade.fee ?? 0;
  const netPnl = trade.pnl + fee;
  const isWin = trade.pnl >= 0;

  // 添加截图:压缩后存为 base64 data URL(改动后自动保存会触发)
  async function handleAddImages(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    const compressed = await Promise.all(
      arr.map((f) => compressImageToDataUrl(f, 1200, 0.75))
    );
    setImages((prev) => [...prev, ...compressed]);
  }

  function handleRemoveImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleImageInput(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleAddImages(e.target.files);
    e.target.value = "";
  }

  // 粘贴图片:监听剪贴板里的 image/* 文件
  async function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleAddImages(files);
    }
  }

  return (
    <Layout title={t.title.trades}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/trades")}
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.tradeDetail.backToTrades}
          </button>
          {/* 自动保存状态指示器 */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs transition-opacity ${
              saveState === "idle" ? "opacity-0" : "opacity-100"
            }`}
          >
            {saveState === "saving" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />
                <span className="text-text-muted">
                  {language === "zh" ? "保存中…" : "Saving…"}
                </span>
              </>
            ) : saveState === "saved" ? (
              <>
                <Check className="h-3.5 w-3.5 text-primary" />
                <span className="text-primary">
                  {t.tradeDetail.saved}
                </span>
              </>
            ) : null}
          </span>
        </div>

        {/* Trade Info Card */}
        <div className="rounded-md border border-border bg-bg-surface px-5 py-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-text">
              {trade.symbol}
            </span>
            <Badge variant={trade.direction === "long" ? "primary" : "loss"}>
              {trade.direction === "long"
                ? t.dashboard.long
                : t.dashboard.short}
            </Badge>
            <Badge variant="neutral">
              {t.tradesPage.closed}
            </Badge>
            {accountName && (
              <span className="text-xs text-text-muted">{accountName}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-6">
            <InfoCell label={t.tradesPage.entry} value={formatCurrency(trade.entryPrice)} />
            <InfoCell label={t.tradesPage.exit} value={formatCurrency(trade.exitPrice)} />
            <InfoCell label={t.tradesPage.qty} value={String(trade.quantity)} />
            <InfoCell
              label={t.tradesPage.holdDays}
              value={`${calcHoldDays(trade.openDate, trade.closeDate)}d`}
            />
            <InfoCell
              label={t.tradesPage.pnl}
              value={formatSignedCurrencyConverted(trade.pnl, currency)}
              valueClass={isWin ? "text-primary" : "text-loss"}
            />
            <InfoCell
              label={t.tradesPage.net}
              value={formatSignedCurrencyConverted(netPnl, currency)}
              valueClass={netPnl >= 0 ? "text-primary" : "text-loss"}
            />
            <InfoCell
              label={t.tradesPage.fee}
              value={fee !== 0 ? formatSignedCurrencyConverted(fee, currency) : "—"}
              valueClass={fee < 0 ? "text-loss" : "text-text-muted"}
            />
            <InfoCell
              label={t.tradesPage.pnlPercent}
              value={formatPercent(trade.pnlPercent)}
              valueClass={isWin ? "text-primary" : "text-loss"}
            />
            <InfoCell label={t.tradeDetail.openDate} value={formatDate(trade.openDate)} />
            <InfoCell label={t.tradeDetail.closeDate} value={formatDate(trade.closeDate)} />
          </div>
        </div>

        {/* Notes Editor */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* SOP Notes */}
          <div className="rounded-md border border-border bg-bg-surface px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="font-display text-sm font-semibold tracking-tight text-text">
                {t.tradeDetail.sopNotes}
              </span>
              <span className="text-xs text-text-muted">
                {t.tradeDetail.sopHint}
              </span>
            </div>
            <textarea
              value={sopNotes}
              onChange={(e) => setSopNotes(e.target.value)}
              placeholder={t.tradeDetail.sopPlaceholder}
              rows={8}
              className="w-full resize-y rounded-md border border-border bg-bg-primary px-3 py-2.5 font-body text-[13px] leading-relaxed text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
          </div>

          {/* Mindset Notes */}
          <div className="rounded-md border border-border bg-bg-surface px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="font-display text-sm font-semibold tracking-tight text-text">
                {t.tradeDetail.mindsetNotes}
              </span>
              <span className="text-xs text-text-muted">
                {t.tradeDetail.mindsetHint}
              </span>
            </div>
            <textarea
              value={mindsetNotes}
              onChange={(e) => setMindsetNotes(e.target.value)}
              placeholder={t.tradeDetail.mindsetPlaceholder}
              rows={8}
              className="w-full resize-y rounded-md border border-border bg-bg-primary px-3 py-2.5 font-body text-[13px] leading-relaxed text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* General Notes */}
        <div className="rounded-md border border-border bg-bg-surface px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="font-display text-sm font-semibold tracking-tight text-text">
              {t.tradeDetail.generalNotes}
            </span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.newTradePage.notesPlaceholder}
            rows={3}
            className="w-full resize-y rounded-md border border-border bg-bg-primary px-3 py-2.5 font-body text-[13px] leading-relaxed text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
          />
        </div>

        {/* 交易截图 */}
        <div
          className="rounded-md border border-border bg-bg-surface px-5 py-4"
          tabIndex={0}
          onPaste={handlePaste}
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="font-display text-sm font-semibold tracking-tight text-text">
              {t.tradeDetail.screenshots || (language === "zh" ? "交易截图" : "Trade Screenshots")}
            </span>
            <span className="text-xs text-text-muted">
              {t.tradeDetail.screenshotsHint || (language === "zh" ? "附上你的画线图表或交易截图" : "Attach your chart annotations or trade screenshots")}
            </span>
          </div>

          {/* 缩略图网格 */}
          {images.length > 0 && (
            <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {images.map((img, idx) => (
                <div key={idx} className="group relative aspect-square overflow-hidden rounded-md border border-border">
                  <img src={img} alt={`Screenshot ${idx + 1}`} className="h-full w-full object-cover" />
                  {/* 悬浮操作 */}
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setLightbox(img)}
                      title={language === "zh" ? "查看大图" : "View"}
                      className="flex h-7 w-7 items-center justify-center rounded-sm bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                    >
                      <Expand className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      title={language === "zh" ? "删除" : "Delete"}
                      className="flex h-7 w-7 items-center justify-center rounded-sm bg-loss/80 text-white backdrop-blur-sm transition-colors hover:bg-loss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 上传按钮 */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageInput}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-bg-primary px-4 py-2.5 text-sm text-text-secondary transition-colors hover:border-primary hover:bg-bg-hover hover:text-text"
            >
              <ImagePlus className="h-4 w-4" />
              {t.tradeDetail.addScreenshot || (language === "zh" ? "添加截图" : "Add Screenshot")}
            </button>
            <span className="text-[11px] text-text-muted">
              {language === "zh"
                ? "或在此区域按 Ctrl+V 粘贴截图"
                : "or press Ctrl+V in this area to paste"}
            </span>
          </div>
        </div>
      </div>

      {/* 大图查看器 */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightbox}
            alt="Screenshot"
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Layout>
  );
}

function InfoCell({
  label,
  value,
  valueClass = "text-text",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] uppercase tracking-wider text-text-muted">
        {label}
      </div>
      <div className={`tj-number text-[13px] font-medium ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
