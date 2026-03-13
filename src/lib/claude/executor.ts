import { FreeeClient } from "../freee/client";
import { ToolResult, ChartData } from "./tools";

// ==========================================
// ツール実行エンジン
// ツール名 → freee APIコール → 結果整形
// ==========================================
export class ToolExecutor {
  private freee: FreeeClient;

  constructor(freee: FreeeClient) {
    this.freee = freee;
  }

  async execute(toolName: string, input: any): Promise<ToolResult> {
    try {
      switch (toolName) {
        case "get_profit_loss":
          return await this.getProfitLoss(input);
        case "get_balance_sheet":
          return await this.getBalanceSheet(input);
        case "get_monthly_trend":
          return await this.getMonthlyTrend(input);
        case "simulate_cash_flow":
          return await this.simulateCashFlow(input);
        case "get_expense_breakdown":
          return await this.getExpenseBreakdown(input);
        case "create_expense_journal":
          return await this.createExpenseJournal(input);
        case "register_invoice_as_payable":
          return await this.registerInvoiceAsPayable(input);
        case "get_account_items":
          return await this.getAccountItems(input);
        case "create_invoice_draft":
          return await this.createInvoiceDraft(input);
        case "get_renewal_clients":
          return await this.getRenewalClients(input);
        case "get_partners":
          return await this.getPartners(input);
        case "detect_anomalies":
          return await this.detectAnomalies(input);
        case "check_tax_codes":
          return await this.checkTaxCodes(input);
        case "get_deals_for_audit":
          return await this.getDealsForAudit(input);
        default:
          return { success: false, error: `不明なツール: ${toolName}` };
      }
    } catch (err: any) {
      console.error(`[ToolExecutor] ${toolName} failed:`, err.message);
      return {
        success: false,
        error: `freee APIエラー: ${err.response?.data?.message || err.message}`,
      };
    }
  }

  // ==========================================
  // 財務分析系
  // ==========================================

  private async getProfitLoss(input: any): Promise<ToolResult> {
    const data = await this.freee.getProfitLoss({
      fiscal_year: input.fiscal_year,
      start_month: input.start_month,
      end_month: input.end_month,
    });

    // グラフデータ生成
    const items = data.items || [];
    const salesItems = items.filter((i: any) => i.account_category === "revenue");
    const expenseItems = items.filter((i: any) => i.account_category === "expense");

    const totalSales = salesItems.reduce((sum: number, i: any) => sum + (i.closing_balance || 0), 0);
    const totalExpenses = expenseItems.reduce((sum: number, i: any) => sum + (i.closing_balance || 0), 0);
    const profit = totalSales - totalExpenses;

    const chart: ChartData = {
      type: "bar",
      title: `損益計算書（${input.fiscal_year}年 ${input.start_month}月〜${input.end_month}月）`,
      labels: ["売上高", "費用合計", "営業利益"],
      datasets: [
        {
          label: "金額（円）",
          data: [totalSales, totalExpenses, profit],
          color: profit >= 0 ? "#10b981" : "#ef4444",
        },
      ],
      unit: "円",
    };

    return { success: true, data: { items, totalSales, totalExpenses, profit }, chart };
  }

  private async getBalanceSheet(input: any): Promise<ToolResult> {
    const data = await this.freee.getTrialBalance({
      fiscal_year: input.fiscal_year,
      start_month: 1,
      end_month: input.month,
    });
    return { success: true, data };
  }

  private async getMonthlyTrend(input: any): Promise<ToolResult> {
    const data = await this.freee.getMonthlyPL(input.fiscal_year);
    const months = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"];

    // 指定科目のデータを抽出
    const targetNames: string[] = input.account_item_names || [];
    const items = (data.items || []).filter(
      (item: any) => targetNames.length === 0 || targetNames.includes(item.account_item_name)
    );

    const datasets = items.slice(0, 5).map((item: any) => ({
      label: item.account_item_name,
      data: (item.monthly_amounts || []).slice(0, 12),
    }));

    const chart: ChartData = {
      type: "line",
      title: `月次推移（${input.fiscal_year}年度）`,
      labels: months,
      datasets,
      unit: "円",
    };

    return { success: true, data: items, chart };
  }

  private async simulateCashFlow(input: any): Promise<ToolResult> {
    // 直近3ヶ月の実績データを取得
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);

    const [incomeDeals, expenseDeals] = await Promise.all([
      this.freee.getDeals({
        type: "income",
        start_issue_date: threeMonthsAgo.toISOString().split("T")[0],
        end_issue_date: today.toISOString().split("T")[0],
        limit: 100,
      }),
      this.freee.getDeals({
        type: "expense",
        start_issue_date: threeMonthsAgo.toISOString().split("T")[0],
        end_issue_date: today.toISOString().split("T")[0],
        limit: 100,
      }),
    ]);

