import Anthropic from "@anthropic-ai/sdk";

// ==========================================
// Claude Tool定義（全4機能対応）
// ==========================================

export const FREEE_TOOLS: Anthropic.Tool[] = [
  // ==========================================
  // 【機能1】財務分析・グラフ可視化
  // ==========================================
  {
    name: "get_profit_loss",
    description:
      "損益計算書（PL）を取得します。売上・費用・利益の分析に使用します。月次比較、科目別分析、前年比較などに対応。",
    input_schema: {
      type: "object",
      properties: {
        fiscal_year: { type: "number", description: "会計年度（例: 2024）" },
        start_month: { type: "number", description: "開始月（1-12）" },
        end_month: { type: "number", description: "終了月（1-12）" },
      },
      required: ["fiscal_year", "start_month", "end_month"],
    },
  },
  {
    name: "get_balance_sheet",
    description:
      "貸借対照表（BS）を取得します。資産・負債・純資産の状況確認に使用します。",
    input_schema: {
      type: "object",
      properties: {
        fiscal_year: { type: "number", description: "会計年度" },
        month: { type: "number", description: "対象月（1-12）" },
      },
      required: ["fiscal_year", "month"],
    },
  },
  {
    name: "get_monthly_trend",
    description:
      "月次推移データを取得します。売上・経費・利益の月次グラフ作成、特定勘定科目の推移分析（例: 広告宣伝費の推移）に使用します。",
    input_schema: {
      type: "object",
      properties: {
        fiscal_year: { type: "number", description: "会計年度" },
        account_item_names: {
          type: "array",
          items: { type: "string" },
          description: "対象勘定科目名のリスト（例: ['売上高', '広告宣伝費']）。空の場合は全科目",
        },
      },
      required: ["fiscal_year"],
    },
  },
  {
    name: "simulate_cash_flow",
    description:
      "キャッシュフローシミュレーションを実行します。現在の収支トレンドから資金ショートまでの期間を予測します。",
    input_schema: {
      type: "object",
      properties: {
        months_to_simulate: { type: "number", description: "シミュレーション期間（月数）。デフォルト12" },
        monthly_fixed_expenses: { type: "number", description: "月次固定費の上書き値（省略時は過去3ヶ月平均を使用）" },
        monthly_revenue_growth_rate: { type: "number", description: "月次売上成長率（例: 0.05 = 5%成長）" },
      },
      required: [],
    },
  },
  {
    name: "get_expense_breakdown",
    description:
      "販管費の内訳分析を取得します。役員報酬除外、部門別など条件付き集計が可能です。",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "開始日（YYYY-MM-DD）" },
        end_date: { type: "string", description: "終了日（YYYY-MM-DD）" },
        exclude_account_items: {
          type: "array",
          items: { type: "string" },
          description: "除外する勘定科目名のリスト（例: ['役員報酬']）",
        },
        compare_previous_month: { type: "boolean", description: "前月比較データを含めるか" },
      },
      required: ["start_date", "end_date"],
    },
  },

  // ==========================================
  // 【機能2】仕訳・データ自動入力
  // ==========================================
  {
    name: "create_expense_journal",
    description:
      "経費の仕訳登録を行います。領収書画像やPDF請求書の内容を元に仕訳を作成します。",
    input_schema: {
      type: "object",
      properties: {
        issue_date: { type: "string", description: "発生日（YYYY-MM-DD）" },
        amount: { type: "number", description: "金額（税込）" },
        account_item_name: { type: "string", description: "勘定科目名（例: '旅費交通費', '消耗品費'）" },
        tax_code: {
          type: "number",
          description: "税区分コード（1=課税仕入10%, 2=課税仕入8%, 3=非課税, 4=不課税）",
        },
        description: { type: "string", description: "摘要（例: 'タクシー代 XX→YY'）" },
        partner_name: { type: "string", description: "取引先名（任意）" },
        is_reimbursement: { type: "boolean", description: "立替経費の場合はtrue" },
        reimbursement_person: { type: "string", description: "立替者名（例: '代表取締役 山田太郎'）" },
      },
      required: ["issue_date", "amount", "account_item_name", "tax_code", "description"],
    },
  },
  {
    name: "register_invoice_as_payable",
    description:
      "PDF請求書の内容を読み取り、買掛金として登録します。支払期日を設定して未払費用として管理します。",
    input_schema: {
      type: "object",
      properties: {
        issue_date: { type: "string", description: "請求書発行日（YYYY-MM-DD）" },
        due_date: { type: "string", description: "支払期日（YYYY-MM-DD）" },
        amount: { type: "number", description: "請求金額（税込）" },
        partner_name: { type: "string", description: "仕入先・取引先名" },
        account_item_name: { type: "string", description: "費用科目名" },
        description: { type: "string", description: "摘要" },
        tax_code: { type: "number", description: "税区分コード" },
      },
      required: ["issue_date", "due_date", "amount", "partner_name", "account_item_name"],
    },
  },
  {
    name: "get_account_items",
    description: "勘定科目一覧を取得します。仕訳登録前に適切な科目IDを確認するために使用します。",
    input_schema: {
      type: "object",
      properties: {
        account_category: {
          type: "string",
          description: "科目区分フィルター（例: 'expense', 'income', 'asset', 'liability'）",
        },
      },
      required: [],
    },
  },

  // ==========================================
  // 【機能3】請求書・見積書作成
  // ==========================================
  {
    name: "create_invoice_draft",
    description:
      "請求書の下書きを作成します。取引先名・金額・品目を指定して下書き保存します。",
    input_schema: {
      type: "object",
      properties: {
        partner_name: { type: "string", description: "請求先会社名" },
        issue_date: { type: "string", description: "発行日（YYYY-MM-DD）" },
        due_date: { type: "string", description: "支払期日（YYYY-MM-DD）" },
        title: { type: "string", description: "件名（例: '2024年10月分コンサルティング費用'）" },
        invoice_lines: {
          type: "array",
          description: "請求明細",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "品目名" },
              unit_price: { type: "number", description: "単価（税抜）" },
              quantity: { type: "number", description: "数量" },
              tax_code: { type: "number", description: "税区分（17=課税売上10%）" },
              description: { type: "string", description: "備考" },
            },
            required: ["name", "unit_price", "quantity", "tax_code"],
          },
        },
        description: { type: "string", description: "備考欄" },
      },
      required: ["partner_name", "issue_date", "due_date", "invoice_lines"],
    },
  },
  {
    name: "get_renewal_clients",
    description:
      "更新月が指定月に該当するクライアント一覧を取得します。過去の請求書データから更新月を推定します。",
    input_schema: {
      type: "object",
      properties: {
        target_month: { type: "string", description: "更新対象月（YYYY-MM）" },
        service_name_pattern: {
          type: "string",
          description: "サービス名のキーワード（例: '保守', 'コンサルティング'）",
        },
      },
      required: ["target_month"],
    },
  },
  {
    name: "get_partners",
    description: "取引先一覧を取得します。請求書作成時の取引先IDを確認するために使用します。",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "取引先名（部分一致）" },
      },
      required: [],
    },
  },

  // ==========================================
  // 【機能4】異常検知・監査
  // ==========================================
  {
    name: "detect_anomalies",
    description:
      "仕訳データの異常を検知します。二重計上の疑い、過去トレンドからの外れ値、消費税区分の誤りなどを検出します。",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "検査開始日（YYYY-MM-DD）" },
        end_date: { type: "string", description: "検査終了日（YYYY-MM-DD）" },
        check_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["duplicate_entries", "statistical_outliers", "tax_code_errors", "rounding_errors", "unusual_accounts"],
          },
          description: "チェック種別（省略時は全チェック）",
        },
        threshold_multiplier: {
          type: "number",
          description: "外れ値判定の閾値倍率（デフォルト3.0 = 平均±3σ）",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "check_tax_codes",
    description:
      "消費税区分（10%・8%・対象外）の設定を勘定科目ごとにチェックし、誤りの可能性がある仕訳を抽出します。",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "対象期間の開始日（YYYY-MM-DD）" },
        end_date: { type: "string", description: "対象期間の終了日（YYYY-MM-DD）" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_deals_for_audit",
    description:
      "監査・レビュー用に取引データを取得します。金額の大きい取引や特定科目の取引を抽出できます。",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "開始日（YYYY-MM-DD）" },
        end_date: { type: "string", description: "終了日（YYYY-MM-DD）" },
        min_amount: { type: "number", description: "最小金額フィルター" },
        account_item_names: {
          type: "array",
          items: { type: "string" },
          description: "対象勘定科目名リスト",
        },
        limit: { type: "number", description: "取得件数（デフォルト100）" },
      },
      required: ["start_date", "end_date"],
    },
  },
];

// ==========================================
// ツール実行結果の型
// ==========================================
export interface ChartData {
  type: "bar" | "line" | "pie" | "area";
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
  unit?: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  chart?: ChartData;
  error?: string;
  message?: string;
}
