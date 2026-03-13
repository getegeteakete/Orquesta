import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FreeeClient } from "@/lib/freee/client";
import { ToolExecutor } from "@/lib/claude/executor";
import { FREEE_TOOLS } from "@/lib/claude/tools";
import { FreeeToken } from "@/lib/freee/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ==========================================
// システムプロンプト（AI CFOペルソナ）
// ==========================================
const SYSTEM_PROMPT = `あなたは「AI CFO（最高財務責任者）」です。
freee会計と連携し、経営者・経理担当者の質問に日本語で答えます。

## あなたの役割
1. **財務分析・可視化**: 損益・BS・キャッシュフローを分析し、グラフ付きで説明
2. **自動記帳**: 自然言語の指示から仕訳・取引を正確に登録
3. **書類作成**: 請求書・見積書を作成して下書き保存
4. **異常検知**: 二重計上・外れ値・税区分ミスを検出

## 応答スタイル
- 数値は必ず「¥X,XXX,XXX」形式でカンマ区切り
- 重要な数値は **太字** で強調
- 仕訳登録・請求書作成などの書き込み操作は、実行前に「以下の内容で登録します。よろしいですか？」と確認
- グラフを生成した場合は数値の解説も加える
- エラー時はわかりやすく原因と対処法を説明

## 注意事項
- 書き込み操作（仕訳登録・請求書作成）は確認なしに実行しない
- 税務・法律の最終判断は専門家に確認するよう案内する
- 不明な勘定科目名が出た場合は候補を提示する

今日の日付: ${new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}`;

// ==========================================
// チャット API エンドポイント
// ==========================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, token } = body as {
      messages: Anthropic.MessageParam[];
      token: FreeeToken;
    };

    if (!token?.access_token) {
      return NextResponse.json({ error: "freee認証が必要です" }, { status: 401 });
    }

    // freeeクライアント・ツール実行エンジン初期化
    const freeeClient = new FreeeClient(token);
    const executor = new ToolExecutor(freeeClient);

    // 書き込み操作確認フラグ（フロント側で管理）
    const requiresConfirmation = body.requiresConfirmation ?? true;

    // ==========================================
    // Agentic Loop: Claude ↔ freee API
    // ==========================================
    const responseMessages: any[] = [];
    let currentMessages = [...messages];
    let iterationCount = 0;
    const MAX_ITERATIONS = 10;

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: FREEE_TOOLS,
        messages: currentMessages,
      });

      // ツール使用なし → 最終回答
      if (response.stop_reason === "end_turn") {
        const textContent = response.content
          .filter((c) => c.type === "text")
          .map((c) => (c as Anthropic.TextBlock).text)
          .join("");

        responseMessages.push({ role: "assistant", content: textContent });
        break;
      }

      // ツール使用あり → 実行
      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
        );

        // 書き込み操作チェック
        const WRITE_OPERATIONS = ["create_expense_journal", "register_invoice_as_payable", "create_invoice_draft"];
        const writeOps = toolUseBlocks.filter((t) => WRITE_OPERATIONS.includes(t.name));

        if (requiresConfirmation && writeOps.length > 0 && !body.confirmed) {
          // 確認が必要な操作の場合、フロントに確認を求める
          return NextResponse.json({
            type: "confirmation_required",
            operations: writeOps.map((op) => ({
              tool: op.name,
              input: op.input,
              label: getOperationLabel(op.name, op.input),
            })),
            pendingMessages: currentMessages,
            pendingResponse: response.content,
          });
        }

        // ツール実行
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        const charts: any[] = [];

        for (const toolUse of toolUseBlocks) {
          console.log(`[Chat API] Executing tool: ${toolUse.name}`, toolUse.input);
          const result = await executor.execute(toolUse.name, toolUse.input);

          if (result.chart) charts.push(result.chart);

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        }

        // メッセージ更新
        currentMessages = [
          ...currentMessages,
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults },
        ];

        // チャートデータを追記してストリーム
        if (charts.length > 0) {
          responseMessages.push({ type: "charts", charts });
        }

        continue;
      }

      break;
    }

    // 最終テキスト抽出
    const finalText = responseMessages
      .filter((m) => m.role === "assistant")
      .map((m) => m.content)
      .join("\n");

    const allCharts = responseMessages
      .filter((m) => m.type === "charts")
      .flatMap((m) => m.charts);

    return NextResponse.json({
      type: "response",
      message: finalText,
      charts: allCharts,
    });
  } catch (err: any) {
    console.error("[Chat API Error]", err);
    return NextResponse.json(
      { error: err.message || "内部エラーが発生しました" },
      { status: 500 }
    );
  }
}

// 書き込み操作の説明文生成
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
