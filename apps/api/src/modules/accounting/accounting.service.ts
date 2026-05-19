import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";

@Injectable()
export class AccountingService {
  constructor(private readonly db: TenantDb) {}

  listAccounts() {
    return this.db.query(`SELECT * FROM "__S__"."accounts" ORDER BY code`);
  }

  async listJournal(limit = 50) {
    return this.db.query(`
      SELECT je.id, je.entry_date, je.memo, je.source_type,
        COALESCE(SUM(jl.debit),0) AS total_debit,
        COALESCE(SUM(jl.credit),0) AS total_credit
      FROM "__S__"."journal_entries" je
      LEFT JOIN "__S__"."journal_lines" jl ON jl.je_id = je.id
      GROUP BY je.id
      ORDER BY je.entry_date DESC, je.created_at DESC
      LIMIT $1`, [limit]);
  }

  async vatReport(from?: string, to?: string) {
    const f = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const t = to ?? new Date().toISOString().slice(0, 10);
    const rows = await this.db.query<any>(`
      SELECT COALESCE(SUM(vat_total),0)::numeric AS output_vat,
             COALESCE(SUM(subtotal),0)::numeric AS taxable_sales,
             COUNT(*)::int AS invoice_count
      FROM "__S__"."invoices"
      WHERE status IN ('issued','paid')
        AND issue_date >= $1::date AND issue_date <= $2::date`, [f, t]);
    return { from: f, to: t, ...rows[0] };
  }

  async pnl(from?: string, to?: string) {
    const f = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const t = to ?? new Date().toISOString().slice(0, 10);
    const rows = await this.db.query<any>(`
      SELECT a.type,
             COALESCE(SUM(jl.credit - jl.debit),0)::numeric AS amount
      FROM "__S__"."journal_lines" jl
      JOIN "__S__"."journal_entries" je ON je.id = jl.je_id
      JOIN "__S__"."accounts" a ON a.id = jl.account_id
      WHERE je.entry_date >= $1::date AND je.entry_date <= $2::date
        AND a.type IN ('revenue','expense')
      GROUP BY a.type`, [f, t]);
    const revenue = Number(rows.find(r => r.type === "revenue")?.amount ?? 0);
    const expense = -Number(rows.find(r => r.type === "expense")?.amount ?? 0);
    return { from: f, to: t, revenue, expense, net: revenue - expense };
  }

  /** Auto-posted journal entries -- called by Invoicing. */
  async postInvoiceIssued(invoiceId: string, subtotal: number, vat: number) {
    const total = +(subtotal + vat).toFixed(2);
    const ar = await this.accountByCode("1100");
    const sales = await this.accountByCode("4000");
    const vatAcc = await this.accountByCode("2100");

    const je = await this.db.insertReturning<any>(
      `INSERT INTO "__S__"."journal_entries"(memo, source_type, source_id)
       VALUES ($1,'invoice',$2) RETURNING *`,
      [`Invoice issued`, invoiceId],
    );
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
      [`Payment received`, invoiceId],
    );
    await this.line(je.id, cash.id, total, 0);
    await this.line(je.id, ar.id, 0, total);
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