    const avgMonthlyIncome =
      incomeDeals.deals.reduce((s, d) => s + d.amount, 0) / 3;
    const avgMonthlyExpense =
      input.monthly_fixed_expenses ||
      expenseDeals.deals.reduce((s, d) => s + d.amount, 0) / 3;
    const monthlyNet = avgMonthlyIncome - avgMonthlyExpense;

    // 現在の現金残高（BS上の現金）
    const company = await this.freee.getCompany();
    const currentCash = company?.current_term_netting?.cash || 0;

    const monthsToSimulate = input.months_to_simulate || 12;
    const growthRate = input.monthly_revenue_growth_rate || 0;

    const labels: string[] = [];
    const cashBalances: number[] = [];
    let balance = currentCash;

    for (let m = 0; m < monthsToSimulate; m++) {
      const date = new Date(today);
      date.setMonth(today.getMonth() + m);
      labels.push(`${date.getMonth() + 1}月`);

      const revenue = avgMonthlyIncome * Math.pow(1 + growthRate, m);
      balance += revenue - avgMonthlyExpense;
      cashBalances.push(Math.round(balance));
    }

    const shortfallMonth = cashBalances.findIndex((b) => b < 0);

    const chart: ChartData = {
      type: "area",
      title: "キャッシュフローシミュレーション",
      labels,
      datasets: [{ label: "現金残高", data: cashBalances, color: "#3b82f6" }],
      unit: "円",
    };

