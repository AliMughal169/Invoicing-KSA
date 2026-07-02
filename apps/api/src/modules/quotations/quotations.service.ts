import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";
import { InvoicingService } from "../invoicing/invoicing.service";

interface QuotationLineInput {
  description: string;
  qty: number;
  unitPrice: number;
  vatRate?: number;
}

@Injectable()
export class QuotationsService {
  constructor(
    private readonly db: TenantDb,
    private readonly invoicingService: InvoicingService,
  ) {}

  async listQuotations() {
    return this.db.query(`
      SELECT q.*, c.name AS customer_name, inv.number AS invoice_number
      FROM "__S__"."quotations" q
      LEFT JOIN "__S__"."customers" c ON c.id = q.customer_id
      LEFT JOIN "__S__"."invoices" inv ON inv.id = q.converted_to_invoice_id
      ORDER BY q.created_at DESC`);
  }

  async getQuotation(id: string) {
    const rows = await this.db.query<any>(`
      SELECT q.*, c.name AS customer_name, c.vat_number AS customer_vat, inv.number AS invoice_number
      FROM "__S__"."quotations" q
      LEFT JOIN "__S__"."customers" c ON c.id = q.customer_id
      LEFT JOIN "__S__"."invoices" inv ON inv.id = q.converted_to_invoice_id
      WHERE q.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException("Quotation not found");
    const lines = await this.db.query(
      `SELECT * FROM "__S__"."quotation_lines" WHERE quotation_id = $1`, [id]);
    const q = rows[0];
    const customFields = q.custom_fields ? (typeof q.custom_fields === 'string' ? JSON.parse(q.custom_fields) : q.custom_fields) : {};
    return { ...q, custom_fields: customFields, lines };
  }

  async createQuotation(input: {
    customerId: string;
    issueDate?: string;
    dueDate?: string;
    isTaxQuote?: boolean;
    lines: QuotationLineInput[];
    customFields?: Record<string, any>;
  }) {
    if (!input.lines?.length) throw new BadRequestException("At least one line is required");

    const isTaxQuote = input.isTaxQuote !== false;
    let subtotal = 0, vatTotal = 0;
    const computed = input.lines.map((l) => {
      const lineSubtotal = +(l.qty * l.unitPrice).toFixed(2);
      const vatRate = isTaxQuote ? (l.vatRate ?? 15) : 0;
      const lineVat = +(lineSubtotal * (vatRate / 100)).toFixed(2);
      subtotal += lineSubtotal;
      vatTotal += lineVat;
      return { ...l, lineSubtotal, lineVat, vatRate };
    });
    const total = +(subtotal + vatTotal).toFixed(2);

    const number = await this.nextNumber();

    const quotation = await this.db.insertReturning<any>(
      `INSERT INTO "__S__"."quotations"
       (number, customer_id, issue_date, due_date, status, subtotal, vat_total, total, custom_fields)
       VALUES ($1, $2, COALESCE($3::date, current_date), $4::date, 'draft', $5::numeric, $6::numeric, $7::numeric, $8::jsonb)
       RETURNING *`,
      [number, input.customerId, input.issueDate ?? null, input.dueDate ?? null,
       subtotal, vatTotal, total, JSON.stringify(input.customFields || {})],
    );

    for (const l of computed) {
      await this.db.exec(
        `INSERT INTO "__S__"."quotation_lines"
         (quotation_id, description, qty, unit_price, vat_rate, line_total)
         VALUES ($1,$2,$3::numeric,$4::numeric,$5::numeric,$6::numeric)`,
        [quotation.id, l.description, l.qty, l.unitPrice, l.vatRate,
         l.lineSubtotal + l.lineVat],
      );
    }
    return quotation;
  }

  async updateQuotation(id: string, input: {
    customerId?: string;
    issueDate?: string;
    dueDate?: string;
    status?: string;
    isTaxQuote?: boolean;
    lines?: QuotationLineInput[];
    customFields?: Record<string, any>;
  }) {
    const rows = await this.db.query<any>(
      `SELECT * FROM "__S__"."quotations" WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException("Quotation not found");
    const existing = rows[0];

    if (existing.status === "invoiced") {
      throw new BadRequestException("Cannot edit an invoiced quotation");
    }

    const customerId = input.customerId ?? existing.customer_id;
    const issueDate = input.issueDate ?? existing.issue_date;
    const dueDate = input.dueDate ?? existing.due_date;
    const status = input.status ?? existing.status;
    const customFields = input.customFields ?? (existing.custom_fields ? (typeof existing.custom_fields === 'string' ? JSON.parse(existing.custom_fields) : existing.custom_fields) : {});

    let subtotal = Number(existing.subtotal);
    let vatTotal = Number(existing.vat_total);
    let total = Number(existing.total);

    if (input.lines) {
      if (!input.lines.length) throw new BadRequestException("At least one line is required");
      const isTaxQuote = input.isTaxQuote !== false;
      subtotal = 0;
      vatTotal = 0;
      const computed = input.lines.map((l) => {
        const lineSubtotal = +(l.qty * l.unitPrice).toFixed(2);
        const vatRate = isTaxQuote ? (l.vatRate ?? 15) : 0;
        const lineVat = +(lineSubtotal * (vatRate / 100)).toFixed(2);
        subtotal += lineSubtotal;
        vatTotal += lineVat;
        return { ...l, lineSubtotal, lineVat, vatRate };
      });
      total = +(subtotal + vatTotal).toFixed(2);

      await this.db.exec(`DELETE FROM "__S__"."quotation_lines" WHERE quotation_id = $1`, [id]);
      for (const l of computed) {
        await this.db.exec(
          `INSERT INTO "__S__"."quotation_lines"
           (quotation_id, description, qty, unit_price, vat_rate, line_total)
           VALUES ($1,$2,$3::numeric,$4::numeric,$5::numeric,$6::numeric)`,
          [id, l.description, l.qty, l.unitPrice, l.vatRate,
           l.lineSubtotal + l.lineVat],
        );
      }
    }

    const updated = await this.db.insertReturning<any>(
      `UPDATE "__S__"."quotations" SET
       customer_id = $1, issue_date = $2::date, due_date = $3::date, status = $4,
       subtotal = $5::numeric, vat_total = $6::numeric, total = $7::numeric, custom_fields = $8::jsonb, updated_at = now()
       WHERE id = $9 RETURNING *`,
      [customerId, issueDate, dueDate, status, subtotal, vatTotal, total, JSON.stringify(customFields), id],
    );

    return updated;
  }

  async convertToInvoice(id: string) {
    const rows = await this.db.query<any>(
      `SELECT * FROM "__S__"."quotations" WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException("Quotation not found");
    const q = rows[0];

    if (q.status === "invoiced") {
      throw new BadRequestException("Quotation already converted to invoice");
    }

    const lines = await this.db.query<any>(
      `SELECT * FROM "__S__"."quotation_lines" WHERE quotation_id = $1`, [id]);

    const isTaxInvoice = lines.some((l: any) => Number(l.vat_rate) > 0);
    const customFields = q.custom_fields ? (typeof q.custom_fields === 'string' ? JSON.parse(q.custom_fields) : q.custom_fields) : {};

    const invoice = await this.invoicingService.createInvoice({
      customerId: q.customer_id,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: q.due_date ? new Date(q.due_date).toISOString().slice(0, 10) : undefined,
      isTaxInvoice,
      customFields,
      lines: lines.map((l: any) => ({
        description: l.description,
        qty: Number(l.qty),
        unitPrice: Number(l.unit_price),
        vatRate: Number(l.vat_rate),
      })),
    });

    await this.db.exec(
      `UPDATE "__S__"."quotations" SET status = 'invoiced', converted_to_invoice_id = $1, updated_at = now() WHERE id = $2`,
      [invoice.id, id],
    );

    return { ok: true, invoiceId: invoice.id };
  }

  async deleteQuotation(id: string) {
    const rows = await this.db.query<any>(
      `SELECT * FROM "__S__"."quotations" WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException("Quotation not found");
    if (rows[0].status === "invoiced") {
      throw new BadRequestException("Cannot delete an invoiced quotation");
    }
    await this.db.exec(`DELETE FROM "__S__"."quotations" WHERE id = $1`, [id]);
    return { ok: true };
  }

  private async nextNumber(): Promise<string> {
    const rows = await this.db.query<{ c: bigint }>(
      `SELECT COUNT(*)::bigint AS c FROM "__S__"."quotations"`);
    const n = Number(rows[0]?.c ?? 0) + 1;
    const year = new Date().getFullYear();
    return `QT-${year}-${String(n).padStart(5, "0")}`;
  }
}
