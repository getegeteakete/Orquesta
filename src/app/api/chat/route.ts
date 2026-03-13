import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FreeeClient } from "@/lib/freee/client";
import { ToolExecutor } from "@/lib/claude/executor";
import { FREEE_TOOLS } from "@/lib/claude/tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `あなたは「AI CFO（最高財務責任者）」です。
freee会計と連携し、経営者・経理担当者の質問に日本語で答えます。

## 役割
1. 財務分析・可視化: 損益・BS・キャッシュフローをグラフ付きで分析
2. 自動記帳: 自然言語の指示から仕訳・取引を正確に登録  
3. 書類作成: 請求書・見積書を作成して下書き保存
4. 異常検知: 二重計上・外れ値・消費税区分ミスを検出

## スタイル
- 数値は ¥X,XXX,XXX 形式
- 書き込み操作の前は必ず内容を確認する
- 税務・法律の最終判断は専門家に確認するよう案内する

今日の日付: ${new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}`;

const WRITE_OPERATIONS = ["create_expense_journal", "register_invoice_as_payable", "create_invoice_draft"];

export async function POST(req: NextRequest) {
  try {
    // トークンはCookieからのみ取得（フロントエンドに渡さない）
    const tokenCookie = req.cookies.get("freee_token")?.value;
    if (!tokenCookie) {
      return NextResponse.json({ error: "freee認証が必要です" }, { status: 401 });
    }
    const token = JSON.parse(tokenCookie);

    const { messages, confirmed } = await req.json();
    const freeeClient = new FreeeClient(token);
    const executor = new ToolExecutor(freeeClient);

    let currentMessages = [...messages];
    const allCharts: any[] = [];
    let finalText = "";

    for (let i = 0; i < 10; i++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: FREEE_TOOLS,
        messages: currentMessages,
      });

      if (response.stop_reason === "end_turn") {
        finalText = response.content
          .filter((c): c is Anthropic.TextBlock => c.type === "text")
          .map((c) => c.text).join("");
        break;
      }

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
        );

        // 書き込み操作は確認が必要
        const writeOps = toolUseBlocks.filter((t) => WRITE_OPERATIONS.includes(t.name));
        if (writeOps.length > 0 && !confirmed) {
          return NextResponse.json({
            type: "confirmation_required",
            operations: writeOps.map((op) => ({
              tool: op.name,
              input: op.input,
              label: getOperationLabel(op.name, op.input),
            })),
          });
        }

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
          const result = await executor.execute(toolUse.name, toolUse.input);
          if (result.chart) allCharts.push(result.chart);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        }

        currentMessages = [
          ...currentMessages,
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults },
        ];
      }
    }

    return NextResponse.json({ type: "response", message: finalText, charts: allCharts });
  } catch (err: any) {
    console.error("[Chat API Error]", err);
    return NextResponse.json({ error: err.message || "内部エラー" }, { status: 500 });
  }
}

function getOperationLabel(toolName: string, input: any): string {
  switch (toolName) {
    case "create_expense_journal":
      return `経費仕訳登録: ${input.account_item_name} ¥${input.amount?.toLocaleString()} (${input.issue_date})`;
    case "register_invoice_as_payable":
      return `買掛金登録: ${input.partner_name} ¥${input.amount?.toLocaleString()} (支払期日: ${input.due_date})`;
    case "create_invoice_draft":
      return `請求書作成: ${input.partner_name}宛 (${input.issue_date})`;
    default:
      return toolName;
  }
}
