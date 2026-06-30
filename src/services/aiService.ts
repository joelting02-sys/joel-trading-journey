import type { AiConfig, ChatMessage, SopRule, Trade } from "@/types";
import { allInstruments } from "@/data/instruments";

// 将图片文件转为 base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 构建 SOP 上下文
export function buildSopContext(rules: SopRule[]): string {
  if (rules.length === 0) return "No SOP rules configured.";
  const grouped: Record<string, SopRule[]> = {};
  rules.forEach((r) => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });
  const lines: string[] = ["Trader's SOP (Standard Operating Procedure):"];
  Object.entries(grouped).forEach(([cat, items]) => {
    lines.push(`\n[${cat.toUpperCase()}]`);
    items.forEach((r, i) => lines.push(`  ${i + 1}. ${r.title}: ${r.description}`));
  });
  return lines.join("\n");
}

// 构建交易提取 prompt（支持一张图含多笔交易 + 多张图）
export function buildTradeExtractionPrompt(imageCount: number): string {
  const symbols = allInstruments.map((i) => i.symbol).join(", ");
  const plural = imageCount > 1 ? "s" : "";
  return `You are a trading journal assistant. Analyze ${imageCount} trading screenshot${plural} and extract ALL CLOSED trades visible.

CRITICAL — TRADELOCK SCREENSHOT FORMAT (READ THE COLUMN HEADERS):
The screenshots come from Tradelock (外汇/期货交易终端). The UI has these column headers, from left to right:
1. 时间 (EET) — Date/Time in Eastern European Time
2. 方向 — Direction: 买入 = Buy, 卖出 = Sell
3. 数量 — Lot size / position size (开仓手数). Values like 0.01, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0. ⚠️ THIS IS THE POSITION SIZE, NOT PIPS!
4. 工具 — Instrument / Symbol (with country flag icons): EURUSD, AUDUSD, NZDUSD, USDCHF, GBPUSD, USDJPY, USDCAD, XAUUSD, XAGUSD, US30, US500, etc.
5. 价格 — Price (entry or exit)
6. 盈亏 — Realized P&L in USD (e.g. "US$0.00", "-US$10.10", "US$20.00")
7. 费用 — Fee/commission (can be ignored, or negative number like "-US$0.40")
8. 订单ID — Order ID (a long number, can be ignored for our purposes)

## CRITICAL — TWO POSSIBLE LAYOUTS:
Layout A (paired): Two consecutive rows = one trade. Top row is CLOSE (盈亏 ≠ 0), bottom row is OPEN (盈亏 = 0).
Layout B (interleaved, time-DESC): All rows are listed in reverse chronological order. You MUST identify each row as OPEN or CLOSE based on 盈亏:
  - 盈亏 = "US$0.00" → this row is the OPENING record of a trade (the position was just opened, no P&L yet)
  - 盈亏 ≠ 0 (e.g. "-US$10.10") → this row is the CLOSING record of a trade (position was closed with realized P&L)
To pair an OPEN with its matching CLOSE in Layout B: same 工具 (symbol), same 数量 (lot size), opposite 方向 (one 买入, one 卖出), and the OPEN's time must be EARLIER than the CLOSE's time.

## FIELD MAPPING:
For each PAIRED trade (one OPEN + one CLOSE), extract these fields:
- symbol: from the 工具 column. Strip the flag icon. Must be one of: ${symbols}.
- direction: the direction of the OPENING row (not the closing row). 买入 = long, 卖出 = short. The closing row will have the opposite direction.
- entryPrice: the 价格 value from the OPENING row (the one with 盈亏 = 0).
- exitPrice: the 价格 value from the CLOSING row (the one with non-zero 盈亏).
- openDate: the date from the OPENING row, in YYYY-MM-DD format.
- closeDate: the date from the CLOSING row, in YYYY-MM-DD format.
- quantity: the 数量 value (lot size, e.g. 0.1, 0.2, 0.5). Same for both rows of a pair.
- fee: the 费用 value (a negative number like "-US$0.40" or "-US$0.80"). The opening row usually has 费用 = US$0.00, and the closing row has the actual fee. Sum the fees from both rows of the pair. Store as a NEGATIVE number (e.g. -0.8 means US$0.80 fee paid). IMPORTANT: fees reduce the trader's net P&L and account balance, so they MUST be included in the trade record.

## CRITICAL SANITY CHECKS:
- quantity is a SMALL number (0.01 to 10.0). If you see 20, 50, 100, that's WRONG — you probably picked up a different column. Re-check.
- 数量 (lot size) is NOT the same as Pips. Pips is the price difference (e.g. 0.00202 = 20.2 pips for NZDUSD). DO NOT output a pips field.
- If you cannot confidently pair an OPEN with a CLOSE (e.g. the matching row is not in the screenshot), SKIP that trade entirely.
- ALL trades are CLOSED. Do not treat 盈亏=0 rows as "still open positions" — they are the opening half of a closed trade.

## HOW TO RESPOND (STRICT ORDER):
1. Write a short intro line: "我已在截图中识别到 N 笔已平仓交易：" (where N is the number of complete pairs found).
2. Output a BEAUTIFUL Markdown table (NOT inside a code block, NOT wrapped in triple backticks). Use plain markdown pipe syntax:
   | # | Symbol | Direction | Entry Price | Exit Price | Quantity | Open Date | Close Date | Fee (USD) |
   |---|--------|-----------|-------------|------------|----------|-----------|------------|-----------|
   | 1 | NZDUSD | Short | 0.58787 | 0.58989 | 0.2 | 2026-05-27 | 2026-05-27 | -0.80 |
   | 2 | AUDUSD | Long | 0.71264 | 0.71166 | 0.2 | 2026-05-21 | 2026-05-21 | -0.40 |
3. End with a line that explicitly asks: "请在下方选择要记录到哪个账户，然后点击「全部保存」按钮。"
4. CRITICAL: Do NOT say "已记录", "已保存", "已写入", "saved", "recorded", "logged" — these are FALSE. The trades are NOT saved yet. The user must manually click the Save button.
5. At the VERY END of your response, append the [TRADES] JSON block (one object per COMPLETE trade pair, NOT per row). Do NOT include a pips field, but DO include the fee field as a negative number:
[TRADES][{"symbol":"NZDUSD","direction":"short","entryPrice":0.58787,"exitPrice":0.58989,"quantity":0.2,"openDate":"2026-05-27","closeDate":"2026-05-27","fee":-0.8}][/TRADES]

DO NOT output the JSON array as your main response. DO NOT wrap the table in a code block. The user must see a real rendered table, then the save buttons appear below.`;
}