    return {
      success: true,
      data: {
        currentCash,
        avgMonthlyIncome: Math.round(avgMonthlyIncome),
        avgMonthlyExpense: Math.round(avgMonthlyExpense),
        monthlyNet: Math.round(monthlyNet),
        shortfallMonth: shortfallMonth >= 0 ? shortfallMonth + 1 : null,
        cashBalances,
      },
      chart,
    };
  }

  private async getExpenseBreakdown(input: any): Promise<ToolResult> {
    const deals = await this.freee.getDeals({
      type: "expense",
      start_issue_date: input.start_date,
      end_issue_date: input.end_date,
      limit: 200,
    });

    const excludeItems: string[] = input.exclude_account_items || [];

    // 勘定科目別集計
    const breakdown: Record<string, number> = {};
    for (const deal of deals.deals) {
      for (const detail of deal.details) {
        if (!excludeItems.includes(detail.account_item_name)) {
          breakdown[detail.account_item_name] =
            (breakdown[detail.account_item_name] || 0) + detail.amount;
        }
      }
    }

    const sorted = Object.entries(breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15);

    let previousMonthData = null;
    if (input.compare_previous_month) {
      const start = new Date(input.start_date);
      const prevStart = new Date(start);
      prevStart.setMonth(prevStart.getMonth() - 1);
      const prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);

      const prevDeals = await this.freee.getDeals({
        type: "expense",
        start_issue_date: prevStart.toISOString().split("T")[0],
        end_issue_date: prevEnd.toISOString().split("T")[0],
        limit: 200,
      });

      const prevBreakdown: Record<string, number> = {};
      for (const deal of prevDeals.deals) {
        for (const detail of deal.details) {
          if (!excludeItems.includes(detail.account_item_name)) {
            prevBreakdown[detail.account_item_name] =
              (prevBreakdown[detail.account_item_name] || 0) + detail.amount;
          }
        }
      }
      previousMonthData = prevBreakdown;
    }

    const labels = sorted.map(([name]) => name);
    const currentData = sorted.map(([, amount]) => amount);

    const datasets = [{ label: "今月", data: currentData, color: "#6366f1" }];
    if (previousMonthData) {
      datasets.push({
        label: "先月",
        data: labels.map((l) => previousMonthData![l] || 0),
        color: "#94a3b8",
      });
    }

    const chart: ChartData = {
      type: "bar",
      title: `販管費内訳${excludeItems.length > 0 ? `（${excludeItems.join("・")}除く）` : ""}`,
      labels,
      datasets,
      unit: "円",
    };

    const total = currentData.reduce((s, v) => s + v, 0);
    return { success: true, data: { breakdown: sorted, total, excludedItems: excludeItems }, chart };
  }

  // ==========================================
  // 仕訳・データ入力系
  // ==========================================

  private async createExpenseJournal(input: any): Promise<ToolResult> {
    const accountItems = await this.freee.getAccountItems();
    const accountItem = accountItems.account_items.find(
      (item) => item.name === input.account_item_name
    );

    if (!accountItem) {
      return { success: false, error: `勘定科目「${input.account_item_name}」が見つかりません` };
    }

    let partnerId: number | undefined;
    if (input.partner_name) {
      const partners = await this.freee.getPartners({ name: input.partner_name });
      partnerId = partners.partners[0]?.id;
    }

    const deal = await this.freee.createDeal({
      issue_date: input.issue_date,
      type: "expense",
      partner_id: partnerId,
      details: [
        {
          tax_code: input.tax_code,
          account_item_id: accountItem.id,
          amount: input.amount,
          description: input.is_reimbursement
            ? `【立替】${input.reimbursement_person || ""} ${input.description}`
            : input.description,
        },
      ],
    });

    return {
      success: true,
      data: deal,
      message: `✅ 仕訳を登録しました（取引ID: ${deal.id}）\n科目: ${input.account_item_name} / 金額: ¥${input.amount.toLocaleString()}`,
    };
  }

  private async registerInvoiceAsPayable(input: any): Promise<ToolResult> {
    const accountItems = await this.freee.getAccountItems();
    const accountItem = accountItems.account_items.find(
      (item) => item.name === input.account_item_name
    );

    if (!accountItem) {
      return { success: false, error: `勘定科目「${input.account_item_name}」が見つかりません` };
    }

    const partners = await this.freee.getPartners({ name: input.partner_name });
    const partnerId = partners.partners[0]?.id;

    const deal = await this.freee.createDeal({
      issue_date: input.issue_date,
      type: "expense",
      due_date: input.due_date,
      partner_id: partnerId,
      details: [
        {
          tax_code: input.tax_code || 1,
          account_item_id: accountItem.id,
          amount: input.amount,
          description: input.description || `${input.partner_name}からの請求書`,
        },
      ],
    });

    return {
      success: true,
      data: deal,
      message: `✅ 買掛金として登録しました\n取引先: ${input.partner_name} / 金額: ¥${input.amount.toLocaleString()} / 支払期日: ${input.due_date}`,
    };
  }

  private async getAccountItems(input: any): Promise<ToolResult> {
    const data = await this.freee.getAccountItems();
    let items = data.account_items;
    if (input.account_category) {
      items = items.filter((i) => i.account_category === input.account_category);
    }
    return { success: true, data: items };
  }

  // ==========================================
  // 請求書・見積書系
  // ==========================================

  private async createInvoiceDraft(input: any): Promise<ToolResult> {
    const partners = await this.freee.getPartners({ name: input.partner_name });
    const partner = partners.partners[0];

    const invoice = await this.freee.createInvoice({
      issue_date: input.issue_date,
      due_date: input.due_date,
      partner_id: partner?.id,
      title: input.title,
      description: input.description,
      invoice_lines: input.invoice_lines.map((line: any) => ({
        name: line.name,
        unit_price: line.unit_price,
        quantity: line.quantity,
        tax_code: line.tax_code,
        description: line.description,
      })),
    });

    const total = input.invoice_lines.reduce(
      (sum: number, l: any) => sum + l.unit_price * l.quantity * 1.1, 0
    );

    return {
      success: true,
      data: invoice,
      message: `✅ 請求書を下書き保存しました（ID: ${invoice.id}）\n宛先: ${input.partner_name} / 合計: ¥${Math.round(total).toLocaleString()}（税込）`,
    };
  }

  private async getRenewalClients(input: any): Promise<ToolResult> {
    const [year, month] = input.target_month.split("-").map(Number);
    const oneYearAgo = `${year - 1}-${String(month).padStart(2, "0")}-01`;
    const oneYearAgoEnd = `${year - 1}-${String(month).padStart(2, "0")}-28`;

    const invoices = await this.freee.getInvoices({
      start_issue_date: oneYearAgo,
      end_issue_date: oneYearAgoEnd,
      limit: 50,
    });

    const renewal = invoices.invoices.filter((inv) => {
      if (input.service_name_pattern) {
        return inv.title?.includes(input.service_name_pattern) ||
          inv.invoice_lines.some((l) => l.name.includes(input.service_name_pattern));
      }
      return true;
    });

    return {
      success: true,
      data: renewal.map((inv) => ({
        partner_name: inv.partner_name,
        last_invoice_date: inv.issue_date,
        amount: inv.total_amount,
        title: inv.title,
      })),
      message: `${input.target_month}の更新対象クライアント: ${renewal.length}件`,
    };
  }

  private async getPartners(input: any): Promise<ToolResult> {
    const data = await this.freee.getPartners(input.name ? { name: input.name } : undefined);
    return { success: true, data: data.partners };
  }

  // ==========================================
  // 異常検知・監査系
  // ==========================================

  private async detectAnomalies(input: any): Promise<ToolResult> {
    const deals = await this.freee.getDeals({
      start_issue_date: input.start_date,
      end_issue_date: input.end_date,
      limit: 200,
    });

    const checkTypes = input.check_types || [
      "duplicate_entries", "statistical_outliers", "tax_code_errors"
    ];
    const threshold = input.threshold_multiplier || 3.0;
    const anomalies: any[] = [];

    // 1. 二重計上チェック
    if (checkTypes.includes("duplicate_entries")) {
      const seen = new Map<string, any[]>();
      for (const deal of deals.deals) {
        const key = `${deal.issue_date}_${deal.amount}_${deal.partner_name || ""}`;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key)!.push(deal);
      }
      for (const [key, duplicates] of seen) {
        if (duplicates.length > 1) {
          anomalies.push({
            type: "duplicate_entry",
            severity: "high",
            description: `二重計上の疑い: ${duplicates[0].issue_date} / ¥${duplicates[0].amount.toLocaleString()}`,
            deals: duplicates.map((d) => ({ id: d.id, date: d.issue_date, amount: d.amount })),
          });
        }
      }
    }

    // 2. 統計的外れ値チェック
    if (checkTypes.includes("statistical_outliers")) {
      const byAccount: Record<string, number[]> = {};
      for (const deal of deals.deals) {
        for (const detail of deal.details) {
          if (!byAccount[detail.account_item_name]) byAccount[detail.account_item_name] = [];
          byAccount[detail.account_item_name].push(detail.amount);
        }
      }

      for (const [accountName, amounts] of Object.entries(byAccount)) {
        if (amounts.length < 3) continue;
        const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
        const std = Math.sqrt(amounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / amounts.length);
        const outliers = amounts.filter((v) => Math.abs(v - mean) > threshold * std);
        if (outliers.length > 0) {
          anomalies.push({
            type: "statistical_outlier",
            severity: "medium",
            description: `「${accountName}」に異常な金額: ¥${outliers[0].toLocaleString()}（平均 ¥${Math.round(mean).toLocaleString()}, σ=${Math.round(std).toLocaleString()}）`,
            account: accountName,
            outlier_amounts: outliers,
          });
        }
      }
    }

    return {
      success: true,
      data: {
        total_deals_checked: deals.deals.length,
        anomalies_found: anomalies.length,
        anomalies,
      },
      message: anomalies.length === 0
        ? "✅ 異常は検出されませんでした"
        : `⚠️ ${anomalies.length}件の異常を検出しました`,
    };
  }

  private async checkTaxCodes(input: any): Promise<ToolResult> {
    const deals = await this.freee.getDeals({
      start_issue_date: input.start_date,
      end_issue_date: input.end_date,
      limit: 200,
    });

    // 勘定科目ごとの標準税区分マスター（簡易版）
    const TAX_RULES: Record<string, number[]> = {
      "旅費交通費": [1],      // 課税仕入10%
      "通信費": [1],
      "消耗品費": [1],
      "役員報酬": [3],         // 非課税
      "給与手当": [3],
      "法定福利費": [3],
      "支払利息": [3],
      "租税公課": [3],
      "寄付金": [3],
      "飲食費": [1, 2],       // 10%または軽減8%
      "福利厚生費": [1, 2],
    };

    const issues: any[] = [];
    for (const deal of deals.deals) {
      for (const detail of deal.details) {
        const expected = TAX_RULES[detail.account_item_name];
        if (expected && !expected.includes(detail.tax_code)) {
          issues.push({
            deal_id: deal.id,
            date: deal.issue_date,
            account_item: detail.account_item_name,
            current_tax_code: detail.tax_code,
            expected_tax_codes: expected,
            amount: detail.amount,
          });
        }
      }
    }

    return {
      success: true,
      data: {
        total_checked: deals.deals.length,
        issues_found: issues.length,
        issues,
      },
      message: issues.length === 0
        ? "✅ 消費税区分の誤りは検出されませんでした"
        : `⚠️ ${issues.length}件の税区分誤りの可能性を検出しました`,
    };
  }

  private async getDealsForAudit(input: any): Promise<ToolResult> {
    const deals = await this.freee.getDeals({
      start_issue_date: input.start_date,
      end_issue_date: input.end_date,
      limit: input.limit || 100,
    });

    let filtered = deals.deals;
    if (input.min_amount) {
      filtered = filtered.filter((d) => d.amount >= input.min_amount);
    }
    if (input.account_item_names?.length > 0) {
      filtered = filtered.filter((d) =>
        d.details.some((det) => input.account_item_names.includes(det.account_item_name))
      );
    }

    return { success: true, data: filtered };
  }
}
