import type {
  AiConfig,
  ChatMessage,
  SopProposal,
  SopRule,
  Trade,
  CalendarPreferences,
  CalendarCountryCode,
  CalendarInstrumentCode,
} from "@/types";
import { allInstruments } from "@/data/instruments";

// 将图片文件转为 base64(原始质量,用于发送给 AI)
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

// 将图片压缩为 data URL(用于 UI 预览和持久化,避免 localStorage 超限)
export function compressImageToDataUrl(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

// 构建 SOP 上下文(包含 id,便于 AI 引用 update/remove)
export function buildSopContext(rules: SopRule[]): string {
  if (rules.length === 0) return "No SOP rules configured.";
  const grouped: Record<string, SopRule[]> = {};
  rules.forEach((r) => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });
  const lines: string[] = [
    "Trader's SOP (Standard Operating Procedure):",
    "Each rule has an `id` field. When proposing an update/remove, use the EXACT id shown below.",
  ];
  Object.entries(grouped).forEach(([cat, items]) => {
    lines.push(`\n[${cat.toUpperCase()}]`);
    items.forEach((r) => lines.push(`  - id="${r.id}" | ${r.title}: ${r.description}`));
  });
  return lines.join("\n");
}

// 交易记录来源模板(Tradelock / MT5 / 自动识别)
export type ExtractionTemplate = "auto" | "tradelock" | "mt5";

// 构建交易提取 prompt
export function buildTradeExtractionPrompt(imageCount: number, template: ExtractionTemplate = "tradelock"): string {
  const symbols = allInstruments.map((i) => i.symbol).join(", ");
  const plural = imageCount > 1 ? "s" : "";

  if (template === "tradelock") {
    return buildTradelockPrompt(imageCount, symbols, plural);
  }
  if (template === "mt5") {
    return buildMt5Prompt(imageCount, symbols, plural);
  }
  // auto: 让 AI 自行识别
  return buildAutoDetectPrompt(imageCount, symbols, plural);
}