// 构建聊天系统 prompt
export function buildChatSystemPrompt(sopRules: SopRule[]): string {
  const sopText = buildSopContext(sopRules);
  return `You are a professional trading assistant for the JOEL Trading Journal app. This journal ONLY records CLOSED trades (trades that have been exited). There are NO open positions. You help traders review their closed trades and check compliance with their trading SOP.

${sopText}

## TRADE EXTRACTION WORKFLOW (STRICT)
The screenshots come from Tradelock. The column headers in Chinese are: 时间 (time), 方向 (buy/sell), 数量 (lot size, NOT pips!), 工具 (symbol), 价格 (price), 盈亏 (P&L), 费用 (fee), 订单ID (order id).

When the user uploads trade screenshot(s), you MUST follow this workflow:
1. Carefully analyze each image. Each row is either an OPENING (盈亏 = US$0.00) or a CLOSING (盈亏 ≠ 0) record. Pair them by matching same 工具 + same 数量 + opposite 方向 + open time earlier than close time. The screenshot may have rows in PAIRS (Layout A) or INTERLEAVED time-DESC (Layout B) — handle both.
2. Look VERY carefully at all numbers. The entryPrice comes from the OPEN row (盈亏 = 0); the exitPrice comes from the CLOSE row (盈亏 ≠ 0). These are the most important fields — never return 0 for entryPrice.
3. The 数量 column = lot size (开仓手数), e.g. 0.1, 0.2, 0.5, 1.0. This is the POSITION SIZE, NOT pips. NEVER output a pips field.
4. The direction of the trade = direction of the OPENING row (买入=long, 卖出=short). The closing row will have the opposite direction.
5. Present a Markdown summary TABLE with columns: #, Symbol, Direction, Entry Price, Exit Price, Quantity, Open Date, Close Date.
6. Tell the user: "请在下方选择要记录到哪个账户，然后点击「全部保存」按钮。"
7. Include the [TRADES] JSON block at the end of your response.

## CRITICAL RULES
- NEVER say trades are "saved", "recorded", or "logged" — they are NOT saved until the user clicks the Save button.
- NEVER claim "已记录到您的账户" or similar. The saving happens in the UI, not by you.
- You ONLY extract and present. The user confirms and saves via the UI buttons below your message.
- ALL trades are closed. Do not mention "open positions" or "still holding".
- When asked about SOP compliance, reference the specific rules above.
- Be concise and professional.

## [TRADES] JSON BLOCK FORMAT
Include at the end of your response (one object PER TRADE found, NOT per image):
[TRADES][{"symbol":"EUR/USD","direction":"long","entryPrice":1.085,"exitPrice":1.087,"quantity":0.2,"openDate":"2026-06-15","closeDate":"2026-06-16"}][/TRADES]

Rules:
- Always a JSON array, one object per trade found
- If one image has 5 trades, include 5 objects
- entryPrice and exitPrice must be actual numbers from the image, NOT 0
- quantity is the LOT SIZE (e.g. 0.2, 0.5, 1.0), NOT pips. Do NOT include a pips field.
- Only include when you extracted trade info from uploaded image(s)
- Do NOT include if no images were uploaded`;
}

