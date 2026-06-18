import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";
import { AccountingService } from "../accounting/accounting.service";

export interface BillLineInput {
  description: string;
  qty: number;
  unitPrice: number;
  vatRate?: number;
  expenseAccountId?: string;
}

@Injectable()
export class PurchasingService {
  constructor(
    private readonly db: TenantDb,
    private readonly accounting: AccountingService,
  ) {}

  // ── Vendors ───────────────────────────────────────────────────────────────
  listVendors() {
    return this.db.query(`SELECT * FROM "__S__"."vendors" ORDER BY created_at DESC`);
  }

  getVendor(id: string) {
    return this.db.query(`SELECT * FROM "__S__"."vendors" WHERE id = $1`, [id])
      .then(r => r[0] ?? null);
  }

  createVendor(input: {
    name: string; vatNumber?: string; email?: string; phone?: string;
    address?: string; city?: string; country?: string;
  }) {
    return this.db.insertReturning(
      `INSERT INTO "__S__"."vendors"(name, vat_number, email, phone, address, city, country)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [input.name, input.vatNumber ?? null, input.email ?? null, input.phone ?? null,
       input.address ?? null, input.city ?? null, input.country ?? null],
    );
  }

  // ── Bills ─────────────────────────────────────────────────────────────────
  listBills() {
    return this.db.query(`
      SELECT b.*, v.name AS vendor_name
      FROM "__S__"."bills" b
      LEFT JOIN "__S__"."vendors" v ON v.id = b.vendor_id
      ORDER BY b.created_at DESC`);
  }

  async getBill(id: string) {
    const rows = await this.db.query<any>(`
      SELECT b.*, v.name AS vendor_name, v.vat_number AS vendor_vat
      FROM "__S__"."bills" b
      LEFT JOIN "__S__"."vendors" v ON v.id = b.vendor_id
      WHERE b.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException("Bill not found");
    const lines = await this.db.query<any>(`
      SELECT bl.*, a.code AS expense_code, a.name AS expense_name
      FROM "__S__"."bill_lines" bl
      LEFT JOIN "__S__"."accounts" a ON a.id = bl.expense_account_id
      WHERE bl.bill_id = $1`, [id]);
    return { ...rows[0], lines };
  }

  async createBill(input: {
    vendorId: string;
    billDate?: string;
    dueDate?: string;
    reference?: string;
    notes?: string;
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
       (number, vendor_id, bill_date, due_date, status, subtotal, vat_total, total, reference, notes)
       VALUES ($1,$2, COALESCE($3::date, current_date), $4::date, 'draft', $5::numeric, $6::numeric, $7::numeric, $8, $9)
       RETURNING *`,
      [number, input.vendorId, input.billDate ?? null, input.dueDate ?? null,
       subtotal, vatTotal, total, input.reference ?? null, input.notes ?? null]);

    for (const l of computed) {
      await this.db.exec(
        `INSERT INTO "__S__"."bill_lines"
         (bill_id, description, qty, unit_price, vat_rate, line_total, expense_account_id)
         VALUES ($1,$2,$3::numeric,$4::numeric,$5::numeric,$6::numeric,$7)`,
        [bill.id, l.description, l.qty, l.unitPrice, l.vatRate,
         l.lineSubtotal + l.lineVat, l.expenseAccountId ?? null]);
    }
    return bill;
  }

  async postBill(id: string) {
    const bill = await this.getBill(id);
    if (bill.status !== "draft") throw new BadRequestException(`Bill already ${bill.status}`);
    await this.db.exec(`UPDATE "__S__"."bills" SET status='posted' WHERE id=$1`, [id]);

    const expenseLines = bill.lines.map((l: any) => ({
      expenseAccountId: l.expense_account_id,
      lineSubtotal: +(Number(l.qty) * Number(l.unit_price)).toFixed(2),
    }));
    await this.accounting.postBillReceived(id, expenseLines, Number(bill.vat_total));
    return this.getBill(id);
  }

  async payBill(id: string) {
    const bill = await this.getBill(id);
    if (bill.status === "paid") throw new BadRequestException("Already paid");
    if (bill.status === "draft") throw new BadRequestException("Post the bill first");
    await this.db.exec(`UPDATE "__S__"."bills" SET status='paid' WHERE id=$1`, [id]);
    await this.accounting.postBillPaid(id, Number(bill.total));
    return this.getBill(id);
  }

  private async nextNumber(): Promise<string> {
    const [{ c }] = await this.db.query<{ c: bigint }>(
      `SELECT COUNT(*)::bigint AS c FROM "__S__"."bills"`);
    const n = Number(c ?? 0) + 1;
    const year = new Date().getFullYear();
    return `BILL-${year}-${String(n).padStart(5, "0")}`;
  }
}
