import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";

export interface JournalLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
}

@Injectable()
export class AccountingService {
  constructor(private readonly db: TenantDb) {}

  listAccounts() {
    return this.db.query(`SELECT * FROM "__S__"."accounts" ORDER BY code`);
  }

  async createAccount(code: string, name: string, type: string) {
    return this.db.insertReturning(
      `INSERT INTO "__S__"."accounts"(code,name,type) VALUES ($1,$2,$3) RETURNING *`,
      [code, name, type],
    );
  }

  async listJournal(limit = 100) {
    return this.db.query(`
      SELECT je.id, je.entry_date, je.memo, je.source_type, je.source_id,
        COALESCE(SUM(jl.debit),0) AS total_debit,
        COALESCE(SUM(jl.credit),0) AS total_credit
      FROM "__S__"."journal_entries" je
      LEFT JOIN "__S__"."journal_lines" jl ON jl.je_id = je.id
      GROUP BY je.id
      ORDER BY je.entry_date DESC, je.created_at DESC
      LIMIT $1`, [limit]);
  }

  async getJournalEntry(id: string) {
    const [je] = await this.db.query<any>(
      `SELECT * FROM "__S__"."journal_entries" WHERE id = $1`, [id]);
    if (!je) throw new NotFoundException("Journal entry not found");
    const lines = await this.db.query<any>(`
      SELECT jl.*, a.code AS account_code, a.name AS account_name, a.type AS account_type
      FROM "__S__"."journal_lines" jl
      JOIN "__S__"."accounts" a ON a.id = jl.account_id
      WHERE jl.je_id = $1
      ORDER BY jl.debit DESC`, [id]);
    return { ...je, lines };
  }

  /** Manual journal entry. Validates that debits == credits. */
  async createManualEntry(input: {
    date?: string;
    memo: string;
    lines: JournalLineInput[];
  }) {
    if (!input.lines || input.lines.length < 2) {
      throw new BadRequestException("At least two lines required");
    }
    const totalDebit = input.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = input.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new BadRequestException(
        `Unbalanced: debits ${totalDebit.toFixed(2)} != credits ${totalCredit.toFixed(2)}`,
      );
    }
    if (totalDebit === 0) throw new BadRequestException("Empty entry");