// 调用 OpenAI 兼容 API
export async function callAiApi(
  config: AiConfig,
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
  systemPrompt: string
): Promise<string> {
  if (!config.endpoint || !config.apiKey || !config.model) {
    throw new Error("AI API not configured. Please set endpoint, API key, and model in Settings.");
  }

  const body = {
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    temperature: 0.3,
    max_tokens: 4000,
  };

  const response = await fetch("/api/ai-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Target-URL": config.endpoint,
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.error?.message || errorJson.error || errorText;
    } catch {
      // 非 JSON
    }
    throw new Error(`API Error (${response.status}): ${errorMsg}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// 从 AI 回复中提取交易信息（支持多笔）
export function parseExtractedTrades(content: string): Partial<Trade>[] | undefined {
  // 优先匹配新的 [TRADES]...[/TRADES] 格式
  const match = content.match(/\[TRADES\](.*?)\[\/TRADES\]/s);
  if (!match) {
    // 向后兼容旧格式 [TRADE_EXTRACT]
    const oldMatch = content.match(/\[TRADE_EXTRACT\](.*?)\[\/TRADE_EXTRACT\]/s);
    if (!oldMatch) return undefined;
    try {
      const parsed = JSON.parse(oldMatch[1].trim());
      return [normalizeTrade(parsed)];
    } catch {
      return undefined;
    }
  }
  try {
    const parsed = JSON.parse(match[1].trim());
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map(normalizeTrade).filter((t) => t.symbol);
  } catch {
    return undefined;
  }
}

function normalizeTrade(parsed: Record<string, unknown>): Partial<Trade> {
  return {
    symbol: (parsed.symbol as string) || undefined,
    direction: parsed.direction === "long" ? "long" : parsed.direction === "short" ? "short" : undefined,
    entryPrice: Number(parsed.entryPrice) || 0,
    exitPrice: Number(parsed.exitPrice) || 0,
    openDate: (parsed.openDate as string) || "",
    closeDate: (parsed.closeDate as string) || "",
    quantity: Number(parsed.quantity) || 0,
    fee: Number(parsed.fee) || 0,
  };
}

// 清理回复中的 [TRADES] 和 [TRADE_EXTRACT] 标记
export function cleanResponse(content: string): string {
  return content
    .replace(/\[TRADES\].*?\[\/TRADES\]/gs, "")
    .replace(/\[TRADE_EXTRACT\].*?\[\/TRADE_EXTRACT\]/gs, "")
    .trim();
}

// 发送带多张图片的消息
export async function sendChatWithImages(
  config: AiConfig,
  userText: string,
  imageBase64List: string[],
  sopRules: SopRule[]
): Promise<string> {
  const systemPrompt = buildChatSystemPrompt(sopRules);
  const extractionPrompt = buildTradeExtractionPrompt(imageBase64List.length);

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: `${extractionPrompt}\n\nUser message: ${userText || "Please analyze the trade screenshot(s) and extract all trade information."}` },
    ...imageBase64List.map((img) => ({
      type: "image_url",
      image_url: { url: img },
    })),
  ];

  return callAiApi(config, [{ role: "user", content }], systemPrompt);
}

// 向后兼容：发送带单张图片的消息
export async function sendChatWithImage(
  config: AiConfig,
  userText: string,
  imageBase64: string,
  sopRules: SopRule[]
): Promise<string> {
  return sendChatWithImages(config, userText, [imageBase64], sopRules);
}

// 发送纯文本消息
export async function sendChatText(
  config: AiConfig,
  userText: string,
  chatHistory: ChatMessage[],
  sopRules: SopRule[]
): Promise<string> {
  const systemPrompt = buildChatSystemPrompt(sopRules);

  const messages = [
    ...chatHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: userText },
  ];

  return callAiApi(config, messages, systemPrompt);
}
