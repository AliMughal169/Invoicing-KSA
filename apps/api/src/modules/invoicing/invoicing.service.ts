import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";
import { AccountingService } from "../accounting/accounting.service";
import { ZatcaService } from "./zatca.service";
import { TenantContextService } from "../../tenancy/tenant-context.service";
import { PrismaService } from "../../core/database/prisma.service";

interface InvoiceLineInput {
  description: string;
  qty: number;
  unitPrice: number;
  vatRate?: number;
}

@Injectable()
export class InvoicingService {
  constructor(
    private readonly db: TenantDb,
    private readonly accounting: AccountingService,
    private readonly zatca: ZatcaService,
    private readonly ctx: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  // Customers
  listCustomers() {
    return this.db.query(`SELECT * FROM "__S__"."customers" ORDER BY created_at DESC`);
  }
  createCustomer(input: {
    name: string;
    email?: string;
    vatNumber?: string;
    contactPersonName?: string;
    companyPhone?: string;
    contactPersonPhone?: string;
    contactPersonPhoneSameAsCompany?: boolean;
    address?: string;
    state?: string;
    city?: string;
    country?: string;
  }) {
    const contactPersonPhone = input.contactPersonPhoneSameAsCompany
      ? input.companyPhone ?? null
      : input.contactPersonPhone ?? null;
    return this.db.insertReturning(
      `INSERT INTO "__S__"."customers"(
        name, email, vat_number,
        contact_person_name, company_phone, contact_person_phone,
        contact_person_phone_same_as_company, address, state, city, country
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        input.name,
        input.email ?? null,
        input.vatNumber ?? null,
        input.contactPersonName ?? null,
        input.companyPhone ?? null,
        contactPersonPhone,
        input.contactPersonPhoneSameAsCompany ?? true,
        input.address ?? null,
        input.state ?? null,
        input.city ?? null,
        input.country ?? null,
      ],
    );
  }

  // Products
  listProducts() {
    return this.db.query(`SELECT * FROM "__S__"."products" ORDER BY created_at DESC`);
  }
  createProduct(name: string, priceSar: number, sku?: string, vatRate = 15) {
    return this.db.insertReturning(
      `INSERT INTO "__S__"."products"(name,price_sar,sku,vat_rate) VALUES ($1,$2::numeric,$3,$4::numeric) RETURNING *`,
      [name, priceSar, sku ?? null, vatRate],
    );
  }

  // Invoices
  async listInvoices() {
    return this.db.query(`
      SELECT i.*, c.name AS customer_name
      FROM "__S__"."invoices" i
      LEFT JOIN "__S__"."customers" c ON c.id = i.customer_id
      ORDER BY i.created_at DESC`);
  }

  async getInvoice(id: string) {
    const rows = await this.db.query<any>(`
      SELECT i.*, c.name AS customer_name, c.vat_number AS customer_vat
      FROM "__S__"."invoices" i
      LEFT JOIN "__S__"."customers" c ON c.id = i.customer_id
      WHERE i.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException("Invoice not found");
    const lines = await this.db.query(
      `SELECT * FROM "__S__"."invoice_lines" WHERE invoice_id = $1`, [id]);
    return { ...rows[0], lines };
  }

  async createInvoice(input: {
    customerId: string;
    issueDate?: string;
    dueDate?: string;
    isTaxInvoice?: boolean;
    lines: InvoiceLineInput[];
  }) {
    if (!input.lines?.length) throw new BadRequestException("At least one line is required");

    const isTaxInvoice = input.isTaxInvoice !== false; // Default to true
    let subtotal = 0, vatTotal = 0;
    const computed = input.lines.map((l) => {
      const lineSubtotal = +(l.qty * l.unitPrice).toFixed(2);
      const vatRate = isTaxInvoice ? (l.vatRate ?? 15) : 0;
      const lineVat = +(lineSubtotal * (vatRate / 100)).toFixed(2);
      subtotal += lineSubtotal;
      vatTotal += lineVat;
      return { ...l, lineSubtotal, lineVat, vatRate };
    });
    const total = +(subtotal + vatTotal).toFixed(2);

    const number = await this.nextNumber();

    const invoice = await this.db.insertReturning<any>(
      `INSERT INTO "__S__"."invoices"
       (number, customer_id, issue_date, due_date, status, subtotal, vat_total, total, is_tax_invoice)
       VALUES ($1,$2, COALESCE($3::date, current_date), $4::date, 'draft', $5::numeric, $6::numeric, $7::numeric, $8)
       RETURNING *`,
      [number, input.customerId, input.issueDate ?? null, input.dueDate ?? null,
       subtotal, vatTotal, total, isTaxInvoice],
    );

    for (const l of computed) {
      await this.db.exec(
        `INSERT INTO "__S__"."invoice_lines"
         (invoice_id, description, qty, unit_price, vat_rate, line_total)
         VALUES ($1,$2,$3::numeric,$4::numeric,$5::numeric,$6::numeric)`,
        [invoice.id, l.description, l.qty, l.unitPrice, l.vatRate,
         l.lineSubtotal + l.lineVat],
      );
    }
    return invoice;
  }

  async issueInvoice(id: string) {
    const inv = await this.getInvoice(id);
    if (inv.status === "issued" || inv.status === "paid") {
      throw new BadRequestException(`Invoice already ${inv.status}`);
    }
    // ZATCA: build UBL, hash-chain, sign, generate QR.
    const tenantId = this.ctx.getTenantId()!;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    await this.zatca.signAndChain(id, tenant?.name ?? "Seller", "300000000000003");

    await this.db.exec(`UPDATE "__S__"."invoices" SET status='issued' WHERE id=$1`, [id]);
    await this.accounting.postInvoiceIssued(id, Number(inv.subtotal), Number(inv.vat_total));
    return this.getInvoice(id);
  }

  async markPaid(id: string) {
    await this.db.exec(`UPDATE "__S__"."invoices" SET status='paid' WHERE id=$1`, [id]);
    const inv = await this.getInvoice(id);
    await this.accounting.postInvoicePaid(id, Number(inv.total));
    return inv;
  }

  private async nextNumber(): Promise<string> {
    const rows = await this.db.query<{ c: bigint }>(
      `SELECT COUNT(*)::bigint AS c FROM "__S__"."invoices"`);
    const n = Number(rows[0]?.c ?? 0) + 1;
    const year = new Date().getFullYear();
    return `INV-${year}-${String(n).padStart(5, "0")}`;
  }
}
