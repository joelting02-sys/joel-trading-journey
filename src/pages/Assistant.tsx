import { useState, useRef, useEffect, useMemo, type FormEvent, type ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Layout from "@/components/Layout";
import { useSettings, getActiveSopRules } from "@/store/useSettings";
import { useTradeStore } from "@/store/useTradeStore";
import {
  sendChatWithImages,
  sendChatText,
  fileToBase64,
  compressImageToDataUrl,
  parseExtractedTrades,
  parseSopProposals,
  cleanResponse,
} from "@/services/aiService";
import type { ExtractionTemplate } from "@/services/aiService";
import type { ChatMessage, Trade, Direction, SopProposal, SopRule } from "@/types";
import {
  Bot, Send, Trash2, X, User, AlertCircle, CheckCircle, Image as ImageIcon, BookOpen, Plus, Pencil, Minus, Check, Sparkles, ThumbsUp, ThumbsDown, RefreshCw, Copy, Mic, Paperclip, ChevronDown,
} from "lucide-react";
import { Link } from "react-router-dom";

interface SelectedImage {
  file: File;
  preview: string;   // 压缩版,用于 UI 显示和消息持久化
  base64: string;    // 原始质量,用于发送给 AI
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
  const aiConfigs = useSettings((s) => s.aiConfigs);
  const activeAiConfigId = useSettings((s) => s.activeAiConfigId);
  const setActiveAiConfigId = useSettings((s) => s.setActiveAiConfigId);
  const sopSets = useSettings((s) => s.sopSets);
  const activeSopSetId = useSettings((s) => s.activeSopSetId);
  const sopRules = getActiveSopRules({ sopSets, activeSopSetId });
  const chatMessages = useSettings((s) => s.chatMessages);
  const addChatMessage = useSettings((s) => s.addChatMessage);
  const clearChatMessages = useSettings((s) => s.clearChatMessages);
  const deleteChatMessage = useSettings((s) => s.deleteChatMessage);
  const applySopProposals = useSettings((s) => s.applySopProposals);
  const addTrade = useTradeStore((s) => s.addTrade);
  const accounts = useTradeStore((s) => s.accounts);
  const activeAccountId = useTradeStore((s) => s.activeAccountId);
  // 当前激活的 AI 配置(从 aiConfigs 列表中查找)
  const activeAiConfig = useMemo(() => {
    const entry = aiConfigs.find((c) => c.id === activeAiConfigId);
    if (!entry) return null;
    return { endpoint: entry.endpoint, apiKey: entry.apiKey, model: entry.model };
  }, [aiConfigs, activeAiConfigId]);

  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 截图来源模板:Tradelock(行表) / MT5(块状) / auto(让 AI 自行识别)
  const [extractionTemplate, setExtractionTemplate] = useState<ExtractionTemplate>("tradelock");
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  // ref 用来同步跟踪保存状态,避免 React state 异步更新导致重复保存
  const savedKeysRef = useRef<Set<string>>(new Set());

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 配置就绪:有激活的 config 且三字段都不为空
  const configured = Boolean(activeAiConfig?.endpoint && activeAiConfig?.apiKey && activeAiConfig?.model);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, loading, error]);

  function addImages(files: File[]) {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    Promise.all(
      imageFiles.map(async (file) => ({
        file,
        preview: await compressImageToDataUrl(file),  // 压缩版用于显示和持久化
        base64: await fileToBase64(file),              // 原始质量用于发送 AI
      }))
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
    // 捕获当前图片的原始 base64(用于发送 AI)
    const imagesToSend = [...selectedImages];
    addChatMessage({
      id: `u${Date.now()}`,
      role: "user",
      content: text || (selectedImages.length > 1 ? `Uploaded ${selectedImages.length} screenshots` : "Uploaded 1 screenshot"),
      imageUrl: imagePreviews[0],  // 存压缩版,持久化不超限
      timestamp: new Date().toISOString(),
    });
    // 立即清空输入框和图片预览,不等 API 返回
    setInput("");
    setSelectedImages([]);
    setLoading(true);
    setError("");
    try {
      // 发送前再次获取最新 active config(避免闭包持有过期引用)
      const cfg = (() => {
        const entry = aiConfigs.find((c) => c.id === activeAiConfigId);
        return entry ? { endpoint: entry.endpoint, apiKey: entry.apiKey, model: entry.model } : null;
      })();
      if (!cfg) {
        throw new Error(language === "zh" ? "请先在设置中配置 AI API" : "Please configure AI API in Settings first");
      }
      let raw: string;
      if (imagesToSend.length > 0) {
        const base64List = await Promise.all(imagesToSend.map((img) => fileToBase64(img.file)));
        raw = await sendChatWithImages(cfg, text, base64List, sopRules, extractionTemplate);
      } else {
        raw = await sendChatText(cfg, text, chatMessages, sopRules);
      }
      addChatMessage({
        id: `a${Date.now()}`,
        role: "assistant",
        content: sanitizeAiResponse(cleanResponse(raw), language),
        timestamp: new Date().toISOString(),
        extractedTrades: parseExtractedTrades(raw),
        sopProposals: parseSopProposals(raw),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    clearChatMessages();
    setSavedKeys(new Set());
    setError("");
  }

  // 重新生成最后一条 assistant 消息(类似 Trae 的「重新生成」)
  async function handleResend(_msgId: string) {
    if (loading) return;
    // 找最近一条 user 消息
    const lastUserIdx = (() => {
      for (let i = chatMessages.length - 1; i >= 0; i--) {
        if (chatMessages[i].role === "user") return i;
      }
      return -1;
    })();
    if (lastUserIdx < 0) return;
    const lastUser = chatMessages[lastUserIdx];
    setLoading(true);
    setError("");
    try {
      const cfg = (() => {
        const entry = aiConfigs.find((c) => c.id === activeAiConfigId);
        return entry ? { endpoint: entry.endpoint, apiKey: entry.apiKey, model: entry.model } : null;
      })();
      if (!cfg) throw new Error(language === "zh" ? "请先在设置中配置 AI API" : "Please configure AI API in Settings first");
      const raw = await sendChatText(cfg, lastUser.content, chatMessages.slice(0, lastUserIdx), sopRules);
      // 删除此 user 之后的所有消息,再加新 assistant
      const before = chatMessages.slice(0, lastUserIdx + 1);
      // 直接覆盖 store(先清空再按 before + 新消息写回)
      clearChatMessages();
      before.forEach((m) => addChatMessage(m));
      const extractedTrades = parseExtractedTrades(raw);
      let content = sanitizeAiResponse(cleanResponse(raw), language);
      const tradesBlockTruncated = /\[TRADES\]/i.test(raw) && !/\[\/TRADES\]/i.test(raw);
      if (tradesBlockTruncated) {
        content += language === "zh"
          ? (extractedTrades?.length
            ? `\n\n⚠️ AI 回复在多订单 JSON 中途被截断，已恢复其中 **${extractedTrades.length}** 笔可保存的交易。若数量不全，请分批上传截图后重试。`
            : "\n\n⚠️ AI 回复在多订单 JSON 中途被截断，未能恢复可保存的交易。请分批上传截图后重试。")
          : (extractedTrades?.length
            ? `\n\n⚠️ The AI reply was truncated mid multi-trade JSON. Recovered **${extractedTrades.length}** savable trade(s). If some are missing, re-upload in smaller batches.`
            : "\n\n⚠️ The AI reply was truncated mid multi-trade JSON and no savable trades could be recovered. Please re-upload in smaller batches.");
      }
      addChatMessage({
        id: `a${Date.now()}`,
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
        extractedTrades,
        sopProposals: parseSopProposals(raw),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function buildTradeFromExtracted(ex: Partial<Trade>, index: number, accountId: string): Trade {
    const today = new Date().toISOString().slice(0, 10);
    const entry = ex.entryPrice ?? 0;
    const exit = ex.exitPrice ?? 0;
    const qty = ex.quantity && ex.quantity > 0 ? ex.quantity : 1;
    const direction: Direction = ex.direction === "short" ? "short" : "long";
    // 优先用 AI 从截图里直接提取的 pnl(broker 的权威值,MT5/Tradelock 都准确)
    // 缺失时才用 calcPreviewPnl 兜底计算
    const hasExtractedPnl = typeof ex.pnl === "number" && !Number.isNaN(ex.pnl);
    const pnlRaw = hasExtractedPnl
      ? (ex.pnl as number)
      : calcPreviewPnl({ entryPrice: entry, exitPrice: exit, quantity: qty, direction, symbol: ex.symbol });
    const pnl = Number(pnlRaw.toFixed(2));
    // P&L 百分比 = 盈亏 / 合约名义价值 × 100
    // 名义价值 = entry × qty × 合约大小(USD)
    // ⚠️ JPY 报价对(USDJPY, GBPJPY 等)entry 是 JPY,需要先除以 USDJPY 折算成 USD
    const sym = (ex.symbol || "").toUpperCase().replace(/[\s/]/g, "");
    const jpyQuotePairs = ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY", "CADJPY"];
    const forexPairs = ["EURUSD", "AUDUSD", "GBPUSD", "USDJPY", "USDCAD", "NZDUSD", "USDCHF", "EURJPY", "GBPJPY", "AUDJPY", "EURAUD", "EURGBP", "AUDNZD", "CADJPY"];
    let contractSize = 1;
    if (forexPairs.includes(sym)) contractSize = 100000;
    else if (sym === "XAUUSD") contractSize = 100;
    else if (sym === "XAGUSD") contractSize = 5000;
    // 名义价值(USD):JPY 报价对用 entry / USDJPY_ESTIMATE 折算
    const entryForNotional = jpyQuotePairs.includes(sym) ? entry / USDJPY_ESTIMATE : entry;
    const notional = entryForNotional * qty * contractSize;
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

  // 当前激活配置信息(用于底部模型选择器显示)
  const activeConfigEntry = aiConfigs.find((c) => c.id === activeAiConfigId);

  return (
    <Layout title={t.title.assistant}>
      {/* 全屏 flex 容器,上下排布:消息区(可滚动) + 底部输入区(固定居中) */}
      <div className="flex h-full w-full flex-col">
        {/* 消息区 - 居中容器,内容限宽 768px 类似 Trae */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {chatMessages.length === 0 ? (
              <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-text">{t.assistantPage.welcome}</h2>
                <p className="mt-2 max-w-md text-sm text-text-secondary">{t.assistantPage.welcomeDesc}</p>
                <p className="mt-3 text-xs text-text-muted">
                  {language === "zh"
                    ? "支持识别 Tradelock / MT5 交易记录图片"
                    : "Supports Tradelock / MT5 trade screenshot recognition"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {chatMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    savedKeys={savedKeys}
                    accounts={accounts}
                    activeAccountId={activeAccountId}
                    onSaveOne={handleSaveOne}
                    onSaveAll={handleSaveAll}
                    onApplySopProposal={applySopProposals}
                    onDeleteMessage={deleteChatMessage}
                    onResend={() => handleResend(msg.id)}
                    sopRules={sopRules}
                    saveTradeLabel={t.assistantPage.saveTrade}
                    tradeExtractedLabel={t.assistantPage.tradeExtracted}
                    selectAccountLabel={language === "zh" ? "选择账户" : "Select Account"}
                    saveAllLabel={language === "zh" ? "全部保存" : "Save All"}
                    savedLabel={language === "zh" ? "已保存" : "Saved"}
                    language={language}
                    labels={{
                      sopProposalTitle: t.assistantPage.sopProposalTitle,
                      sopActionAdd: t.assistantPage.sopActionAdd,
                      sopActionUpdate: t.assistantPage.sopActionUpdate,
                      sopActionRemove: t.assistantPage.sopActionRemove,
                      sopApply: t.assistantPage.sopApply,
                      sopApplyAll: t.assistantPage.sopApplyAll,
                      sopReject: t.assistantPage.sopReject,
                      sopApplied: t.assistantPage.sopApplied,
                      sopRejected: t.assistantPage.sopRejected,
                      sopReasonAdd: t.assistantPage.sopReasonAdd,
                      sopReasonUpdate: t.assistantPage.sopReasonUpdate,
                      sopReasonRemove: t.assistantPage.sopReasonRemove,
                    }}
                  />
                ))}
                {loading && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-elevated">
                      <Bot className="h-4 w-4 text-text-secondary" />
                    </div>
                    <div className="rounded-2xl border border-border bg-bg-surface px-4 py-2.5 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-loss/10">
                      <AlertCircle className="h-4 w-4 text-loss" />
                    </div>
                    <div className="rounded-2xl border border-loss/30 bg-loss/5 px-4 py-2.5 text-sm text-loss shadow-sm">
                      {t.assistantPage.apiError}: {error}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        {/* 底部输入区 - Trae 风格:居中卡片,左右工具按钮,圆形发送按钮 */}
        <div className="border-t border-border bg-bg-surface/80 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-3xl px-4 py-3">
            <form onSubmit={handleSend}>
              {/* 图片预览 + 模板选择器(条件显示) */}
              {selectedImages.length > 0 && (
                <div className="mb-2">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="group relative">
                        <img src={img.preview} alt="" className="h-16 w-16 rounded-lg border border-border object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-loss text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* 模板选择器 */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-text-muted">{t.assistantPage.templateLabel}</span>
                    <div className="inline-flex rounded-md border border-border bg-bg p-0.5">
                      {(["tradelock", "mt5", "auto"] as ExtractionTemplate[]).map((tp) => {
                        const isActive = extractionTemplate === tp;
                        const label = tp === "tradelock"
                          ? t.assistantPage.templateTradelock
                          : tp === "mt5"
                            ? t.assistantPage.templateMt5
                            : t.assistantPage.templateAuto;
                        return (
                          <button
                            key={tp}
                            type="button"
                            onClick={() => setExtractionTemplate(tp)}
                            className={`rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              isActive
                                ? "bg-primary text-white shadow-sm"
                                : "text-text-secondary hover:bg-bg-hover hover:text-text"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {extractionTemplate === "mt5" && (
                      <span className="text-[10px] italic text-warning">
                        {t.assistantPage.templateMt5Hint}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 输入卡片 */}
              <div className="group relative rounded-2xl border border-border bg-bg-surface shadow-sm transition-shadow focus-within:border-primary/40 focus-within:shadow-md">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <textarea
                  value={input}
                  onChange={(e) => { setInput(e.target.value); if (error) setError(""); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  onPaste={handlePaste}
                  rows={1}
                  placeholder={t.assistantPage.placeholder}
                  className="block w-full resize-none rounded-t-2xl border-0 bg-transparent px-4 pt-3 pb-1.5 text-sm text-text outline-none placeholder:text-text-muted"
                  style={{ maxHeight: "160px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = Math.min(target.scrollHeight, 160) + "px";
                  }}
                />

                {/* 底部工具栏 */}
                <div className="flex items-center justify-between gap-2 px-2 pb-2">
                  <div className="flex items-center gap-1">
                    {/* 附件按钮 */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title={t.assistantPage.upload}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    {/* 模型选择器(参考 Trae 的 GLM-5.2 那种) */}
                    {activeConfigEntry ? (
                      <div className="relative">
                        <select
                          value={activeAiConfigId}
                          onChange={(e) => setActiveAiConfigId(e.target.value)}
                          title={language === "zh" ? "切换模型" : "Switch Model"}
                          className="appearance-none rounded-lg border border-transparent bg-transparent py-1.5 pl-2.5 pr-6 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text focus:border-primary focus:outline-none"
                        >
                          {aiConfigs.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.model || c.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" />
                      </div>
                    ) : null}
                    {/* 清空对话(只有有消息时才显示) */}
                    {chatMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClear}
                        title={t.assistantPage.clear}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-loss"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* 语音按钮(占位) */}
                    <button
                      type="button"
                      title={language === "zh" ? "语音输入" : "Voice Input"}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                    {/* 发送按钮 - 圆形,紫色调 */}
                    <button
                      type="submit"
                      disabled={loading || (!input.trim() && selectedImages.length === 0)}
                      title={t.assistantPage.send}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-sm transition-all hover:opacity-90 hover:shadow disabled:bg-bg-elevated disabled:text-text-muted disabled:shadow-none"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
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
  onApplySopProposal: (proposals: SopProposal[]) => void;
  onDeleteMessage: (id: string) => void;
  onResend: (msgId: string) => void;
  sopRules: SopRule[];
  saveTradeLabel: string;
  tradeExtractedLabel: string;
  selectAccountLabel: string;
  saveAllLabel: string;
  savedLabel: string;
  language: "zh" | "en";
  labels: {
    sopProposalTitle: string;
    sopActionAdd: string;
    sopActionUpdate: string;
    sopActionRemove: string;
    sopApply: string;
    sopApplyAll: string;
    sopReject: string;
    sopApplied: string;
    sopRejected: string;
    sopReasonAdd: string;
    sopReasonUpdate: string;
    sopReasonRemove: string;
  };
}

function MessageBubble({
  msg, savedKeys, accounts, activeAccountId,
  onSaveOne, onSaveAll, onApplySopProposal, onDeleteMessage, onResend, sopRules,
  saveTradeLabel, tradeExtractedLabel,
  selectAccountLabel, saveAllLabel, savedLabel, language, labels,
}: MessageBubbleProps) {
  const isUser = msg.role === "user";
  const trades = msg.extractedTrades ?? (msg.extractedTrade ? [msg.extractedTrade] : []);
  const sopProposals = msg.sopProposals ?? [];
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccountId);
  // SOP 提议应用/拒绝状态(本地跟踪,key 为提案的稳定指纹)
  const [sopStatus, setSopStatus] = useState<Record<string, "applied" | "rejected" | undefined>>({});
  // 反馈状态(赞/踩)
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  // 复制反馈
  const [copied, setCopied] = useState(false);
  const allSaved = trades.length > 0 && trades.every((_, idx) => savedKeys.has(`${msg.id}_${idx}`));

  // 生成提案稳定 key(action+ruleId+title+desc)
  function sopKey(p: SopProposal, idx: number): string {
    return `${msg.id}_sop_${idx}_${p.action}_${p.ruleId ?? "new"}_${p.title}`;
  }

  function handleApplySopProposal(p: SopProposal, idx: number) {
    onApplySopProposal([p]);
    setSopStatus((s) => ({ ...s, [sopKey(p, idx)]: "applied" }));
  }
  function handleApplyAllSop() {
    onApplySopProposal(sopProposals);
    const next: Record<string, "applied" | "rejected"> = {};
    sopProposals.forEach((p, idx) => { next[sopKey(p, idx)] = "applied"; });
    setSopStatus((next as unknown) as Record<string, "applied" | "rejected" | undefined>);
  }
  function handleRejectSopProposal(p: SopProposal, idx: number) {
    setSopStatus((s) => ({ ...s, [sopKey(p, idx)]: "rejected" }));
  }

  function handleCopy() {
    if (!msg.content) return;
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    // Trae 风格:消息占整行,卡片居中靠左/靠右(对话式气泡)
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`relative flex w-full max-w-[85%] min-w-0 flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        {/* 用户消息:右侧浅色卡片;助手消息:左侧无卡片(全宽 markdown),底部加工具栏 */}
        {isUser ? (
          <>
            {msg.imageUrl && (
              <img src={msg.imageUrl} alt="" className="max-h-40 max-w-full rounded-xl border border-border object-cover" />
            )}
            {msg.content && (
              <div className="overflow-hidden rounded-2xl rounded-tr-md border border-border bg-primary/8 px-3.5 py-2 text-sm text-text shadow-sm">
                <div className="prose-chat overflow-hidden">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="m-0 leading-relaxed">{children}</p>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            {/* 删除单条消息按钮(hover 显示) */}
            <button
              type="button"
              onClick={() => onDeleteMessage(msg.id)}
              title={language === "zh" ? "删除" : "Delete"}
              className="absolute -top-1 right-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-loss text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-loss/80"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            {msg.content && (
              <div className="min-w-0 overflow-hidden text-sm text-text">
                <div className="prose-chat overflow-hidden">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className="my-2 w-full overflow-x-auto">
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
                      p: ({ children }) => <p className="m-0 my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
                      ul: ({ children }) => <ul className="m-0 my-1.5 pl-5 list-disc">{children}</ul>,
                      ol: ({ children }) => <ol className="m-0 my-1.5 pl-5 list-decimal">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      code: ({ children, className }) => {
                        const isBlock = className?.includes("language-");
                        return isBlock ? (
                          <code className="block overflow-x-auto rounded-md bg-bg-elevated px-3 py-2 font-mono text-xs">{children}</code>
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

            {/* 工具栏 - Trae 风格:复制/赞/踩/重做,小图标,hover 显示 */}
            <div className="mt-1 flex items-center gap-0.5 text-text-muted">
              <IconButton title={language === "zh" ? "复制" : "Copy"} onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </IconButton>
              <IconButton
                title={language === "zh" ? "赞" : "Like"}
                active={feedback === "up"}
                onClick={() => setFeedback(feedback === "up" ? null : "up")}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                title={language === "zh" ? "踩" : "Dislike"}
                active={feedback === "down"}
                onClick={() => setFeedback(feedback === "down" ? null : "down")}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton title={language === "zh" ? "重新生成" : "Regenerate"} onClick={() => onResend(msg.id)}>
                <RefreshCw className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton title={language === "zh" ? "删除" : "Delete"} onClick={() => onDeleteMessage(msg.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </>
        )}

        {/* 交易提取卡片 + 账户选择 + 保存按钮 */}
        {trades.length > 0 && (
          <div className="mt-2 w-full rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <CheckCircle className="h-3.5 w-3.5" />
              {tradeExtractedLabel} ({trades.length})
            </div>
            {/* 每笔交易的简要信息 */}
            <div className="mb-2.5 space-y-1">
              {trades.map((ex, idx) => {
                const isSaved = savedKeys.has(`${msg.id}_${idx}`);
                // 优先用 AI 从截图里直接提取的 pnl(broker 权威值,避免 JPY 对计算错误)
                // 缺失时回退到 calcPreviewPnl
                const hasExtractedPnl = typeof ex.pnl === "number" && !Number.isNaN(ex.pnl);
                const pnl = hasExtractedPnl ? (ex.pnl as number) : calcPreviewPnl(ex);
                const fee = Number(ex.fee) || 0;
                const net = pnl + fee; // 净盈亏 = P&L + 手续费(负数)
                const pnlColor = pnl > 0 ? "text-primary" : pnl < 0 ? "text-loss" : "text-text-muted";
                const netColor = net > 0 ? "text-primary" : net < 0 ? "text-loss" : "text-text-muted";
                return (
                  <div key={idx} className="flex flex-col gap-0.5 rounded-md bg-bg-surface/60 px-2 py-1.5 text-xs">
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
                        {hasExtractedPnl && (
                          <span className="ml-1 text-[10px] text-text-muted" title={language === "zh" ? "来自截图" : "From screenshot"}>
                            📷
                          </span>
                        )}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-text-secondary">
                      {language === "zh" ? "记录到:" : "Save to:"}
                    </span>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="min-w-0 flex-1 rounded-md border border-border bg-bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-primary"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} · {a.broker}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onSaveAll(msg.id, trades, selectedAccountId)}
                      className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
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

        {/* SOP 修改提议卡片 */}
        {sopProposals.length > 0 && (
          <div className="mt-2 w-full rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text">
                <BookOpen className="h-3.5 w-3.5 text-warning" />
                {labels.sopProposalTitle} ({sopProposals.length})
              </div>
              {sopProposals.some((_, idx) => sopStatus[sopKey(sopProposals[idx], idx)] !== "applied" && sopStatus[sopKey(sopProposals[idx], idx)] !== "rejected") && (
                <button
                  type="button"
                  onClick={handleApplyAllSop}
                  className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  <Sparkles className="h-3 w-3" />
                  {labels.sopApplyAll}
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {sopProposals.map((p, idx) => {
                const k = sopKey(p, idx);
                const status = sopStatus[k];
                const isApplied = status === "applied";
                const isRejected = status === "rejected";
                const actionLabel = p.action === "add"
                  ? labels.sopActionAdd
                  : p.action === "update"
                    ? labels.sopActionUpdate
                    : labels.sopActionRemove;
                const ActionIcon = p.action === "add" ? Plus : p.action === "update" ? Pencil : Minus;
                const actionColor = p.action === "add"
                  ? "text-primary bg-primary/10"
                  : p.action === "update"
                    ? "text-warning bg-warning/10"
                    : "text-loss bg-loss/10";
                const reasonHint = p.action === "add"
                  ? labels.sopReasonAdd
                  : p.action === "update"
                    ? labels.sopReasonUpdate
                    : labels.sopReasonRemove;
                // 查找原规则(update/remove 时显示对比)
                const original = p.ruleId ? sopRules.find((r) => r.id === p.ruleId) : undefined;
                return (
                  <div
                    key={k}
                    className={`rounded-md bg-bg-surface/70 px-2 py-1.5 text-xs transition-opacity ${isApplied || isRejected ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm ${actionColor}`}>
                        <ActionIcon className="h-3 w-3" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${actionColor}`}>
                            {actionLabel}
                          </span>
                          <span className="rounded-sm bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                            {p.category}
                          </span>
                          <span className="font-medium text-text">{p.title}</span>
                        </div>
                        <p className="mt-1 leading-relaxed text-text-secondary">{p.description}</p>
                        {original && p.action === "update" && (
                          <div className="mt-1 rounded-sm bg-bg-elevated/60 px-1.5 py-1 text-[11px]">
                            <div className="text-text-muted">
                              {language === "zh" ? "原规则:" : "Original:"}
                            </div>
                            <div className="text-text-secondary">{original.title}: {original.description}</div>
                          </div>
                        )}
                        {original && p.action === "remove" && (
                          <div className="mt-1 rounded-sm bg-loss/5 px-1.5 py-1 text-[11px]">
                            <div className="text-loss">
                              {language === "zh" ? "将删除:" : "Will delete:"}
                            </div>
                            <div className="text-text-secondary">{original.title}: {original.description}</div>
                          </div>
                        )}
                        {p.reason && (
                          <p className="mt-1 text-[11px] italic text-text-muted">
                            💡 {p.reason}
                          </p>
                        )}
                        {!p.reason && (
                          <p className="mt-0.5 text-[11px] italic text-text-muted">{reasonHint}</p>
                        )}
                        {/* 应用/拒绝按钮 */}
                        <div className="mt-1.5 flex items-center gap-1.5">
                          {!isApplied && !isRejected && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApplySopProposal(p, idx)}
                                className="flex items-center gap-1 rounded-sm bg-primary px-2 py-0.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                              >
                                <Check className="h-3 w-3" />
                                {labels.sopApply}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectSopProposal(p, idx)}
                                className="flex items-center gap-1 rounded-sm border border-border bg-bg px-2 py-0.5 text-[11px] font-medium text-text-muted transition-colors hover:bg-bg-hover hover:text-loss"
                              >
                                <X className="h-3 w-3" />
                                {labels.sopReject}
                              </button>
                            </>
                          )}
                          {isApplied && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                              <CheckCircle className="h-3 w-3" />
                              {labels.sopApplied}
                            </span>
                          )}
                          {isRejected && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-text-muted">
                              <X className="h-3 w-3" />
                              {labels.sopRejected}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 工具栏小图标按钮(参考 Trae 风格:小方块,hover 浅背景,active 紫色)
function IconButton({
  title, onClick, active, children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-text-muted hover:bg-bg-hover hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

// 计算预览用 P&L(不含手续费)
// 外汇/期货/指数的合约大小不同,这里用通用逻辑:
//   - 外汇对: 1 lot = 100,000 单位
//   - 黄金/白银 (XAU/USD, XAG/USD): 1 lot = 100 oz
//   - 铜 (Copper): 1 lot = 25,000 lb
//   - 指数 (US500, US30): 1 lot = 1 合约
//  quantity 单位是 lot
// ⚠️ JPY 报价对(GBPJPY, USDJPY 等)需要把 JPY 折算成 USD,这里用一个估算的 USDJPY 汇率
const USDJPY_ESTIMATE = 155; // JPY 报价对 P&L 折算用的 USDJPY 估算值
function calcPreviewPnl(t: { entryPrice?: number | string; exitPrice?: number | string; quantity?: number | string; direction?: "long" | "short"; symbol?: string }): number {
  const entry = Number(t.entryPrice) || 0;
  const exit = Number(t.exitPrice) || 0;
  const qty = Number(t.quantity) || 0;
  if (!entry || !exit || !qty) {
    console.log("[calcPreviewPnl] missing data:", { entry, exit, qty, raw: t });
    return 0;
  }
  const diff = exit - entry;
  const basePnl = t.direction === "long" ? diff * qty : -diff * qty;
  const sym = (t.symbol || "").toUpperCase().replace(/[\s/]/g, "");
  const forexPairs = ["EURUSD", "AUDUSD", "GBPUSD", "USDJPY", "USDCAD", "NZDUSD", "USDCHF", "EURJPY", "GBPJPY", "AUDJPY", "EURAUD", "EURGBP", "AUDNZD", "CADJPY"];
  // JPY 报价对:GBP/JPY、USD/JPY、EUR/JPY、AUD/JPY、CAD/JPY
  // 这些对的报价货币是 JPY,1 pip 不等于 $10/lot,需要折算
  const jpyQuotePairs = ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY", "CADJPY"];
  if (forexPairs.includes(sym)) {
    // 1 lot = 100,000 单位
    const pnlInQuote = basePnl * 100000;
    if (jpyQuotePairs.includes(sym)) {
      // JPY 报价:用估算的 USDJPY 折算成 USD
      return pnlInQuote / USDJPY_ESTIMATE;
    }
    return pnlInQuote;
  }
  if (sym === "XAUUSD") {
    // 黄金 1 lot = 100 oz
    return basePnl * 100;
  }
  if (sym === "XAGUSD") {
    // 白银 1 lot = 5000 oz
    return basePnl * 5000;
  }
  // 指数/铜:1 lot = 1 合约(不需要再乘)
  return basePnl;
}

// 格式化带符号数字（美元货币）
function formatSigned(n: number): string {
  if (n === 0) return "$0.00";
  const sign = n > 0 ? "+" : "−";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