function buildTradelockPrompt(imageCount: number, symbols: string, plural: string): string {
  return `You are a trading journal assistant. Analyze ${imageCount} trading screenshot${plural} (source: Tradelock 外汇/期货交易终端) and extract ALL CLOSED trades visible.

CRITICAL — TRADELOCK SCREENSHOT FORMAT (READ THE COLUMN HEADERS):
The screenshots come from Tradelock. The UI has these column headers, from left to right:
1. 时间 (EET) — Date/Time in Eastern European Time
2. 方向 — Direction: 买入 = Buy, 卖出 = Sell
3. 数量 — Lot size / position size (开仓手数). Values like 0.01, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0. ⚠️ THIS IS THE POSITION SIZE, NOT PIPS!
4. 工具 — Instrument / Symbol (with country flag icons): EURUSD, AUDUSD, NZDUSD, USDCHF, GBPUSD, USDJPY, USDCAD, XAUUSD, XAGUSD, US30, US500, etc.
5. 价格 — Price (entry or exit)
6. 盈亏 — Realized P&L in USD (e.g. "US$0.00", "-US$10.10", "US$20.00"). ⚠️ THIS IS THE BROKER'S AUTHORITATIVE P&L — copy it EXACTLY into the \`pnl\` field.
7. 费用 — Fee/commission (can be ignored, or negative number like "-US$0.40")
8. 订单ID — Order ID (a long number, can be ignored for our purposes)

## ⚠️ CRITICAL — ALWAYS EXTRACT P&L FROM 盈亏 COLUMN, NEVER RECOMPUTE IT:
The broker's 盈亏 column is the AUTHORITATIVE P&L value. It correctly accounts for:
- SL/TP-triggered closes where entry price = exit price (your price diff is 0 but P&L is non-zero, e.g. -US$10 from a 0.1 lot EURUSD stop-loss)
- JPY-quoted pairs (GBPJPY, USDJPY, EURJPY) where 1 pip does NOT equal $10/lot
- Cross pairs (GBPAUD, EURAUD, AUDNZD) where USD conversion is non-trivial
- Account-currency conversion, contract size variations, etc.
If you recompute P&L from entryPrice/exitPrice/quantity alone, you will be WRONG for SL/TP closes (entry=exit so price diff = 0) and for JPY/cross pairs.
So: ALWAYS extract the 盈亏 column value exactly as shown (with sign: -US$10.10 or US$20.00), and put it in the \`pnl\` field of [TRADES] JSON. DO NOT try to recompute. The journal will use your extracted pnl as the source of truth.

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
- **pnl: the 盈亏 value from the CLOSING row, in USD with sign (e.g. -10.10 for "-US$10.10", 20.00 for "US$20.00"). This is the AUTHORITATIVE value from the broker — copy it EXACTLY.**
- fee: the 费用 value (a negative number like "-US$0.40" or "-US$0.80"). The opening row usually has 费用 = US$0.00, and the closing row has the actual fee. Sum the fees from both rows of the pair. Store as a NEGATIVE number (e.g. -0.8 means US$0.80 fee paid). IMPORTANT: fees reduce the trader's net P&L and account balance, so they MUST be included in the trade record.

## CRITICAL SANITY CHECKS:
- quantity is a SMALL number (0.01 to 10.0). If you see 20, 50, 100, that's WRONG — you probably picked up a different column. Re-check.
- 数量 (lot size) is NOT the same as Pips. Pips is the price difference (e.g. 0.00202 = 20.2 pips for NZDUSD). DO NOT output a pips field.
- The 盈亏 value can be non-zero even when entryPrice = exitPrice (e.g. SL/TP triggered but display shows same price due to rounding or partial fills). Trust the 盈亏 column.
- If you cannot confidently pair an OPEN with a CLOSE (e.g. the matching row is not in the screenshot), SKIP that trade entirely.
- ALL trades are CLOSED. Do not treat 盈亏=0 rows as "still open positions" — they are the opening half of a closed trade.

## HOW TO RESPOND (STRICT ORDER):
1. Write a short intro line: "我已在截图中识别到 N 笔已平仓交易：" (where N is the number of complete pairs found).
2. Output a BEAUTIFUL Markdown table (NOT inside a code block, NOT wrapped in triple backticks). Use plain markdown pipe syntax:
   | # | Symbol | Direction | Entry Price | Exit Price | Quantity | Open Date | Close Date | P&L (USD) | Fee (USD) |
   |---|--------|-----------|-------------|------------|----------|-----------|------------|-----------|-----------|
   | 1 | EUR/USD | Long | 1.14 | 1.14 | 0.1 | 2026-07-01 | 2026-07-01 | -10.00 | -0.40 |
   | 2 | NZDUSD | Short | 0.58787 | 0.58989 | 0.2 | 2026-05-27 | 2026-05-27 | -20.00 | -0.80 |
3. End with a line that explicitly asks: "请在下方选择要记录到哪个账户，然后点击「全部保存」按钮。"
4. CRITICAL: Do NOT say "已记录", "已保存", "已写入", "saved", "recorded", "logged" — these are FALSE. The trades are NOT saved yet. The user must manually click the Save button.
5. At the VERY END of your response, append the [TRADES] JSON block (one object per COMPLETE trade pair, NOT per row). The \`pnl\` field is REQUIRED for Tradelock — copy it from the 盈亏 column:
[TRADES][{"symbol":"EUR/USD","direction":"long","entryPrice":1.14,"exitPrice":1.14,"quantity":0.1,"openDate":"2026-07-01","closeDate":"2026-07-01","pnl":-10.00,"fee":-0.40}][/TRADES]

DO NOT output the JSON array as your main response. DO NOT wrap the table in a code block. The user must see a real rendered table, then the save buttons appear below.`;
}

