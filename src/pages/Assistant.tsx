import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import { useTradeStore } from "@/store/useTradeStore";
import {
  sendChatWithImages,
  sendChatText,
  fileToBase64,
  parseExtractedTrades,
  cleanResponse,
} from "@/services/aiService";
import type { ChatMessage, Trade, Direction } from "@/types";
import {
  Bot, Send, Trash2, X, User, AlertCircle, CheckCircle, Image as ImageIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

interface SelectedImage {
  file: File;
  preview: string;
}

// 客户端兜底：把 AI 误说的"已记录/已保存"改成警告语，并强制加上询问账户的提示
function sanitizeAiResponse(content: string, language: "zh" | "en"): string {
  const falseClaimsZh = [
    /已记录[^\n。]*?[。\n]/g,
    /已保存[^\n。]*?[。\n]/g,
    /已写入[^\n。]*?[。\n]/g,
    /已经[为帮]?您[^\n。]*?(记录|保存|写入)[^\n。]*?[。\n]/g,
    /[Tt]rade[s]? (have been |are )?(saved|recorded|logged)[^\n]*?[.\n]/g,
    /(saved|recorded|logged) (to|into) (your )?(account|journal)[^\n]*?[.\n]/g,
  ];
  const warningZh = language === "zh"
    ? "\n\n⚠️ 提示：以上交易**尚未**保存到账户。请在下方选择账户后点击「全部保存」按钮才会真正记录。"
    : "\n\n⚠️ Note: the above trades are **NOT** saved yet. Please select an account below and click 'Save All' to actually record them.";
  let sanitized = content;
  for (const re of falseClaimsZh) sanitized = sanitized.replace(re, "");
  // 如果有 extractedTrades 但 AI 没问账户，强制追加
  const asksAccount = /请在下方选择|please select|choose an account|记录到哪个账户|select.*account/i.test(sanitized);
  if (!asksAccount) sanitized = sanitized.trim() + warningZh;
  else sanitized = sanitized.trim() + warningZh;
  return sanitized;
}

export default function Assistant() {
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const aiConfig = useSettings((s) => s.aiConfig);
  const sopRules = useSettings((s) => s.sopRules);
  const chatMessages = useSettings((s) => s.chatMessages);
  const addChatMessage = useSettings((s) => s.addChatMessage);
  const clearChatMessages = useSettings((s) => s.clearChatMessages);
  const addTrade = useTradeStore((s) => s.addTrade);
  const accounts = useTradeStore((s) => s.accounts);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);

  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  // ref 用来同步跟踪保存状态,避免 React state 异步更新导致重复保存
  const savedKeysRef = useRef<Set<string>>(new Set());

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const configured = Boolean(aiConfig.endpoint && aiConfig.apiKey && aiConfig.model);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, loading, error]);

  function addImages(files: File[]) {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    Promise.all(
      imageFiles.map(async (file) => ({ file, preview: await fileToBase64(file) }))
    ).then((imgs) => setSelectedImages((prev) => [...prev, ...imgs]));
  }

  function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    addImages(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemoveImage(idx: number) {
    setSelectedImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) { e.preventDefault(); addImages(files); }
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && selectedImages.length === 0) || loading) return;
    const imagePreviews = selectedImages.map((img) => img.preview);
    addChatMessage({
      id: `u${Date.now()}`,
      role: "user",
      content: text || (selectedImages.length > 1 ? `Uploaded ${selectedImages.length} screenshots` : "Uploaded 1 screenshot"),
      imageUrl: imagePreviews[0],
      timestamp: new Date().toISOString(),
    });
    setInput("");
    setLoading(true);
    setError("");
    try {
      let raw: string;
      if (selectedImages.length > 0) {
        const base64List = await Promise.all(selectedImages.map((img) => fileToBase64(img.file)));
        raw = await sendChatWithImages(aiConfig, text, base64List, sopRules);
      } else {
        raw = await sendChatText(aiConfig, text, chatMessages, sopRules);
      }
      addChatMessage({
        id: `a${Date.now()}`,
        role: "assistant",
        content: sanitizeAiResponse(cleanResponse(raw), language),
        timestamp: new Date().toISOString(),
        extractedTrades: parseExtractedTrades(raw),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setSelectedImages([]);
    }
  }

  function handleClear() {
    clearChatMessages();
    setSavedKeys(new Set());
    setError("");
  }

  function buildTradeFromExtracted(ex: Partial<Trade>, index: number, accountId: string): Trade {
    const today = new Date().toISOString().slice(0, 10);
    const entry = ex.entryPrice ?? 0;
    const exit = ex.exitPrice ?? 0;
    const qty = ex.quantity && ex.quantity > 0 ? ex.quantity : 1;
    const direction: Direction = ex.direction === "short" ? "short" : "long";
    // P&L 只算价格×数量的差异,绝不包括手续费
    const pnlRaw = calcPreviewPnl({ entryPrice: entry, exitPrice: exit, quantity: qty, direction, symbol: ex.symbol });
    const pnl = Number(pnlRaw.toFixed(2));
    // P&L 百分比 = 盈亏 / 合约名义价值 × 100
    // 合约名义价值 = entry × qty × 合约大小
    const sym = (ex.symbol || "").toUpperCase().replace(/[\s/]/g, "");
    const forexPairs = ["EURUSD", "AUDUSD", "GBPUSD", "USDJPY", "USDCAD", "NZDUSD", "USDCHF", "EURJPY", "GBPJPY", "AUDJPY", "EURAUD", "EURGBP", "AUDNZD", "CADJPY"];
    let contractSize = 1;
    if (forexPairs.includes(sym)) contractSize = 100000;
    else if (sym === "XAUUSD") contractSize = 100;
    else if (sym === "XAGUSD") contractSize = 5000;
    const notional = entry * qty * contractSize;
    const pnlPercent = notional > 0 ? (pnlRaw / notional) * 100 : 0;
    // fee 单独存(负数),不合并到 P&L
    const fee = ex.fee ?? 0;
    return {
      id: `T${Date.now()}_${index}`,
      symbol: ex.symbol ?? "",
      direction,
      entryPrice: entry,
      exitPrice: exit,
      quantity: qty,
      pnl: Number(pnl.toFixed(2)),
      pnlPercent: Number(pnlPercent.toFixed(2)),
      fee,
      openDate: ex.openDate || today,
      closeDate: ex.closeDate || today,
      status: "closed",
      account: accountId,
    };
  }

  function handleSaveOne(msgId: string, ex: Partial<Trade>, index: number, accountId: string) {
    const key = `${msgId}_${index}`;
    if (savedKeysRef.current.has(key)) return; // 已保存过,直接返回
    const trade = buildTradeFromExtracted(ex, index, accountId);
    addTrade(trade);
    savedKeysRef.current.add(key);
    setSavedKeys((s) => {
      const next = new Set(s);
      next.add(key);
      return next;
    });
  }

  function handleSaveAll(msgId: string, trades: Partial<Trade>[], accountId: string) {
    trades.forEach((ex, idx) => {
      handleSaveOne(msgId, ex, idx, accountId);
    });
  }

  if (!configured) {
    return (
      <Layout title={t.title.assistant}>
        <div className="flex h-[calc(100vh-140px)] items-center justify-center">
          <div className="w-full max-w-md rounded-md border border-border bg-bg-surface px-6 py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <AlertCircle className="h-6 w-6 text-warning" />
            </div>
            <h2 className="text-lg font-semibold text-text">{t.assistantPage.notConfigured}</h2>
            <p className="mt-1.5 text-sm text-text-secondary">{t.assistantPage.notConfiguredDesc}</p>
            <Link to="/settings" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
              {t.assistantPage.goToSettings}
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={t.title.assistant}>
      <div className="flex flex-col overflow-hidden rounded-md border border-border bg-bg-surface" style={{ height: "calc(100vh - 140px)" }}>
        <div className="flex-1 overflow-y-auto p-4">
          {chatMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-text">{t.assistantPage.welcome}</h3>
              <p className="mt-1 max-w-sm text-sm text-text-secondary">{t.assistantPage.welcomeDesc}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {chatMessages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  savedKeys={savedKeys}
                  accounts={accounts}
                  activeAccountId={activeAccountId}
                  onSaveOne={handleSaveOne}
                  onSaveAll={handleSaveAll}
                  saveTradeLabel={t.assistantPage.saveTrade}
                  tradeExtractedLabel={t.assistantPage.tradeExtracted}
                  selectAccountLabel={language === "zh" ? "选择账户" : "Select Account"}
                  saveAllLabel={language === "zh" ? "全部保存" : "Save All"}
                  savedLabel={language === "zh" ? "已保存" : "Saved"}
                  language={language}
                />
              ))}
              {loading && (
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-elevated">
                    <Bot className="h-4 w-4 text-text-secondary" />
                  </div>
                  <span className="rounded-md bg-bg-elevated px-3 py-2 text-sm italic text-text-muted">{t.assistantPage.thinking}</span>
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-loss/10">
                    <AlertCircle className="h-4 w-4 text-loss" />
                  </div>
                  <div className="rounded-md border border-loss/30 bg-loss/5 px-3 py-2 text-sm text-loss">
                    {t.assistantPage.apiError}: {error}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="border-t border-border bg-bg-surface p-3">
          {selectedImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative">
                  <img src={img.preview} alt="" className="h-16 w-16 rounded-md border border-border object-cover" />
                  <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-loss text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
            {chatMessages.length > 0 && (
              <button type="button" onClick={handleClear} title={t.assistantPage.clear} className="flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-xs font-medium text-text-muted transition-colors hover:bg-bg-hover hover:text-loss">
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.assistantPage.clear}</span>
              </button>
            )}
            <button type="button" onClick={() => fileInputRef.current?.click()} title={t.assistantPage.upload} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-bg text-text-secondary transition-colors hover:bg-bg-hover">
              <ImageIcon className="h-4 w-4" />
            </button>
            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); if (error) setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              onPaste={handlePaste}
              rows={1}
              placeholder={t.assistantPage.placeholder}
              className="max-h-32 flex-1 resize-none rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary"
            />
            <button type="submit" disabled={loading || (!input.trim() && selectedImages.length === 0)} title={t.assistantPage.send} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-white transition-opacity hover:opacity-90 disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

interface MessageBubbleProps {
  msg: ChatMessage;
  savedKeys: Set<string>;
  accounts: { id: string; name: string; broker: string }[];
  activeAccountId: string;
  onSaveOne: (msgId: string, ex: Partial<Trade>, index: number, accountId: string) => void;
  onSaveAll: (msgId: string, trades: Partial<Trade>[], accountId: string) => void;
  saveTradeLabel: string;
  tradeExtractedLabel: string;
  selectAccountLabel: string;
  saveAllLabel: string;
  savedLabel: string;
  language: "zh" | "en";
}

function MessageBubble({
  msg, savedKeys, accounts, activeAccountId,
  onSaveOne, onSaveAll, saveTradeLabel, tradeExtractedLabel,
  selectAccountLabel, saveAllLabel, savedLabel, language,
}: MessageBubbleProps) {
  const isUser = msg.role === "user";
  const trades = msg.extractedTrades ?? (msg.extractedTrade ? [msg.extractedTrade] : []);
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccountId);
  const allSaved = trades.length > 0 && trades.every((_, idx) => savedKeys.has(`${msg.id}_${idx}`));

  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-primary/10" : "bg-bg-elevated"}`}>
        {isUser ? <User className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-text-secondary" />}
      </div>
      <div className={`flex max-w-[85%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        {msg.imageUrl && <img src={msg.imageUrl} alt="" className="max-h-40 rounded-md border border-border object-cover" />}
        {msg.content && (
          <div className={`overflow-hidden rounded-md px-3 py-2 text-sm ${isUser ? "bg-primary/10 text-text" : "bg-bg-elevated text-text"}`}>
            <div className="prose-chat">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="my-2 overflow-x-auto">
                      <table className="w-full border-collapse text-xs">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-bg-elevated">{children}</thead>,
                  th: ({ children }) => (
                    <th className="border border-border bg-bg-elevated px-2 py-1 text-left font-semibold text-text">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-2 py-1 text-text-secondary">{children}</td>
                  ),
                  tr: ({ children }) => <tr className="even:bg-bg-elevated/50">{children}</tr>,
                  p: ({ children }) => <p className="m-0 leading-relaxed">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
                  ul: ({ children }) => <ul className="m-0 pl-4">{children}</ul>,
                  ol: ({ children }) => <ol className="m-0 pl-4">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  code: ({ children, className }) => {
                    const isBlock = className?.includes("language-");
                    return isBlock ? (
                      <code className="block overflow-x-auto rounded-sm bg-bg px-2 py-1 font-mono text-xs">{children}</code>
                    ) : (
                      <code className="rounded-sm bg-bg-elevated px-1 py-0.5 font-mono text-[11px]">{children}</code>
                    );
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {/* 交易提取卡片 + 账户选择 + 保存按钮 */}
        {trades.length > 0 && (
          <div className="w-full rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <CheckCircle className="h-3.5 w-3.5" />
              {tradeExtractedLabel} ({trades.length})
            </div>
            {/* 每笔交易的简要信息 */}
            <div className="mb-2.5 space-y-1">
              {trades.map((ex, idx) => {
                const isSaved = savedKeys.has(`${msg.id}_${idx}`);
                // 计算 P&L：手续费前的盈亏
                const pnl = calcPreviewPnl(ex);
                const fee = Number(ex.fee) || 0;
                const net = pnl + fee; // 净盈亏 = P&L + 手续费(负数)
                const pnlColor = pnl > 0 ? "text-primary" : pnl < 0 ? "text-loss" : "text-text-muted";
                const netColor = net > 0 ? "text-primary" : net < 0 ? "text-loss" : "text-text-muted";
                return (
                  <div key={idx} className="flex flex-col gap-0.5 rounded-sm bg-bg-surface/60 px-2 py-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="tj-number font-medium text-text">
                        #{idx + 1} {ex.symbol} {ex.direction === "long" ? "↗" : "↘"}
                        {ex.quantity ? <span className="ml-1 text-text-muted">×{ex.quantity}</span> : null}
                      </span>
                      <span className="tj-number text-text-secondary">
                        @ {ex.entryPrice} → {ex.exitPrice || "—"}
                      </span>
                      {isSaved && <CheckCircle className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <div className="flex items-center gap-3 pl-4 text-[11px]">
                      <span className="text-text-muted">
                        {language === "zh" ? "盈亏" : "P&L"}:{" "}
                        <span className={`tj-number font-semibold ${pnlColor}`}>
                          {formatSigned(pnl)}
                        </span>
                      </span>
                      {fee !== 0 && (
                        <span className="text-text-muted">
                          {language === "zh" ? "手续费" : "Fee"}:{" "}
                          <span className="tj-number font-semibold text-loss">
                            {formatSigned(fee)}
                          </span>
                        </span>
                      )}
                      <span className="text-text-muted">
                        {language === "zh" ? "净盈亏" : "Net"}:{" "}
                        <span className={`tj-number font-semibold ${netColor}`}>
                          {formatSigned(net)}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 账户选择 + 保存按钮 */}
            {!allSaved && (
              <div className="flex flex-col gap-2 border-t border-primary/20 pt-2">
                {accounts.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">
                      {language === "zh" ? "记录到:" : "Save to:"}
                    </span>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="flex-1 rounded-md border border-border bg-bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-primary"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} · {a.broker}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onSaveAll(msg.id, trades, selectedAccountId)}
                      className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {saveAllLabel}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-warning/10 px-2 py-1.5">
                    <span className="text-xs text-text-secondary">
                      {language === "zh"
                        ? "⚠ 请先创建账户才能保存交易"
                        : "⚠ Please create an account first"}
                    </span>
                    <Link
                      to="/accounts"
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                    >
                      {language === "zh" ? "前往创建" : "Create"}
                    </Link>
                  </div>
                )}
              </div>
            )}
            {allSaved && (
              <div className="flex items-center gap-1.5 border-t border-primary/20 pt-2 text-xs font-medium text-primary">
                <CheckCircle className="h-3.5 w-3.5" />
                {savedLabel} ✓
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 计算预览用 P&L（不含手续费）
// 外汇/期货/指数的合约大小不同，这里用通用逻辑：
//   - 外汇对: 1 lot = 100,000 单位
//   - 黄金/白银 (XAU/USD, XAG/USD): 1 lot = 100 oz
//   - 铜 (Copper): 1 lot = 25,000 lb
//   - 指数 (US500, US30): 1 lot = 1 合约
//  quantity 单位是 lot
function calcPreviewPnl(t: { entryPrice?: number | string; exitPrice?: number | string; quantity?: number | string; direction?: "long" | "short"; symbol?: string }): number {
  const entry = Number(t.entryPrice) || 0;
  const exit = Number(t.exitPrice) || 0;
  const qty = Number(t.quantity) || 0;
  if (!entry || !exit || !qty) {
    console.log("[calcPreviewPnl] missing data:", { entry, exit, qty, raw: t });
    return 0;
  }
  const diff = exit - entry;
  // 基础 P&L（按 1 单位 × 价格差计算）
  const basePnl = t.direction === "long" ? diff * qty : -diff * qty;
  // 对于外汇对，价格差太小，需要乘以合约大小
  const sym = (t.symbol || "").toUpperCase().replace(/[\s/]/g, "");
  // 外汇对（支持 NZDUSD, NZD/USD, AUDUSD 等所有格式）
  const forexPairs = ["EURUSD", "AUDUSD", "GBPUSD", "USDJPY", "USDCAD", "NZDUSD", "USDCHF", "EURJPY", "GBPJPY", "AUDJPY", "EURAUD", "EURGBP", "AUDNZD", "CADJPY"];
  if (forexPairs.includes(sym)) {
    // 1 lot = 100,000 units
    return basePnl * 100000;
  }
  if (sym === "XAUUSD") {
    // 黄金 1 lot = 100 oz
    return basePnl * 100;
  }
  if (sym === "XAGUSD") {
    // 白银 1 lot = 5000 oz
    return basePnl * 5000;
  }
  // 指数/铜：1 lot = 1 合约（不需要再乘）
  return basePnl;
}

// 格式化带符号数字（美元货币）
function formatSigned(n: number): string {
  if (n === 0) return "$0.00";
  const sign = n > 0 ? "+" : "−";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
