import axios, { AxiosInstance } from "axios";
import {
  FreeeToken,
  TrialBalance,
  Journal,
  Deal,
  CreateDealRequest,
  Invoice,
  CreateInvoiceRequest,
  AccountItem,
  Partner,
} from "./types";

const FREEE_API_BASE = "https://api.freee.co.jp";
const FREEE_AUTH_BASE = "https://accounts.secure.freee.co.jp";

// ==========================================
// freee APIクライアント
// ==========================================
export class FreeeClient {
  private http: AxiosInstance;
  private token: FreeeToken;

  constructor(token: FreeeToken) {
    this.token = token;
    this.http = axios.create({
      baseURL: FREEE_API_BASE,
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
    });

    // レスポンスインターセプター：401時にトークンリフレッシュ
    this.http.interceptors.response.use(
      (res) => res,
      async (err) => {
        if (err.response?.status === 401) {
          await this.refreshToken();
          err.config.headers["Authorization"] = `Bearer ${this.token.access_token}`;
          return this.http.request(err.config);
        }
        throw err;
      }
    );
  }

  // --- OAuth2 トークンリフレッシュ ---
  private async refreshToken() {
    const res = await axios.post(`${FREEE_AUTH_BASE}/oauth/token`, {
      grant_type: "refresh_token",
      client_id: process.env.FREEE_CLIENT_ID,
      client_secret: process.env.FREEE_CLIENT_SECRET,
      refresh_token: this.token.refresh_token,
    });
    this.token = {
      ...this.token,
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
      expires_at: Date.now() + res.data.expires_in * 1000,
    };
    // NOTE: 本番ではDBやRedisにトークンを保存する
  }

  getToken(): FreeeToken {
    return this.token;
  }

  // ==========================================
  // 1. 財務分析系 API
  // ==========================================

  /** 試算表取得 */
  async getTrialBalance(params: {
    fiscal_year: number;
    start_month: number;
    end_month: number;
    account_item_display_type?: "account_item" | "group";
  }): Promise<TrialBalance> {
    const res = await this.http.get(
      `/api/1/reports/trial_bs_two_years?company_id=${this.token.company_id}`,
      { params: { ...params, company_id: this.token.company_id } }
    );
    return res.data;
  }

  /** 損益計算書（月次）取得 */
  async getProfitLoss(params: {
    fiscal_year: number;
    start_month: number;
    end_month: number;
  }): Promise<TrialBalance> {
    const res = await this.http.get(`/api/1/reports/trial_pl_sections`, {
      params: { ...params, company_id: this.token.company_id },
    });
    return res.data;
  }

  /** 月次推移表取得（グラフ用） */
  async getMonthlyPL(fiscal_year: number): Promise<any> {
    const res = await this.http.get(`/api/1/reports/trial_pl_three_years`, {
      params: { company_id: this.token.company_id, fiscal_year },
    });
    return res.data;
  }

  // ==========================================
  // 2. 仕訳・データ入力系 API
  // ==========================================

  /** 仕訳帳取得 */
  async getJournals(params: {
    start_date?: string;
    end_date?: string;
    account_item_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ journals: Journal[]; meta: { total_count: number } }> {
    const res = await this.http.get(`/api/1/journals`, {
      params: { ...params, company_id: this.token.company_id },
    });
    return res.data;
  }

  /** 取引一覧取得 */
  async getDeals(params: {
    type?: "income" | "expense";
    partner_id?: number;
    account_item_id?: number;
    start_issue_date?: string;
    end_issue_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ deals: Deal[]; meta: { total_count: number } }> {
    const res = await this.http.get(`/api/1/deals`, {
      params: { ...params, company_id: this.token.company_id },
    });
    return res.data;
  }

  /** 取引登録（仕訳作成） */
  async createDeal(deal: Omit<CreateDealRequest, "company_id">): Promise<Deal> {
    const res = await this.http.post(`/api/1/deals`, {
      ...deal,
      company_id: this.token.company_id,
    });
    return res.data.deal;
  }

  /** 取引更新 */
  async updateDeal(id: number, deal: Partial<CreateDealRequest>): Promise<Deal> {
    const res = await this.http.put(`/api/1/deals/${id}`, {
      ...deal,
      company_id: this.token.company_id,
    });
    return res.data.deal;
  }

  // ==========================================
  // 3. 請求書・見積書系 API
  // ==========================================

  /** 請求書一覧取得 */
  async getInvoices(params: {
    partner_id?: number;
    partner_code?: string;
    start_issue_date?: string;
    end_issue_date?: string;
    invoice_status?: string;
    limit?: number;
  }): Promise<{ invoices: Invoice[] }> {
    const res = await this.http.get(`/api/1/invoices`, {
      params: { ...params, company_id: this.token.company_id },
    });
    return res.data;
  }

  /** 請求書作成 */
  async createInvoice(invoice: Omit<CreateInvoiceRequest, "company_id">): Promise<Invoice> {
    const res = await this.http.post(`/api/1/invoices`, {
      ...invoice,
      company_id: this.token.company_id,
    });
    return res.data.invoice;
  }

  /** 請求書更新 */
  async updateInvoice(id: number, invoice: Partial<CreateInvoiceRequest>): Promise<Invoice> {
    const res = await this.http.put(`/api/1/invoices/${id}`, {
      ...invoice,
      company_id: this.token.company_id,
    });
    return res.data.invoice;
  }

  // ==========================================
  // 4. マスターデータ系 API
  // ==========================================

  /** 勘定科目一覧 */
  async getAccountItems(): Promise<{ account_items: AccountItem[] }> {
    const res = await this.http.get(`/api/1/account_items`, {
      params: { company_id: this.token.company_id },
    });
    return res.data;
  }

  /** 取引先一覧 */
  async getPartners(params?: { name?: string; shortcut1?: string }): Promise<{ partners: Partner[] }> {
    const res = await this.http.get(`/api/1/partners`, {
      params: { ...params, company_id: this.token.company_id },
    });
    return res.data;
  }

  /** 税区分一覧 */
  async getTaxCodes(): Promise<{ taxes: { code: number; name: string; rate_type: string }[] }> {
    const res = await this.http.get(`/api/1/taxes/companies/${this.token.company_id}`);
    return res.data;
  }

  /** 事業所情報取得 */
  async getCompany(): Promise<any> {
    const res = await this.http.get(`/api/1/companies/${this.token.company_id}`);
    return res.data.company;
  }

  /** 会計期間情報取得 */
  async getFiscalYears(): Promise<any> {
    const res = await this.http.get(`/api/1/companies/${this.token.company_id}/fiscal_years`);
    return res.data;
  }
}

// ==========================================
// OAuth2 認証 URL 生成
// ==========================================
export function getOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FREEE_CLIENT_ID!,
    redirect_uri: process.env.FREEE_REDIRECT_URI!,
    response_type: "code",
    scope: "read write",
    state,
  });
  return `${FREEE_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

// ==========================================
// 認証コードからトークン取得
// ==========================================
export async function exchangeCodeForToken(code: string, company_id: number): Promise<FreeeToken> {
  const res = await axios.post(`${FREEE_AUTH_BASE}/oauth/token`, {
    grant_type: "authorization_code",
    client_id: process.env.FREEE_CLIENT_ID,
    client_secret: process.env.FREEE_CLIENT_SECRET,
    code,
    redirect_uri: process.env.FREEE_REDIRECT_URI,
  });

  return {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_at: Date.now() + res.data.expires_in * 1000,
    company_id,
  };
}