function buildMt5Prompt(imageCount: number, symbols: string, plural: string): string {
  return `You are a trading journal assistant. Analyze ${imageCount} MT5 (MetaTrader 5) trading history screenshot${plural} and extract ALL CLOSED trades visible.

## CRITICAL — MT5 SCREENSHOT FORMAT (READ CAREFULLY)
The screenshot is from MT5's History tab. Each trade is shown as a CARD/BLOCK (one card per deal, NOT a row). Each block has:
- A colored vertical bar on the left (e.g. orange/blue for buy, red/green for sell) — used to indicate direction.
- Header line: \`<SYMBOL>.tm, <buy|sell> <LOT_SIZE>\`  e.g. \`AUDUSD.tm, buy 0.01\`
- On the right of the header: close time (e.g. \`2026.03.18 11:21:06\`)
- Below the header: \`<entryPrice> → <exitPrice>\`  (entry → exit) followed by the **P&L in USD** shown in red (negative) or green/blue (positive) — e.g. \`-1.09\` or \`+5.20\`. THIS P&L IS THE BROKER'S AUTHORITATIVE VALUE — copy it into a \`pnl\` field in the [TRADES] JSON.
- Second line: an order reference such as \`#1809924\` on the left, then \`打开 : <open_time>\` (e.g. \`2026.03.18 09:06:37\`). ⚠️ The \`#<number>\` is just a ticket ID — IGNORE it. Do NOT record it as any field.
- Third line: \`止盈: <TP_price>\` and \`库存费: <swap>\` (e.g. \`0.00\`)
- Fourth line: \`止损: <SL_price>\`, \`获利: <take_profit_price>\`, and \`手续费: <commission>\` (e.g. \`0.00\`)

⚠️ IMPORTANT: SL and TP labels show the SET levels, not actual outcomes. The real exit price is in the header's "→ exitPrice" pair.

⚠️ WHY EXTRACT \`pnl\` FROM SCREENSHOT (NOT RECOMPUTE IT):
The broker-computed P&L in the screenshot is the AUTHORITATIVE value. It correctly accounts for:
- JPY-quoted pairs (e.g. GBPJPY, USDJPY, EURJPY) where 1 pip does NOT equal $10 per lot
- Cross pairs (GBPAUD, EURAUD, AUDNZD) where USD conversion is non-trivial
- Account-currency conversion, contract size variations, swap, etc.
If you recompute P&L from entryPrice/exitPrice/quantity alone, you will be WRONG for JPY pairs and cross pairs (e.g. the user's GBPJPY screenshot shows P&L of \`-1.09\` USD but naive calc would give \`-173\` because it treats the price difference as USD).
So: ALWAYS extract the \`pnl\` number shown next to the entry→exit pair, with the correct sign (red = negative, green/blue = positive). DO NOT try to recompute it. The journal will use your extracted pnl as the source of truth.

The fields you need to extract per block are: symbol, direction, quantity, entryPrice, exitPrice, openDate, closeDate, fee, pnl. NOTHING ELSE — IGNORE the order/ticket ID, IGNORE the SL/TP setting levels (they are pre-set thresholds, not the actual exit).

## BLOCK LAYOUT (single block = one CLOSED trade)
Every block in the screenshot is ALREADY a single closed trade (no pairing needed). You just extract fields from each block.

## FIELD MAPPING (for each block):
- symbol: from the header, e.g. \`AUDUSD.tm\` → \`AUDUSD\`. Strip \`.tm\` / \`.pro\` / \`.ec\` / \`.f\` / \`.s\` suffixes. Must be one of: ${symbols}.
- direction: from header. \`buy\` = long, \`sell\` = short.
- quantity: the lot size after direction in header, e.g. \`buy 0.01\` → 0.01. SMALL number (0.01–10.0). NEVER confuse with price.
- entryPrice: the FIRST price in the header's "price1 → price2" pair.
- exitPrice: the SECOND price in the header's "price1 → price2" pair.
- openDate: from \`打开 : <datetime>\`, in YYYY-MM-DD format.
- closeDate: from the close time in the header's right side, in YYYY-MM-DD format.
- fee: from \`手续费: <value>\` line. If \`0.00\`, fee = 0. If negative, store as negative number.
- **pnl**: the broker's P&L value shown next to the entry→exit pair, in USD, with sign (negative for loss, positive for profit). This is the AUTHORITATIVE value — copy it EXACTLY. Do NOT recompute.

## DATE FORMAT
MT5 uses \`YYYY.MM.DD HH:MM:SS\`. Convert to \`YYYY-MM-DD\` only (drop the time).

## CRITICAL SANITY CHECKS:
- If \`buy\`, then exitPrice < entryPrice means LOSS, > entryPrice means GAIN. If \`sell\`, then exitPrice > entryPrice means LOSS, < entryPrice means GAIN. The extracted \`pnl\` sign must match (positive for gain, negative for loss). If they conflict, RECHECK the screenshot.
- The \`pnl\` value should be in USD with proper sign (red text = negative, green/blue text = positive). The number itself is the broker-computed value, do not modify it.
- quantity is small (0.01 to 10). If you see 100, 200 etc., that's a price, not quantity.
- DO NOT confuse the SL/TP displayed levels with exitPrice. The actual exit is in the header.
- If a block is partially cut off / unreadable, SKIP it. Do NOT guess.
- All trades are CLOSED. There are NO open positions.

## HOW TO RESPOND (STRICT ORDER):
1. Write a short intro line: "我已在 MT5 截图中识别到 N 笔已平仓交易：" (where N = blocks you extracted).
2. Output a BEAUTIFUL Markdown table (NOT inside a code block):
   | # | Symbol | Direction | Entry Price | Exit Price | Quantity | Open Date | Close Date | Fee (USD) |
   |---|--------|-----------|-------------|------------|----------|-----------|------------|-----------|
   | 1 | AUDUSD | Long | 0.69355 | 0.69482 | 0.01 | 2026-04-01 | 2026-04-01 | 0.00 |
3. End with: "请在下方选择要记录到哪个账户，然后点击「全部保存」按钮。"
4. Do NOT claim "已保存" / "已记录" / "saved" / "recorded" / "logged". Trades are NOT saved until the user clicks the Save button.
5. At the VERY END, append the [TRADES] JSON block (one object per block). The \`pnl\` field is REQUIRED for MT5 — copy it exactly from the screenshot:
[TRADES][{"symbol":"AUDUSD","direction":"long","entryPrice":0.69355,"exitPrice":0.69482,"quantity":0.01,"openDate":"2026-04-01","closeDate":"2026-04-01","fee":0,"pnl":1.27},{"symbol":"GBPJPY","direction":"short","entryPrice":210.258,"exitPrice":210.431,"quantity":0.01,"openDate":"2026-04-01","closeDate":"2026-04-01","fee":0,"pnl":-1.09}][/TRADES]

DO NOT output the JSON array as your main response. DO NOT wrap the table in a code block. The user must see a real rendered table, then the save buttons appear below.`;
}