    const je = await this.db.insertReturning<any>(
      `INSERT INTO "__S__"."journal_entries"(entry_date, memo, source_type)
       VALUES (COALESCE($1::date, current_date), $2, 'manual') RETURNING *`,
      [input.date ?? null, input.memo],
    );
    for (const l of input.lines) {
      await this.line(je.id, l.accountId, Number(l.debit) || 0, Number(l.credit) || 0);
    }
    return this.getJournalEntry(je.id);
  }

  /** General ledger for a specific account with running balance. */
  async generalLedger(accountId: string, from?: string, to?: string) {
    const f = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const t = to ?? new Date().toISOString().slice(0, 10);
    const [acc] = await this.db.query<any>(
      `SELECT * FROM "__S__"."accounts" WHERE id = $1`, [accountId]);
    if (!acc) throw new NotFoundException("Account not found");
    const rows = await this.db.query<any>(`
      SELECT jl.id, jl.debit, jl.credit,
             je.id AS je_id, je.entry_date, je.memo, je.source_type, je.source_id
      FROM "__S__"."journal_lines" jl
      JOIN "__S__"."journal_entries" je ON je.id = jl.je_id
      WHERE jl.account_id = $1
        AND je.entry_date >= $2::date AND je.entry_date <= $3::date
      ORDER BY je.entry_date ASC, je.created_at ASC`, [accountId, f, t]);
    const isDebitNormal = acc.type === "asset" || acc.type === "expense";
    let balance = 0;
    const lines = rows.map((r) => {
      const delta = isDebitNormal
        ? Number(r.debit) - Number(r.credit)
        : Number(r.credit) - Number(r.debit);
      balance += delta;
      return { ...r, balance: +balance.toFixed(2) };
    });
    return { account: acc, from: f, to: t, lines, ending_balance: +balance.toFixed(2) };
  }

  /** Trial balance: ending balance per account. */
  async trialBalance(from?: string, to?: string) {
    const f = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const t = to ?? new Date().toISOString().slice(0, 10);
    const rows = await this.db.query<any>(`
      SELECT a.id, a.code, a.name, a.type,
             COALESCE(SUM(jl.debit),0)::numeric AS total_debit,
             COALESCE(SUM(jl.credit),0)::numeric AS total_credit
      FROM "__S__"."accounts" a
      LEFT JOIN "__S__"."journal_lines" jl ON jl.account_id = a.id
      LEFT JOIN "__S__"."journal_entries" je ON je.id = jl.je_id
        AND je.entry_date >= $1::date AND je.entry_date <= $2::date
      GROUP BY a.id
      ORDER BY a.code`, [f, t]);

    const accounts = rows.map((r) => {
      const debit = Number(r.total_debit);
      const credit = Number(r.total_credit);
      const isDebitNormal = r.type === "asset" || r.type === "expense";
      // Net delta in the natural direction; negative means it sits on the opposite side.
      const balance = isDebitNormal ? debit - credit : credit - debit;
      return {
        id: r.id, code: r.code, name: r.name, type: r.type,
        debit, credit,
        balance_debit: balance >= 0
          ? (isDebitNormal ? balance : 0)
          : (isDebitNormal ? 0 : -balance),
        balance_credit: balance >= 0
          ? (isDebitNormal ? 0 : balance)
          : (isDebitNormal ? -balance : 0),
      };
    }).filter((a) => a.debit !== 0 || a.credit !== 0);

    const totals = accounts.reduce(
      (acc, a) => ({
        debit: acc.debit + a.balance_debit,
        credit: acc.credit + a.balance_credit,
      }),
      { debit: 0, credit: 0 },
    );
    return { from: f, to: t, accounts, totals };
  }

  async vatReport(from?: string, to?: string) {
    const f = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const t = to ?? new Date().toISOString().slice(0, 10);
    const [out] = await this.db.query<any>(`
      SELECT COALESCE(SUM(vat_total),0)::numeric AS output_vat,
             COALESCE(SUM(subtotal),0)::numeric AS taxable_sales,
             COUNT(*)::int AS invoice_count
      FROM "__S__"."invoices"
      WHERE status IN ('issued','paid')
        AND issue_date >= $1::date AND issue_date <= $2::date`, [f, t]);
    const [inp] = await this.db.query<any>(`
      SELECT COALESCE(SUM(vat_total),0)::numeric AS input_vat,
             COALESCE(SUM(subtotal),0)::numeric AS taxable_purchases,
             COUNT(*)::int AS bill_count
      FROM "__S__"."bills"
      WHERE status IN ('posted','paid')
        AND bill_date >= $1::date AND bill_date <= $2::date`, [f, t]);
    return {
      from: f, to: t,
      output_vat: out.output_vat,
      taxable_sales: out.taxable_sales,
      invoice_count: out.invoice_count,
      input_vat: inp.input_vat,
      taxable_purchases: inp.taxable_purchases,
      bill_count: inp.bill_count,
      net_vat_due: +(Number(out.output_vat) - Number(inp.input_vat)).toFixed(2),
    };
  }

  async pnl(from?: string, to?: string) {
    const f = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const t = to ?? new Date().toISOString().slice(0, 10);
    const rows = await this.db.query<any>(`
      SELECT a.code, a.name, a.type,
             COALESCE(SUM(jl.credit - jl.debit),0)::numeric AS amount
      FROM "__S__"."journal_lines" jl
      JOIN "__S__"."journal_entries" je ON je.id = jl.je_id
      JOIN "__S__"."accounts" a ON a.id = jl.account_id
      WHERE je.entry_date >= $1::date AND je.entry_date <= $2::date
        AND a.type IN ('revenue','expense')
      GROUP BY a.id, a.code, a.name, a.type
      HAVING COALESCE(SUM(jl.credit - jl.debit),0) <> 0
      ORDER BY a.code`, [f, t]);
    const revenue = rows.filter(r => r.type === "revenue").map(r => ({ ...r, amount: Number(r.amount) }));
    const expense = rows.filter(r => r.type === "expense").map(r => ({ ...r, amount: -Number(r.amount) }));
    const revenueTotal = revenue.reduce((s, r) => s + r.amount, 0);
    const expenseTotal = expense.reduce((s, r) => s + r.amount, 0);
    return {
      from: f, to: t, revenue, expense,
      revenue_total: +revenueTotal.toFixed(2),
      expense_total: +expenseTotal.toFixed(2),
      net: +(revenueTotal - expenseTotal).toFixed(2),
    };
  }

  // ── Auto-postings ─────────────────────────────────────────────────────────

  async postInvoiceIssued(invoiceId: string, subtotal: number, vat: number) {
    const total = +(subtotal + vat).toFixed(2);
    const ar = await this.accountByCode("1100");
    const sales = await this.accountByCode("4000");
    const vatAcc = await this.accountByCode("2100");
    const je = await this.db.insertReturning<any>(
      `INSERT INTO "__S__"."journal_entries"(memo, source_type, source_id)
       VALUES ($1,'invoice',$2) RETURNING *`,
      [`Invoice issued`, invoiceId]);
    await this.line(je.id, ar.id, total, 0);
    await this.line(je.id, sales.id, 0, subtotal);
    if (vat > 0) await this.line(je.id, vatAcc.id, 0, vat);
  }

  async postInvoicePaid(invoiceId: string, total: number) {
    const cash = await this.accountByCode("1000");
    const ar = await this.accountByCode("1100");
    const je = await this.db.insertReturning<any>(
      `INSERT INTO "__S__"."journal_entries"(memo, source_type, source_id)
       VALUES ($1,'payment',$2) RETURNING *`,
      [`Payment received`, invoiceId]);
    await this.line(je.id, cash.id, total, 0);
    await this.line(je.id, ar.id, 0, total);
  }

  /** Dr Expense accounts (per line) + Dr Input VAT / Cr Accounts Payable. */
  async postBillReceived(billId: string, lines: { expenseAccountId: string; lineSubtotal: number }[], vat: number) {
    const ap = await this.accountByCode("2200");
    const inputVat = await this.accountByCode("1400");
    const defaultExpense = await this.accountByCode("5900");

    const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
    const total = +(subtotal + vat).toFixed(2);

    const je = await this.db.insertReturning<any>(
      `INSERT INTO "__S__"."journal_entries"(memo, source_type, source_id)
       VALUES ($1,'bill',$2) RETURNING *`,
      [`Bill posted`, billId]);

    for (const l of lines) {
      await this.line(je.id, l.expenseAccountId || defaultExpense.id, l.lineSubtotal, 0);
    }
    if (vat > 0) await this.line(je.id, inputVat.id, vat, 0);
    await this.line(je.id, ap.id, 0, total);
  }

  /** Dr Accounts Payable / Cr Cash. */
  async postBillPaid(billId: string, total: number) {
    const cash = await this.accountByCode("1000");
    const ap = await this.accountByCode("2200");
    const je = await this.db.insertReturning<any>(
      `INSERT INTO "__S__"."journal_entries"(memo, source_type, source_id)
       VALUES ($1,'bill_payment',$2) RETURNING *`,
      [`Bill paid`, billId]);
    await this.line(je.id, ap.id, total, 0);
    await this.line(je.id, cash.id, 0, total);
  }

  private async accountByCode(code: string) {
    const rows = await this.db.query<any>(
      `SELECT * FROM "__S__"."accounts" WHERE code = $1`, [code]);
    if (!rows[0]) throw new NotFoundException(`Account ${code} missing`);
    return rows[0];
  }

  private line(jeId: string, accountId: string, debit: number, credit: number) {
    return this.db.exec(
      `INSERT INTO "__S__"."journal_lines"(je_id, account_id, debit, credit)
       VALUES ($1,$2,$3::numeric,$4::numeric)`,
      [jeId, accountId, debit, credit],
    );
  }
}
