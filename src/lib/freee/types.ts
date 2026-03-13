// ==========================================
// freee API 型定義
// ==========================================

export interface FreeeToken {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
  company_id: number;
}

// --- 試算表 ---
export interface TrialBalanceItem {
  account_item_id: number;
  account_item_name: string;
  account_category: string;
  opening_balance: number;
  debit_amount: number;
  credit_amount: number;
  closing_balance: number;
}

export interface TrialBalance {
  company_id: number;
  fiscal_year: number;
  start_month: number;
  end_month: number;
  items: TrialBalanceItem[];
}

// --- 仕訳 ---
export interface JournalLine {
  id: number;
  account_item_id: number;
  account_item_name: string;
  tax_code: number;
  tax_name: string;
  amount: number;
  vat: number;
  description: string;
}

export interface Journal {
  id: number;
  issue_date: string;
  type: string;
  company_id: number;
  details: JournalLine[];
}

// --- 取引 ---
export interface Deal {
  id: number;
  company_id: number;
  issue_date: string;
  type: "income" | "expense";
  due_date?: string;
  amount: number;
  due_amount: number;
  status: string;
  partner_name?: string;
  details: DealDetail[];
}

export interface DealDetail {
  id: number;
  account_item_id: number;
  account_item_name: string;
  tax_code: number;
  amount: number;
  description: string;
}

export interface CreateDealRequest {
  company_id: number;
  issue_date: string;
  type: "income" | "expense";
  due_date?: string;
  partner_id?: number;
  details: {
    tax_code: number;
    account_item_id: number;
    amount: number;
    description?: string;
  }[];
}

// --- 請求書 ---
export interface Invoice {
  id: number;
  company_id: number;
  issue_date: string;
  due_date: string;
  invoice_number: string;
  title?: string;
  partner_id?: number;
  partner_name?: string;
  invoice_status: "draft" | "applying" | "remanded" | "rejected" | "approved" | "issued";
  payment_status: "unsettled" | "settled";
  total_amount: number;
  invoice_lines: InvoiceLine[];
}

export interface InvoiceLine {
  id: number;
  name: string;
  unit_price: number;
  quantity: number;
  amount: number;
  vat: number;
  description?: string;
  account_item_id?: number;
  tax_code: number;
}

export interface CreateInvoiceRequest {
  company_id: number;
  issue_date: string;
  due_date: string;
  partner_id?: number;
  title?: string;
  description?: string;
  invoice_lines: {
    name: string;
    unit_price: number;
    quantity: number;
    description?: string;
    account_item_id?: number;
    tax_code: number;
  }[];
}

// --- 勘定科目 ---
export interface AccountItem {
  id: number;
  name: string;
  shortcut1?: string;
  shortcut2?: string;
  account_category: string;
  default_tax_code: number;
  company_id: number;
}

// --- 取引先 ---
export interface Partner {
  id: number;
  name: string;
  shortcut1?: string;
  company_id: number;
  email?: string;
}

// --- キャッシュフロー ---
export interface CashFlowItem {
  month: string;
  operating: number;
  investing: number;
  financing: number;
  net: number;
  cumulative: number;
}
