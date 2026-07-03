import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";
import { PrismaService } from "../../core/database/prisma.service";
import { TenantContextService } from "../../tenancy/tenant-context.service";
import { AccountingService } from "../accounting/accounting.service";

export interface BillLineInput {
  description: string;
  qty: number;
  unitPrice: number;
  vatRate?: number;
  expenseAccountId?: string;
  productId?: string;
}

@Injectable()
export class PurchasingService {
  constructor(
    private readonly db: TenantDb,
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly ctx: TenantContextService,
  ) {}

  // ── Vendors ───────────────────────────────────────────────────────────────
  listVendors() {
    return this.db.query(`SELECT *, name_en AS name FROM "__S__"."vendors" ORDER BY created_at DESC`);
  }

  async getVendor(id: string) {
    const rows = await this.db.query<any>(`SELECT *, name_en AS name FROM "__S__"."vendors" WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  getVendorBills(vendorId: string) {
    return this.db.query(`SELECT * FROM "__S__"."bills" WHERE vendor_id = $1 ORDER BY bill_date DESC`, [vendorId]);
  }

  createVendor(input: {
    nameEn: string;
    nameAr: string;
    vatNumber: string;
    crNumber?: string;
    email?: string;
    phone?: string;
    address?: string;
    paymentTerms?: string;
  }) {
    return this.db.insertReturning(
      `INSERT INTO "__S__"."vendors"(name_en, name_ar, vat_number, cr_number, email, phone, address, payment_terms, outstanding_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0::numeric) RETURNING *, name_en AS name`,
      [
        input.nameEn,
        input.nameAr,
        input.vatNumber,
        input.crNumber ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.address ?? null,
        input.paymentTerms ?? null
      ]
    );
  }

  // ── Bills ─────────────────────────────────────────────────────────────────
  listBills() {
    return this.db.query(`
      SELECT b.*, v.name_en AS vendor_name
      FROM "__S__"."bills" b
      LEFT JOIN "__S__"."vendors" v ON v.id = b.vendor_id
      ORDER BY b.created_at DESC`);
  }

  async getBill(id: string) {
    const rows = await this.db.query<any>(`
      SELECT b.*, v.name_en AS vendor_name, v.vat_number AS vendor_vat
      FROM "__S__"."bills" b
      LEFT JOIN "__S__"."vendors" v ON v.id = b.vendor_id
      WHERE b.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException("Bill not found");
    const lines = await this.db.query<any>(`
      SELECT bl.*, a.code AS expense_code, a.name AS expense_name, p.name_en AS product_name
      FROM "__S__"."bill_lines" bl
      LEFT JOIN "__S__"."accounts" a ON a.id = bl.expense_account_id
      LEFT JOIN "__S__"."products" p ON p.id = bl.product_id
      WHERE bl.bill_id = $1`, [id]);
    return { ...rows[0], lines };
  }

  async createBill(input: {
    vendorId: string;
    billDate?: string;
    dueDate?: string;
    vendorInvoiceRef?: string;
    notes?: string;
    customFields?: Record<string, any>;
    lines: BillLineInput[];
  }) {
    if (!input.lines?.length) throw new BadRequestException("At least one line required");

    let subtotal = 0, vatTotal = 0;
    const computed = input.lines.map((l) => {
      const lineSubtotal = +(l.qty * l.unitPrice).toFixed(2);
      const vatRate = l.vatRate ?? 15;
      const lineVat = +(lineSubtotal * vatRate / 100).toFixed(2);
      subtotal += lineSubtotal;
      vatTotal += lineVat;
      return { ...l, lineSubtotal, lineVat, vatRate };
    });
    const total = +(subtotal + vatTotal).toFixed(2);
    const number = await this.nextNumber();

    const bill = await this.db.insertReturning<any>(
      `INSERT INTO "__S__"."bills"
       (number, vendor_id, bill_date, due_date, status, subtotal, vat_total, total, vendor_invoice_ref, notes, custom_fields)
       VALUES ($1, $2, COALESCE($3::date, current_date), $4::date, 'DRAFT', $5::numeric, $6::numeric, $7::numeric, $8, $9, $10::jsonb)
       RETURNING *`,
      [
        number,
        input.vendorId,
        input.billDate ?? null,
        input.dueDate ?? null,
        subtotal,
        vatTotal,
        total,
        input.vendorInvoiceRef ?? null,
        input.notes ?? null,
        JSON.stringify(input.customFields ?? {})
      ]
    );

    for (const l of computed) {
      await this.db.exec(
        `INSERT INTO "__S__"."bill_lines"
         (bill_id, description, qty, unit_price, vat_rate, line_total, expense_account_id, product_id)
         VALUES ($1,$2,$3::numeric,$4::numeric,$5::numeric,$6::numeric,$7,$8)`,
        [
          bill.id,
          l.description,
          l.qty,
          l.unitPrice,
          l.vatRate,
          +(l.lineSubtotal + l.lineVat).toFixed(2),
          l.expenseAccountId ?? null,
          l.productId ?? null
        ]
      );
    }
    return bill;
  }

  async approveBill(id: string) {
    const bill = await this.getBill(id);
    if (bill.status !== "DRAFT") {
      throw new BadRequestException(`Bill already ${bill.status}`);
    }

    const schema = this.ctx.getSchema()!;
    await this.prisma.$transaction(async (tx) => {
      const query = async <T = any>(sql: string, params: any[] = []) => {
        return tx.$queryRawUnsafe<T[]>(sql.replace(/__S__/g, schema), ...params);
      };
      const exec = async (sql: string, params: any[] = []) => {
        return tx.$executeRawUnsafe(sql.replace(/__S__/g, schema), ...params);
      };

      let stockableSubtotal = 0;
      let expenseSubtotal = 0;
      const expenseLines: { expenseAccountId: string; lineSubtotal: number }[] = [];

      for (const l of bill.lines) {
        const lineSubtotal = +(Number(l.qty) * Number(l.unit_price)).toFixed(2);
        let isStocked = false;

        if (l.product_id) {
          const [prod] = await query(`SELECT * FROM "__S__"."products" WHERE id = $1`, [l.product_id]);
          if (prod && prod.track_inventory) {
            isStocked = true;
            const qty = Number(l.qty);
            // Increment qty_on_hand
            await exec(
              `UPDATE "__S__"."products" SET qty_on_hand = qty_on_hand + $1 WHERE id = $2`,
              [qty, l.product_id]
            );
            // Spawn a stock movement entry
            await exec(
              `INSERT INTO "__S__"."stock_movements" (product_id, quantity, type, reference_id)
               VALUES ($1, $2::numeric, 'PURCHASE', $3)`,
              [l.product_id, qty, id]
            );
          }
        }

        if (isStocked) {
          stockableSubtotal += lineSubtotal;
        } else {
          expenseSubtotal += lineSubtotal;
          expenseLines.push({
            expenseAccountId: l.expense_account_id,
            lineSubtotal,
          });
        }
      }

      const ap = await this.accountByCode("2200");
      const inputVat = await this.accountByCode("1400");
      const inventoryAcc = await this.accountByCode("1200");
      const defaultExpense = await this.accountByCode("5900");

      const vat = Number(bill.vat_total);
      const total = +(Number(bill.subtotal) + vat).toFixed(2);

      const [je] = await query(
        `INSERT INTO "__S__"."journal_entries"(memo, source_type, source_id)
         VALUES ($1, 'bill', $2) RETURNING *`,
        [`Bill ${bill.number} posted`, id]
      );

      // Debit Inventory (1200) for stockable goods
      if (stockableSubtotal > 0) {
        await exec(
          `INSERT INTO "__S__"."journal_lines"(je_id, account_id, debit, credit)
           VALUES ($1, $2, $3::numeric, 0::numeric)`,
          [je.id, inventoryAcc.id, stockableSubtotal]
        );
      }
      // Debit Expenses
      for (const el of expenseLines) {
        await exec(
          `INSERT INTO "__S__"."journal_lines"(je_id, account_id, debit, credit)
           VALUES ($1, $2, $3::numeric, 0::numeric)`,
          [je.id, el.expenseAccountId || defaultExpense.id, el.lineSubtotal]
        );
      }
      // Debit Input VAT (1400)
      if (vat > 0) {
        await exec(
          `INSERT INTO "__S__"."journal_lines"(je_id, account_id, debit, credit)
           VALUES ($1, $2, $3::numeric, 0::numeric)`,
          [je.id, inputVat.id, vat]
        );
      }
      // Credit Accounts Payable (2200)
      await exec(
        `INSERT INTO "__S__"."journal_lines"(je_id, account_id, debit, credit)
         VALUES ($1, $2, 0::numeric, $3::numeric)`,
        [je.id, ap.id, total]
      );

      // Update Vendor Balance
      if (bill.vendor_id) {
        await exec(
          `UPDATE "__S__"."vendors" SET outstanding_balance = outstanding_balance + $1 WHERE id = $2`,
          [total, bill.vendor_id]
        );
      }

      await exec(`UPDATE "__S__"."bills" SET status = 'APPROVED' WHERE id = $1`, [id]);
    });

    return this.getBill(id);
  }

  async payBill(id: string) {
    const bill = await this.getBill(id);
    if (bill.status === "PAID") throw new BadRequestException("Already paid");
    if (bill.status === "DRAFT") throw new BadRequestException("Approve the bill first");
    
    await this.db.exec(`UPDATE "__S__"."bills" SET status='PAID' WHERE id=$1`, [id]);
    await this.accounting.postBillPaid(id, Number(bill.total));

    if (bill.vendor_id) {
      await this.db.exec(
        `UPDATE "__S__"."vendors" SET outstanding_balance = outstanding_balance - $1 WHERE id = $2`,
        [Number(bill.total), bill.vendor_id]
      );
    }
    return this.getBill(id);
  }

  updateVendor(id: string, b: {
    nameEn?: string;
    nameAr?: string;
    vatNumber?: string;
    crNumber?: string;
    email?: string;
    phone?: string;
    address?: string;
    paymentTerms?: string;
  }) {
    return this.db.insertReturning(
      `UPDATE "__S__"."vendors"
       SET name_en = COALESCE($1, name_en),
           name_ar = COALESCE($2, name_ar),
           vat_number = COALESCE($3, vat_number),
           cr_number = COALESCE($4, cr_number),
           email = COALESCE($5, email),
           phone = COALESCE($6, phone),
           address = COALESCE($7, address),
           payment_terms = COALESCE($8, payment_terms)
       WHERE id = $9
       RETURNING *, name_en AS name`,
      [
        b.nameEn ?? null,
        b.nameAr ?? null,
        b.vatNumber ?? null,
        b.crNumber ?? null,
        b.email ?? null,
        b.phone ?? null,
        b.address ?? null,
        b.paymentTerms ?? null,
        id
      ]
    );
  }

  async deleteVendor(id: string) {
    const vendor = await this.getVendor(id);
    if (!vendor) throw new NotFoundException("Vendor not found");
    await this.db.exec(`DELETE FROM "__S__"."vendors" WHERE id = $1`, [id]);
    return { success: true };
  }

  async updateBill(id: string, input: {
    vendorId: string;
    billDate?: string;
    dueDate?: string;
    vendorInvoiceRef?: string;
    notes?: string;
    customFields?: Record<string, any>;
    lines: BillLineInput[];
  }) {
    const bill = await this.getBill(id);
    if (bill.status !== "DRAFT") {
      throw new BadRequestException("Can only edit draft bills");
    }
    if (!input.lines?.length) throw new BadRequestException("At least one line required");

    let subtotal = 0, vatTotal = 0;
    const computed = input.lines.map((l) => {
      const lineSubtotal = +(l.qty * l.unitPrice).toFixed(2);
      const vatRate = l.vatRate ?? 15;
      const lineVat = +(lineSubtotal * vatRate / 100).toFixed(2);
      subtotal += lineSubtotal;
      vatTotal += lineVat;
      return { ...l, lineSubtotal, lineVat, vatRate };
    });
    const total = +(subtotal + vatTotal).toFixed(2);

    await this.db.exec(
      `UPDATE "__S__"."bills"
       SET vendor_id = $1,
           bill_date = COALESCE($2::date, bill_date),
           due_date = $3::date,
           vendor_invoice_ref = $4,
           notes = $5,
           custom_fields = $6::jsonb,
           subtotal = $7::numeric,
           vat_total = $8::numeric,
           total = $9::numeric
       WHERE id = $10`,
      [
        input.vendorId,
        input.billDate ?? null,
        input.dueDate ?? null,
        input.vendorInvoiceRef ?? null,
        input.notes ?? null,
        JSON.stringify(input.customFields ?? {}),
        subtotal,
        vatTotal,
        total,
        id
      ]
    );

    await this.db.exec(`DELETE FROM "__S__"."bill_lines" WHERE bill_id = $1`, [id]);
    for (const l of computed) {
      await this.db.exec(
        `INSERT INTO "__S__"."bill_lines"
         (bill_id, description, qty, unit_price, vat_rate, line_total, expense_account_id, product_id)
         VALUES ($1,$2,$3::numeric,$4::numeric,$5::numeric,$6::numeric,$7,$8)`,
        [
          id,
          l.description,
          l.qty,
          l.unitPrice,
          l.vatRate,
          +(l.lineSubtotal + l.lineVat).toFixed(2),
          l.expenseAccountId ?? null,
          l.productId ?? null
        ]
      );
    }
    return this.getBill(id);
  }

  async deleteBill(id: string) {
    const bill = await this.getBill(id);
    if (bill.status !== "DRAFT") {
      throw new BadRequestException("Can only delete draft bills");
    }
    await this.db.exec(`DELETE FROM "__S__"."bills" WHERE id = $1`, [id]);
    return { success: true };
  }

  private async accountByCode(code: string) {
    const rows = await this.db.query<any>(
      `SELECT * FROM "__S__"."accounts" WHERE code = $1`, [code]);
    if (!rows[0]) throw new NotFoundException(`Account ${code} missing`);
    return rows[0];
  }

  private async nextNumber(): Promise<string> {
    const [{ c }] = await this.db.query<{ c: bigint }>(
      `SELECT COUNT(*)::bigint AS c FROM "__S__"."bills"`);
    const n = Number(c ?? 0) + 1;
    const year = new Date().getFullYear();
    return `BILL-${year}-${String(n).padStart(5, "0")}`;
  }
}