function buildAutoDetectPrompt(imageCount: number, symbols: string, plural: string): string {
  return `You are a trading journal assistant. Analyze ${imageCount} trading history screenshot${plural} and extract ALL CLOSED trades visible.

STEP 1 — DETECT THE FORMAT
First, identify which trading platform the screenshot is from. Look at:
- The column headers, font, layout, language
- The presence of certain fields: 时间, 方向, 数量, 工具, 价格, 盈亏, 费用 (Tradelock) OR
  blocks with 打开, 止盈, 止损, 获利, 库存费, 手续费 (MT5)
- A row-based table (Tradelock) vs card/block layout (MT5)

STEP 2 — APPLY THE CORRECT EXTRACTION RULES
- If you detect Tradelock format (row-based table with column headers 时间/方向/数量/工具/价格/盈亏/费用):
  Use Tradelock rules: pair OPEN rows (盈亏 = 0) with CLOSE rows (盈亏 ≠ 0) by matching same 工具+数量 with opposite 方向. ALWAYS extract the 盈亏 column value EXACTLY into the \`pnl\` field (NEVER recompute from prices — SL/TP closes have entry=exit so naive calc gives 0 but real P&L is non-zero).
- If you detect MT5 format (block/card layout, each block has \`<symbol>.tm, buy/sell <lot>\` header with entry→exit prices and a bottom line with 打开/止盈/止损/获利/库存费/手续费):
  Use MT5 rules: each block is already one closed trade, extract directly from the block. IGNORE the \`#<order_id>\` ticket ID and the SL/TP setting levels (they are NOT the actual exit price — the actual exit is in the header's \`entry → exit\` pair). For MT5 you MUST also include a \`pnl\` field in [TRADES] JSON — copy the broker-computed P&L (the red/green number next to the entry→exit pair) EXACTLY. Do NOT recompute P&L from entryPrice/exitPrice/quantity because that will be WRONG for JPY pairs and cross pairs.
- If you cannot confidently identify the format, ASK the user which platform the screenshot is from. Do NOT guess fields.

## COMMON FIELD MAPPING (use after detecting format):
- symbol: a recognized instrument from: ${symbols}. Strip broker suffixes (.tm, .pro, .ec, .f, .s) and flag icons.
- direction: long or short. Tradelock: direction of the OPENING row. MT5: from header "buy"/"sell".
- entryPrice: the actual entry price. Never return 0.
- exitPrice: the actual exit price. Never return 0.
- openDate: YYYY-MM-DD format.
- closeDate: YYYY-MM-DD format.
- quantity: lot size, a small number (0.01 to 10.0). NEVER confuse with price.
- fee: the commission/fee value (negative or zero). Sum if multiple fee rows exist.

## HOW TO RESPOND:
1. Tell the user which format you detected (Tradelock / MT5 / Unknown).
2. If Unknown, ASK the user to clarify the platform before extracting.
3. If detected, write: "我已在截图中识别到 N 笔已平仓交易："
4. Output a Markdown table:
   | # | Symbol | Direction | Entry Price | Exit Price | Quantity | Open Date | Close Date | Fee (USD) |
   |---|--------|-----------|-------------|------------|----------|-----------|------------|-----------|
5. End with: "请在下方选择要记录到哪个账户，然后点击「全部保存」按钮。"
6. Do NOT claim "已保存" / "已记录" / "saved" / "recorded" / "logged".
7. Append [TRADES] JSON block at the very end:
[TRADES][{"symbol":"AUDUSD","direction":"long","entryPrice":0.71173,"exitPrice":0.71074,"quantity":0.01,"openDate":"2026-03-18","closeDate":"2026-03-18","fee":0}][/TRADES]`;
}

