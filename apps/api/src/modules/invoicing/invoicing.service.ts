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
    return this.db.query(`
      SELECT c.*,
             COALESCE(inv.total_invoiced, 0)::numeric AS total_invoiced,
             COALESCE(inv.outstanding_balance, 0)::numeric AS outstanding_balance,
             COALESCE(inv.invoice_count, 0)::int AS invoice_count,
             COALESCE(pay.total_received, 0)::numeric AS total_received,
             COALESCE(pay.payment_count, 0)::int AS payment_count,
             inv.last_invoice_at
      FROM "__S__"."customers" c
      LEFT JOIN (
        SELECT customer_id,
               COUNT(*)::int AS invoice_count,
               SUM(total)::numeric AS total_invoiced,
               SUM(CASE WHEN status <> 'paid' THEN total ELSE 0 END)::numeric AS outstanding_balance,
               MAX(created_at) AS last_invoice_at
        FROM "__S__"."invoices"
        GROUP BY customer_id
      ) inv ON inv.customer_id = c.id
      LEFT JOIN (
        SELECT i.customer_id,
               COUNT(*)::int AS payment_count,
               SUM(i.total)::numeric AS total_received
        FROM "__S__"."journal_entries" je
        JOIN "__S__"."invoices" i ON i.id = je.source_id
        WHERE je.source_type = 'payment'
        GROUP BY i.customer_id
      ) pay ON pay.customer_id = c.id
      ORDER BY c.created_at DESC`);
  }

  createCustomer(input: {
    name: string;
    companyName?: string;
    customerType?: string;
    salutation?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    currency?: string;
    email?: string;
    vatNumber?: string;
    contactPersonName?: string;
    companyPhone?: string;
    contactPersonPhone?: string;
    contactPersonPhoneSameAsCompany?: boolean;
    workPhoneCountryCode?: string;
    personalPhoneCountryCode?: string;
    workPhone?: string;
    personalPhone?: string;
    language?: string;
    documents?: { name: string; size?: number; type?: string; lastModified?: number }[];
    remarks?: string;
    shippingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    billingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    address?: string;
    state?: string;
    city?: string;
    country?: string;
  }) {
    const payload = this.customerPayload(input);
    return this.db.insertReturning(
      `INSERT INTO "__S__"."customers"(
        name, company_name, customer_type, salutation, first_name, last_name, display_name, currency,
        email, vat_number, contact_person_name, company_phone, contact_person_phone,
        contact_person_phone_same_as_company, work_phone_country_code, personal_phone_country_code,
        work_phone, personal_phone, language, documents_json, remarks,
        shipping_address_json, billing_address_json, address, state, city, country
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING *`,
      payload,
    );
  }

  getCustomer(id: string) {
    return this.customerDetail(id);
  }

  async updateCustomer(id: string, input: {
    name?: string;
    companyName?: string;
    customerType?: string;
    salutation?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    currency?: string;
    email?: string;
    vatNumber?: string;
    contactPersonName?: string;
    companyPhone?: string;
    contactPersonPhone?: string;
    contactPersonPhoneSameAsCompany?: boolean;
    workPhoneCountryCode?: string;
    personalPhoneCountryCode?: string;
    workPhone?: string;
    personalPhone?: string;
    language?: string;
    documents?: { name: string; size?: number; type?: string; lastModified?: number }[];
    remarks?: string;
    shippingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    billingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    address?: string;
    state?: string;
    city?: string;
    country?: string;
  }) {
    const payload = this.customerPayload(input);
    return this.db.insertReturning(
      `UPDATE "__S__"."customers" SET
        name=$1, company_name=$2, customer_type=$3, salutation=$4, first_name=$5, last_name=$6,
        display_name=$7, currency=$8, email=$9, vat_number=$10, contact_person_name=$11,
        company_phone=$12, contact_person_phone=$13, contact_person_phone_same_as_company=$14,
        work_phone_country_code=$15, personal_phone_country_code=$16, work_phone=$17, personal_phone=$18,
        language=$19, documents_json=$20, remarks=$21, shipping_address_json=$22, billing_address_json=$23,
        address=$24, state=$25, city=$26, country=$27
      WHERE id = $28 RETURNING *`,
      [...payload, id],
    );
  }

  async deleteCustomer(id: string) {
    await this.db.exec(`DELETE FROM "__S__"."customers" WHERE id = $1`, [id]);
    return { ok: true };
  }

  async addCustomerComment(customerId: string, body: string) {
    if (!body.trim()) throw new BadRequestException("Comment body is required");
    return this.db.insertReturning(
      `INSERT INTO "__S__"."customer_comments"(customer_id, body) VALUES ($1,$2) RETURNING *`,
      [customerId, body.trim()],
    );
  }

  async customerComments(customerId: string) {
    return this.db.query(`SELECT * FROM "__S__"."customer_comments" WHERE customer_id = $1 ORDER BY created_at DESC`, [customerId]);
  }

  async customerStatement(customerId: string) {
    return this.db.query(`
      SELECT * FROM (
        SELECT i.created_at AS sort_at,
               i.issue_date::date AS entry_date,
               i.id,
               'invoice' AS kind,
               i.number AS reference,
               i.status,
               i.total::numeric AS amount,
               i.total::numeric AS balance_delta,
               i.currency,
               i.subtotal::numeric AS subtotal,
               i.vat_total::numeric AS vat_total,
               'Invoice issued' AS description
        FROM "__S__"."invoices" i
        WHERE i.customer_id = $1
        UNION ALL
        SELECT je.created_at AS sort_at,
               i.issue_date::date AS entry_date,
               je.id,
               'payment' AS kind,
               i.number AS reference,
               i.status,
               (-i.total)::numeric AS amount,
               (-i.total)::numeric AS balance_delta,
               i.currency,
               NULL::numeric AS subtotal,
               NULL::numeric AS vat_total,
               'Payment received' AS description
        FROM "__S__"."journal_entries" je
        JOIN "__S__"."invoices" i ON i.id = je.source_id
        WHERE je.source_type = 'payment' AND i.customer_id = $1
      ) s
      ORDER BY sort_at ASC, kind ASC`, [customerId]);
  }

  private async customerDetail(id: string) {
    const rows = await this.db.query<any>(`
      SELECT c.*,
             COALESCE(inv.total_invoiced, 0)::numeric AS total_invoiced,
             COALESCE(inv.outstanding_balance, 0)::numeric AS outstanding_balance,
             COALESCE(inv.invoice_count, 0)::int AS invoice_count,
             COALESCE(pay.total_received, 0)::numeric AS total_received,
             COALESCE(pay.payment_count, 0)::int AS payment_count,
             inv.last_invoice_at
      FROM "__S__"."customers" c
      LEFT JOIN (
        SELECT customer_id,
               COUNT(*)::int AS invoice_count,
               SUM(total)::numeric AS total_invoiced,
               SUM(CASE WHEN status <> 'paid' THEN total ELSE 0 END)::numeric AS outstanding_balance,
               MAX(created_at) AS last_invoice_at
        FROM "__S__"."invoices"
        GROUP BY customer_id
      ) inv ON inv.customer_id = c.id
      LEFT JOIN (
        SELECT i.customer_id,
               COUNT(*)::int AS payment_count,
               SUM(i.total)::numeric AS total_received
        FROM "__S__"."journal_entries" je
        JOIN "__S__"."invoices" i ON i.id = je.source_id
        WHERE je.source_type = 'payment'
        GROUP BY i.customer_id
      ) pay ON pay.customer_id = c.id
      WHERE c.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException("Customer not found");

    const customer = rows[0];
    const [invoices, payments, comments, statement] = await Promise.all([
      this.db.query(
        `SELECT id, number, issue_date, due_date, status, subtotal, vat_total, total, currency, created_at
         FROM "__S__"."invoices" WHERE customer_id = $1 ORDER BY created_at DESC`,
        [id],
      ),
      this.db.query(
        `SELECT je.id, je.created_at, je.entry_date, je.memo, i.id AS invoice_id, i.number AS invoice_number, i.total AS invoice_total, i.status AS invoice_status
         FROM "__S__"."journal_entries" je
         JOIN "__S__"."invoices" i ON i.id = je.source_id
         WHERE je.source_type = 'payment' AND i.customer_id = $1
         ORDER BY je.created_at DESC`,
        [id],
      ),
      this.customerComments(id),
      this.customerStatement(id),
    ]);

    return {
      ...customer,
      documents: this.safeJson(customer.documents_json),
      billing_address: this.safeJson(customer.billing_address_json),
      shipping_address: this.safeJson(customer.shipping_address_json),
      invoices,
      payments,
      comments,
      statement,
    };
  }

  private customerPayload(input: {
    name?: string;
    companyName?: string;
    customerType?: string;
    salutation?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    currency?: string;
    email?: string;
    vatNumber?: string;
    contactPersonName?: string;
    companyPhone?: string;
    contactPersonPhone?: string;
    contactPersonPhoneSameAsCompany?: boolean;
    workPhoneCountryCode?: string;
    personalPhoneCountryCode?: string;
    workPhone?: string;
    personalPhone?: string;
    language?: string;
    documents?: { name: string; size?: number; type?: string; lastModified?: number }[];
    remarks?: string;
    shippingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    billingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    address?: string;
    state?: string;
    city?: string;
    country?: string;
  }) {
    const primaryContact = [input.salutation, input.firstName, input.lastName].filter(Boolean).join(" ").trim();
    const displayName = input.displayName ?? input.name ?? input.companyName ?? primaryContact ?? "Customer";
    const companyName = input.companyName ?? (input.customerType === "individual" ? null : input.name ?? null);
    const workPhone = input.workPhone ?? input.companyPhone ?? null;
    const personalPhone = input.personalPhone ?? input.contactPersonPhone ?? null;
    const sameAsWork = input.contactPersonPhoneSameAsCompany ?? false;
    const resolvedPersonalPhone = sameAsWork ? workPhone : personalPhone;
    const billingAddress = input.billingAddress ?? this.legacyAddress(input.address, input.city, input.state, input.country);
    const shippingAddress = input.shippingAddress ?? null;

    return [
      displayName || companyName || primaryContact || "",
      companyName,
      input.customerType ?? "business",
      input.salutation ?? null,
      input.firstName ?? null,
      input.lastName ?? null,
      displayName || companyName || primaryContact || "",
      input.currency ?? "SAR",
      input.email ?? null,
      input.vatNumber ?? null,
      (primaryContact || input.contactPersonName) ?? null,
      workPhone,
      resolvedPersonalPhone,
      sameAsWork,
      input.workPhoneCountryCode ?? null,
      input.personalPhoneCountryCode ?? null,
      workPhone,
      resolvedPersonalPhone,
      input.language ?? null,
      input.documents ? JSON.stringify(input.documents) : null,
      input.remarks ?? null,
      shippingAddress ? JSON.stringify(shippingAddress) : null,
      billingAddress ? JSON.stringify(billingAddress) : null,
      billingAddress?.line1 ?? input.address ?? null,
      billingAddress?.state ?? input.state ?? null,
      billingAddress?.city ?? input.city ?? null,
      billingAddress?.country ?? input.country ?? null,
    ];
  }

  private legacyAddress(address?: string, city?: string, state?: string, country?: string) {
    if (!address && !city && !state && !country) return null;
    return { line1: address ?? "", city: city ?? "", state: state ?? "", country: country ?? "" };
  }

  private safeJson(value?: string | null) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
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