// 构建聊天系统 prompt
export function buildChatSystemPrompt(sopRules: SopRule[]): string {
  const sopText = buildSopContext(sopRules);
  const tradesExample = '[TRADES][{"symbol":"EUR/USD","direction":"long","entryPrice":1.085,"exitPrice":1.087,"quantity":0.2,"openDate":"2026-06-15","closeDate":"2026-06-16"}][/TRADES]';
  const sopProposalExample = '[SOP_PROPOSAL][{"action":"add","category":"entry","title":"<short rule title>","description":"<detailed description>","reason":"<why this rule helps the trader>"}][/SOP_PROPOSAL]';
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
${tradesExample}

Rules:
- Always a JSON array, one object per trade found
- If one image has 5 trades, include 5 objects
- entryPrice and exitPrice must be actual numbers from the image, NOT 0
- quantity is the LOT SIZE (e.g. 0.2, 0.5, 1.0), NOT pips. Do NOT include a pips field.
- Only include when you extracted trade info from uploaded image(s)
- Do NOT include if no images were uploaded

## [SOP_PROPOSAL] JSON BLOCK FORMAT (for SOP modification suggestions)

When the user discusses their trading SOP with you and asks to add / modify / remove rules, you may propose specific changes. The user must manually approve any change via the UI. To make a proposal, append a JSON block at the END of your response (after any other content):
${sopProposalExample}

Actions:
- "add" — propose adding a new rule
- "update" — propose modifying an existing rule; must include "ruleId" of the existing rule
- "remove" — propose deleting an existing rule; must include "ruleId" of the existing rule

Category must be one of: "entry", "exit", "risk", "psychology", "general".

Rules:
- Only emit [SOP_PROPOSAL] when the user EXPLICITLY asks to change, add, or remove SOP rules, or when they ask for an SOP review and you have specific actionable changes.
- You can include multiple proposals in one array (e.g. add 2 new rules and remove 1).
- Do NOT include [SOP_PROPOSAL] for general SOP discussions where no specific change is being proposed.
- The current SOP rules (with their IDs) are listed at the top of this system prompt — use the IDs exactly when referencing "update" or "remove".
- Always explain each change in plain language BEFORE the [SOP_PROPOSAL] block (e.g. "我建议在入场规则里增加一条... 原因是...").
- The user clicks "应用" (Apply) or "拒绝" (Reject) on each proposal in the chat UI. You do not apply changes yourself.
`;
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
    // pnl 是 broker 截图里直接给出的权威值(MT5 必填,Tradelock 可选)
    // 设为可选,缺失时 JS 用 entryPrice/exitPrice/quantity 计算
    pnl: parsed.pnl !== undefined && parsed.pnl !== null ? Number(parsed.pnl) : undefined,
  };
}

// 清理回复中的 [TRADES]、[TRADE_EXTRACT]、[SOP_PROPOSAL] 标记(只清掉,真正的解析在 parseSopProposals 中)
export function cleanResponse(content: string): string {
  return content
    .replace(/\[TRADES\].*?\[\/TRADES\]/gs, "")
    .replace(/\[TRADE_EXTRACT\].*?\[\/TRADE_EXTRACT\]/gs, "")
    .replace(/\[SOP_PROPOSAL\].*?\[\/SOP_PROPOSAL\]/gs, "")
    .trim();
}

// 从 AI 回复中提取 SOP 提议
const VALID_CATEGORIES: SopProposal["category"][] = [
  "entry", "exit", "risk", "psychology", "general",
];
const VALID_ACTIONS: SopProposal["action"][] = ["add", "update", "remove"];

export function parseSopProposals(content: string): SopProposal[] | undefined {
  const match = content.match(/\[SOP_PROPOSAL\](.*?)\[\/SOP_PROPOSAL\]/s);
  if (!match) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  const proposals: SopProposal[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const action = r.action as SopProposal["action"];
    if (!VALID_ACTIONS.includes(action)) continue;
    const category = (r.category as SopProposal["category"]) ?? "general";
    if (!VALID_CATEGORIES.includes(category)) continue;
    const title = String(r.title ?? "").trim();
    const description = String(r.description ?? "").trim();
    if (!title || !description) continue;
    const ruleId = r.ruleId ? String(r.ruleId) : undefined;
    const id = r.id ? String(r.id) : undefined;
    const reason = r.reason ? String(r.reason) : undefined;
    proposals.push({ action, category, title, description, ruleId, id, reason });
  }
  return proposals.length > 0 ? proposals : undefined;
}

// 发送带多张图片的消息
export async function sendChatWithImages(
  config: AiConfig,
  userText: string,
  imageBase64List: string[],
  sopRules: SopRule[],
  template: ExtractionTemplate = "tradelock"
): Promise<string> {
  const systemPrompt = buildChatSystemPrompt(sopRules);
  const extractionPrompt = buildTradeExtractionPrompt(imageBase64List.length, template);

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
  sopRules: SopRule[],
  template: ExtractionTemplate = "tradelock"
): Promise<string> {
  return sendChatWithImages(config, userText, [imageBase64], sopRules, template);
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

// =============== 经济日历汇总 ===============

// 国家/地区显示名称映射
const countryLabels: Record<CalendarCountryCode, { zh: string; en: string; flag: string }> = {
  US: { zh: "美国", en: "United States", flag: "🇺🇸" },
  EU: { zh: "欧元区", en: "Eurozone", flag: "🇪🇺" },
  GB: { zh: "英国", en: "United Kingdom", flag: "🇬🇧" },
  JP: { zh: "日本", en: "Japan", flag: "🇯🇵" },
  AU: { zh: "澳大利亚", en: "Australia", flag: "🇦🇺" },
  CA: { zh: "加拿大", en: "Canada", flag: "🇨🇦" },
  CH: { zh: "瑞士", en: "Switzerland", flag: "🇨🇭" },
  CN: { zh: "中国", en: "China", flag: "🇨🇳" },
  NZ: { zh: "新西兰", en: "New Zealand", flag: "🇳🇿" },
};

// 品种影响关系(用于标注哪些品种受该国数据影响)
// 影响逻辑:该国货币/经济是这些品种的组成部分
const countryToInstruments: Record<CalendarCountryCode, CalendarInstrumentCode[]> = {
  US: ["EURUSD", "AUDUSD", "GBPUSD", "USDJPY", "USDCAD", "XAUUSD", "XAGUSD", "US500", "US30", "NAS100"],
  EU: ["EURUSD", "EURJPY", "EURGBP", "GER40"],
  GB: ["GBPUSD", "GBPJPY", "EURGBP"],
  JP: ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY"],
  AU: ["AUDUSD", "AUDJPY"],
  CA: ["USDCAD"],
  CH: ["USDJPY", "XAUUSD", "XAGUSD"],
  CN: ["AUDUSD", "Copper"],
  NZ: ["AUDUSD", "AUDJPY"],
};

// 计算本周(周一到周日)的日期范围
function getWeekRange(today: Date = new Date()): { start: Date; end: Date; days: Date[] } {
  const day = today.getDay();
  // 周一为一周开始 (day=1, 周日为 day=0)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setDate(today.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return { start, end, days };
}

// 构建经济日历汇总的 prompt
export function buildCalendarPrompt(prefs: CalendarPreferences, language: "zh" | "en" = "zh"): string {
  const { start, end, days } = getWeekRange();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  // 关注的国家(用 flag + 本地化名字)
  const countriesText = prefs.countries.length > 0
    ? prefs.countries.map((c) => `${countryLabels[c]?.flag ?? ""} ${countryLabels[c]?.[language] ?? c}`).join("、")
    : (language === "zh" ? "全部主要国家" : "all major countries");

  // 关注的品种
  const instrumentsText = prefs.instruments.length > 0
    ? prefs.instruments.join(", ")
    : (language === "zh" ? "全部主流品种" : "all major instruments");

  // 重要性筛选
  const importanceText = prefs.importance === "high_only"
    ? (language === "zh" ? "仅高重要性" : "high importance only")
    : prefs.importance === "medium_and_high"
      ? (language === "zh" ? "中+高重要性" : "medium and high importance")
      : (language === "zh" ? "全部重要性" : "all importance levels");

  // 哪些品种受关注国家影响(用于 AI 标注"影响品种"列)
  const affectedInstruments: string[] = [];
  for (const c of prefs.countries) {
    const list = countryToInstruments[c] ?? [];
    for (const inst of list) {
      if (prefs.instruments.length === 0 || prefs.instruments.includes(inst)) {
        if (!affectedInstruments.includes(inst)) affectedInstruments.push(inst);
      }
    }
  }
  const affectedText = affectedInstruments.length > 0 ? affectedInstruments.join(", ") : instrumentsText;

  // 各国/品种对应表(供 AI 参考)
  const referenceTable = prefs.countries.map((c) => {
    const label = countryLabels[c];
    const rel = (countryToInstruments[c] ?? []).filter(
      (i) => prefs.instruments.length === 0 || prefs.instruments.includes(i)
    );
    return `- ${label?.flag} ${label?.[language] ?? c} (${c}) → 影响品种: ${rel.length > 0 ? rel.join(", ") : "—"}`;
  }).join("\n");

  // 是否包含银行休市
  const bankHolidaysSection = prefs.includeBankHolidays
    ? (language === "zh"
      ? `### 🏦 银行休市
列出本周(YYYY-MM-DD 至 ${endStr})有关注国家(美国/欧元区/英国/日本/澳洲/加拿大/瑞士/中国/新西兰)的银行或主要交易所休市情况,以及休市原因(如节假日)。若无休市则写"无"。`
      : `### 🏦 Bank Holidays
List any bank or major exchange holidays in the focus countries during ${startStr} to ${endStr}, including the reason (e.g. holiday name). Write "None" if no holidays.`)
    : "";

  // 是否包含情绪
  const sentimentSection = prefs.includeSentiment
    ? (language === "zh"
      ? `## 📊 已公布数据的市场情绪(对非专业用户友好)
对于本周**已实际公布**的数据,在每行末尾"影响品种"列之后增加"情绪"列,用以下格式标注:
- **📈 看多**:当数据明显好于预期,通常推升相关货币/资产时
- **📉 看空**:当数据明显差于预期,通常打压相关货币/资产时
- **➖ 中性**:数据符合预期或影响不明确
并在表格下方用一段通俗易懂的话(1-2 句)解释:**"如果该数据表现强于预期,通常利好 XX(对应货币/资产),利空 YY"**,用最简单的话让非专业用户理解逻辑。
**未公布的数据不写情绪,留空**。`
      : `## 📊 Market Sentiment for Released Data
For events that have ALREADY been released, add a "Sentiment" column at the end:
- **📈 Bullish**: when actual > forecast, generally lifts the related currency/asset
- **📉 Bearish**: when actual < forecast, generally weighs on the related currency/asset
- **➖ Neutral**: when in line with forecast or impact unclear
Add a short note (1-2 sentences) below the table explaining in plain language: **"If this data prints stronger than expected, it usually supports XX and pressures YY"**.
**For upcoming events, leave the sentiment blank.**`)
    : "";

  const intro = language === "zh"
    ? `今天是 ${todayStr}。请汇总本周(${startStr} 至 ${endStr})的经济日历,聚焦用户关注的设置。`
    : `Today is ${todayStr}. Please summarize the economic calendar for this week (${startStr} to ${endStr}), focused on the user's preferences.`;

  const output = language === "zh"
    ? `## 📅 本周经济日历(${startStr} 至 ${endStr})

按周几分组,每个周几一个小标题(格式: \`### 周一(YYYY-MM-DD)\`)。每天给一个表格(没有事件则跳过该天,只显示"无重要数据"):

| 时间(HKT) | 国家 | 事件 | 重要性 | 前值 | 预期 | 实际 | 影响品种 | 情绪 |
|---|---|---|---|---|---|---|---|---|
| 20:30 | 🇺🇸 美国 | CPI 同比 | ⭐⭐⭐ | 3.2% | 3.1% | — | EURUSD, XAUUSD | (待公布) |

**表格列说明:**
- 时间:使用 HKT(香港时间,UTC+8),如果该数据有夏令时变化请注明
- 国家:用旗帜 emoji + 国家/地区名
- 重要性:⭐(低) ⭐⭐(中) ⭐⭐⭐(高)
- 前值/预期/实际:实际值未公布时留 "—"
- 影响品种:列出该事件直接影响的相关品种(从用户关注列表中选)
- 情绪:仅在数据已公布时填写,未公布则留空或写"(待公布)"

${bankHolidaysSection}

${sentimentSection}

## 🔗 实时数据源(供你核实)
你的训练数据可能滞后,以这些权威网站为准:
- Investing.com 经济日历: https://www.investing.com/economic-calendar/
- TradingEconomics: https://tradingeconomics.com/calendar
- Forex Factory: https://www.forexfactory.com/calendar
- 各国央行官网(美联储/欧央行/英国央行/日本央行/澳洲联储/加拿大央行/瑞士央行/中国央行/新西兰联储)
- 财经日历网(中文): https://www.fx168news.com/calendar

## ⚠️ 重要免责声明
- 你的训练数据可能截至 2025 年中,**无法保证事件时间的实时准确性**
- 用户的偏好包括:国家 [${prefs.countries.join(", ")}]、品种 [${prefs.instruments.join(", ")}]、重要性 [${importanceText}]
- 数据公布时间以官方机构/财经网站为准
- 情绪标注仅为非专业用户的参考,不构成交易建议`
    : `## 📅 Economic Calendar (${startStr} to ${endStr})

Group by weekday, each day a subheading (e.g. \`### Monday (YYYY-MM-DD)\`). One Markdown table per day (skip the day if no events, write "No important data"):

| Time (UTC) | Country | Event | Importance | Previous | Forecast | Actual | Affected | Sentiment |
|---|---|---|---|---|---|---|---|---|
| 12:30 | 🇺🇸 US | CPI YoY | ⭐⭐⭐ | 3.2% | 3.1% | — | EURUSD, XAUUSD | (Pending) |

${bankHolidaysSection}

${sentimentSection}

## 🔗 Real-time sources (for verification)
Your training data may be stale; rely on these authoritative sites:
- Investing.com: https://www.investing.com/economic-calendar/
- TradingEconomics: https://tradingeconomics.com/calendar
- Forex Factory: https://www.forexfactory.com/calendar
- Central bank websites

## ⚠️ Disclaimer
- Your training data likely cuts off in 2025, **event times cannot be guaranteed in real time**
- User preferences: countries [${prefs.countries.join(", ")}], instruments [${prefs.instruments.join(", ")}], importance [${importanceText}]
- Always verify timing on official sources`;

  return `${intro}

${referenceTable}

${output}`;
}

// 发送经济日历汇总请求
export async function sendCalendarSummary(
  config: AiConfig,
  prefs: CalendarPreferences,
  language: "zh" | "en" = "zh",
  sopRules: SopRule[] = []
): Promise<string> {
  const userPrompt = buildCalendarPrompt(prefs, language);
  const systemPrompt = buildChatSystemPrompt(sopRules);
  return callAiApi(
    config,
    [{ role: "user", content: userPrompt }],
    systemPrompt
  );
}
