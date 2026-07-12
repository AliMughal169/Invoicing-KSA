import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";
import { AccountingService } from "../accounting/accounting.service";
import { ZatcaService } from "./zatca.service";
import { TenantContextService } from "../../tenancy/tenant-context.service";
import { PrismaService } from "../../core/database/prisma.service";

interface InvoiceLineInput {
  productId?: string;
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
    customFields?: Record<string, any>;
  }) {
    const payload = this.customerPayload(input);
    return this.db.insertReturning(
      `INSERT INTO "__S__"."customers"(
        name, company_name, customer_type, salutation, first_name, last_name, display_name, currency,
        email, vat_number, contact_person_name, company_phone, contact_person_phone,
        contact_person_phone_same_as_company, work_phone_country_code, personal_phone_country_code,
        work_phone, personal_phone, language, documents_json, remarks,
        shipping_address_json, billing_address_json, address, state, city, country, custom_fields
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28::jsonb) RETURNING *`,
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
    customFields?: Record<string, any>;
  }) {
    const payload = this.customerPayload(input);
    return this.db.insertReturning(
      `UPDATE "__S__"."customers" SET
        name=$1, company_name=$2, customer_type=$3, salutation=$4, first_name=$5, last_name=$6,
        display_name=$7, currency=$8, email=$9, vat_number=$10, contact_person_name=$11,
        company_phone=$12, contact_person_phone=$13, contact_person_phone_same_as_company=$14,
        work_phone_country_code=$15, personal_phone_country_code=$16, work_phone=$17, personal_phone=$18,
        language=$19, documents_json=$20, remarks=$21, shipping_address_json=$22, billing_address_json=$23,
        address=$24, state=$25, city=$26, country=$27, custom_fields=$28::jsonb
      WHERE id = $29 RETURNING *`,
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
    const [invoices, payments, comments, statement, quotations] = await Promise.all([
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
      this.db.query(
        `SELECT id, number, issue_date, due_date, status, subtotal, vat_total, total, currency, created_at
         FROM "__S__"."quotations" WHERE customer_id = $1 ORDER BY created_at DESC`,
        [id],
      ),
    ]);

    return {
      ...customer,
      documents: this.safeJson(customer.documents_json),
      billing_address: this.safeJson(customer.billing_address_json),
      shipping_address: this.safeJson(customer.shipping_address_json),
      custom_fields: customer.custom_fields ? (typeof customer.custom_fields === 'string' ? JSON.parse(customer.custom_fields) : customer.custom_fields) : {},
      invoices,
      payments,
      comments,
      statement,
      quotations,
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
    customFields?: Record<string, any>;
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
      JSON.stringify(input.customFields || {}),
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
    return this.db.query(`
      SELECT *,
             sales_price AS price_sar,
             name_en AS name,
             CASE WHEN tax_category = 'STANDARD' THEN 15.00 ELSE 0.00 END AS vat_rate
      FROM "__S__"."products"
      ORDER BY created_at DESC`);
  }
  async getProduct(id: string) {
    const rows = await this.db.query<any>(
      `SELECT *,
              sales_price AS price_sar,
              name_en AS name,
              CASE WHEN tax_category = 'STANDARD' THEN 15.00 ELSE 0.00 END AS vat_rate
       FROM "__S__"."products" WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException("Product not found");
    return rows[0];
  }
  createProduct(b: {
    nameEn: string;
    nameAr: string;
    sku: string;
    barcode?: string;
    imageUrl?: string;
    unit?: string;
    costPrice?: number;
    salesPrice?: number;
    taxCategory?: string;
    hsCode?: string;
    trackInventory?: boolean;
    qtyOnHand?: number;
    qtyReserved?: number;
    reorderLevel?: number;
    warehouseLocation?: string;
  }) {
    return this.db.insertReturning(
      `INSERT INTO "__S__"."products"
       (name_en, name_ar, sku, barcode, image_url, unit, cost_price, sales_price, tax_category, hs_code, track_inventory, qty_on_hand, qty_reserved, reorder_level, warehouse_location)
       VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric, $9, $10, $11, $12::numeric, $13::numeric, $14::numeric, $15)
       RETURNING *, sales_price AS price_sar, name_en AS name`,
      [
        b.nameEn,
        b.nameAr,
        b.sku,
        b.barcode ?? null,
        b.imageUrl ?? null,
        b.unit ?? "Pcs",
        b.costPrice ?? 0,
        b.salesPrice ?? 0,
        b.taxCategory ?? "STANDARD",
        b.hsCode ?? null,
        b.trackInventory ?? false,
        b.qtyOnHand ?? 0,
        b.qtyReserved ?? 0,
        b.reorderLevel ?? 0,
        b.warehouseLocation ?? null
      ]
    );
  }

  updateProduct(id: string, b: {
    nameEn?: string;
    nameAr?: string;
    sku?: string;
    barcode?: string;
    imageUrl?: string;
    unit?: string;
    costPrice?: number;
    salesPrice?: number;
    taxCategory?: string;
    hsCode?: string;
    trackInventory?: boolean;
    qtyOnHand?: number;
    qtyReserved?: number;
    reorderLevel?: number;
    warehouseLocation?: string;
  }) {
    return this.db.insertReturning(
      `UPDATE "__S__"."products"
       SET name_en = COALESCE($1, name_en),
           name_ar = COALESCE($2, name_ar),
           sku = COALESCE($3, sku),
           barcode = COALESCE($4, barcode),
           image_url = COALESCE($5, image_url),
           unit = COALESCE($6, unit),
           cost_price = COALESCE($7::numeric, cost_price),
           sales_price = COALESCE($8::numeric, sales_price),
           tax_category = COALESCE($9, tax_category),
           hs_code = COALESCE($10, hs_code),
           track_inventory = COALESCE($11, track_inventory),
           qty_on_hand = COALESCE($12::numeric, qty_on_hand),
           qty_reserved = COALESCE($13::numeric, qty_reserved),
           reorder_level = COALESCE($14::numeric, reorder_level),
           warehouse_location = COALESCE($15, warehouse_location)
       WHERE id = $16
       RETURNING *, sales_price AS price_sar, name_en AS name`,
      [
        b.nameEn ?? null,
        b.nameAr ?? null,
        b.sku ?? null,
        b.barcode ?? null,
        b.imageUrl ?? null,
        b.unit ?? null,
        b.costPrice ?? null,
        b.salesPrice ?? null,
        b.taxCategory ?? null,
        b.hsCode ?? null,
        b.trackInventory ?? null,
        b.qtyOnHand ?? null,
        b.qtyReserved ?? null,
        b.reorderLevel ?? null,
        b.warehouseLocation ?? null,
        id
      ]
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
    const inv = rows[0];
    const customFields = inv.custom_fields ? (typeof inv.custom_fields === 'string' ? JSON.parse(inv.custom_fields) : inv.custom_fields) : {};
    return { ...inv, custom_fields: customFields, lines };
  }

  async createInvoice(input: {
    customerId?: string;
    issueDate?: string;
    dueDate?: string;
    isTaxInvoice?: boolean;
    lines: InvoiceLineInput[];
    customFields?: Record<string, any>;
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
       (number, customer_id, issue_date, due_date, status, subtotal, vat_total, total, is_tax_invoice, custom_fields)
       VALUES ($1,$2, COALESCE($3::date, current_date), $4::date, 'draft', $5::numeric, $6::numeric, $7::numeric, $8, $9::jsonb)
       RETURNING *`,
      [number, input.customerId, input.issueDate ?? null, input.dueDate ?? null,
       subtotal, vatTotal, total, isTaxInvoice, JSON.stringify(input.customFields || {})],
    );

    for (const l of computed) {
      await this.db.exec(
        `INSERT INTO "__S__"."invoice_lines"
         (invoice_id, product_id, description, qty, unit_price, vat_rate, line_total)
         VALUES ($1,$2,$3,$4::numeric,$5::numeric,$6::numeric,$7::numeric)`,
        [invoice.id, l.productId || null, l.description, l.qty, l.unitPrice, l.vatRate,
         l.lineSubtotal + l.lineVat],
      );
      if (l.productId) {
        await this.db.exec(
          `UPDATE "__S__"."products"
           SET qty_reserved = qty_reserved + $1
           WHERE id = $2 AND track_inventory = true`,
          [l.qty, l.productId]
        );
      }
    }
    return invoice;
  }

  async issueInvoice(id: string) {
    const inv = await this.getInvoice(id);
    if (inv.status === "issued" || inv.status === "paid") {
      throw new BadRequestException(`Invoice already ${inv.status}`);
    }

    const schema = this.ctx.getSchema()!;
    await this.prisma.$transaction(async (tx) => {
      const query = async <T = any>(sql: string, params: any[] = []) => {
        return tx.$queryRawUnsafe<T[]>(sql.replace(/__S__/g, schema), ...params);
      };
      const exec = async (sql: string, params: any[] = []) => {
        return tx.$executeRawUnsafe(sql.replace(/__S__/g, schema), ...params);
      };

      const lines = await query(`SELECT * FROM "__S__"."invoice_lines" WHERE invoice_id = $1`, [id]);

      for (const l of lines) {
        if (l.product_id) {
          const pRows = await query(`SELECT * FROM "__S__"."products" WHERE id = $1`, [l.product_id]);
          if (pRows[0]) {
            const prod = pRows[0];
            const qty = Number(l.qty);
            if (prod.track_inventory) {
              const newQtyOnHand = Number(prod.qty_on_hand) - qty;
              if (newQtyOnHand < 0) {
                throw new BadRequestException(`Insufficient stock for product ${prod.name_en}`);
              }
              // Deduct qty_on_hand, and release qty_reserved
              await exec(
                `UPDATE "__S__"."products" 
                 SET qty_on_hand = qty_on_hand - $1,
                     qty_reserved = qty_reserved - $1
                 WHERE id = $2`,
                [qty, l.product_id]
              );
              // Log stock movement
              await exec(
                `INSERT INTO "__S__"."stock_movements" (product_id, quantity, type, reference_id)
                 VALUES ($1, $2::numeric, 'SALE', $3)`,
                [l.product_id, -qty, id]
              );
            }
          }
        }
      }

      await exec(`UPDATE "__S__"."invoices" SET status = 'issued', updated_at = now() WHERE id = $1`, [id]);
    });

    const tenantId = this.ctx.getTenantId()!;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    await this.zatca.signAndChain(id, tenant?.name ?? "Seller", "300000000000003");
    await this.accounting.postInvoiceIssued(id, Number(inv.subtotal), Number(inv.vat_total));
    return this.getInvoice(id);
  }

  async markPaid(id: string) {
    await this.db.exec(`UPDATE "__S__"."invoices" SET status='paid' WHERE id=$1`, [id]);
    const inv = await this.getInvoice(id);
    await this.accounting.postInvoicePaid(id, Number(inv.total));
    return inv;
  }

  async updateCustomerComment(customerId: string, commentId: string, body: string) {
    if (!body.trim()) throw new BadRequestException("Comment body is required");
    const res = await this.db.query(
      `UPDATE "__S__"."customer_comments" SET body=$1 WHERE id=$2 AND customer_id=$3 RETURNING *`,
      [body, commentId, customerId]
    );
    if (!res[0]) throw new NotFoundException("Comment not found");
    return res[0];
  }

  async deleteCustomerComment(customerId: string, commentId: string) {
    const res = await this.db.query(
      `DELETE FROM "__S__"."customer_comments" WHERE id=$1 AND customer_id=$2 RETURNING *`,
      [commentId, customerId]
    );
    if (!res[0]) throw new NotFoundException("Comment not found");
    return { ok: true };
  }

  async createProformaInvoice(input: {
    customerId?: string;
    issueDate?: string;
    dueDate?: string;
    isTaxInvoice?: boolean;
    lines: InvoiceLineInput[];
    customFields?: Record<string, any>;
  }) {
    if (!input.lines?.length) throw new BadRequestException("At least one line is required");

    const isTaxInvoice = input.isTaxInvoice !== false;
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

    const number = await this.nextProformaNumber();

    const invoice = await this.db.insertReturning<any>(
      `INSERT INTO "__S__"."invoices"
       (number, customer_id, issue_date, due_date, status, subtotal, vat_total, total, is_tax_invoice, custom_fields)
       VALUES ($1,$2, COALESCE($3::date, current_date), $4::date, 'PROFORMA', $5::numeric, $6::numeric, $7::numeric, $8, $9::jsonb)
       RETURNING *`,
      [number, input.customerId, input.issueDate ?? null, input.dueDate ?? null,
       subtotal, vatTotal, total, isTaxInvoice, JSON.stringify(input.customFields || {})],
    );

    for (const l of computed) {
      await this.db.exec(
        `INSERT INTO "__S__"."invoice_lines"
         (invoice_id, product_id, description, qty, unit_price, vat_rate, line_total)
         VALUES ($1,$2,$3,$4::numeric,$5::numeric,$6::numeric,$7::numeric)`,
        [invoice.id, l.productId || null, l.description, l.qty, l.unitPrice, l.vatRate,
         l.lineSubtotal + l.lineVat],
      );
      if (l.productId) {
        await this.db.exec(
          `UPDATE "__S__"."products"
           SET qty_reserved = qty_reserved + $1
           WHERE id = $2 AND track_inventory = true`,
          [l.qty, l.productId]
        );
      }
    }
    return invoice;
  }

  async convertQuotationToProforma(quotationId: string) {
    const rows = await this.db.query<any>(
      `SELECT * FROM "__S__"."quotations" WHERE id = $1`, [quotationId]);
    if (!rows[0]) throw new NotFoundException("Quotation not found");
    const q = rows[0];

    if (q.status === "invoiced") {
      throw new BadRequestException("Quotation already converted");
    }

    const lines = await this.db.query<any>(
      `SELECT * FROM "__S__"."quotation_lines" WHERE quotation_id = $1`, [quotationId]);

    const isTaxInvoice = lines.some((l: any) => Number(l.vat_rate) > 0);
    const customFields = q.custom_fields ? (typeof q.custom_fields === 'string' ? JSON.parse(q.custom_fields) : q.custom_fields) : {};

    const invoice = await this.createProformaInvoice({
      customerId: q.customer_id,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: q.due_date ? new Date(q.due_date).toISOString().slice(0, 10) : undefined,
      isTaxInvoice,
      customFields,
      lines: lines.map((l: any) => ({
        productId: l.product_id,
        description: l.description,
        qty: Number(l.qty),
        unitPrice: Number(l.unit_price),
        vatRate: Number(l.vat_rate),
      })),
    });

    await this.db.exec(
      `UPDATE "__S__"."quotations" SET status = 'invoiced', converted_to_invoice_id = $1, updated_at = now() WHERE id = $2`,
      [invoice.id, quotationId],
    );

    return invoice;
  }

  async convertProformaToTaxInvoice(id: string, targetStatus: "draft" | "issued" = "draft") {
    const inv = await this.getInvoice(id);
    if (inv.status !== "PROFORMA") {
      throw new BadRequestException("Invoice is not a proforma invoice");
    }

    const number = await this.nextNumber();

    const schema = this.ctx.getSchema()!;
    await this.prisma.$transaction(async (tx) => {
      const query = async <T = any>(sql: string, params: any[] = []) => {
        return tx.$queryRawUnsafe<T[]>(sql.replace(/__S__/g, schema), ...params);
      };
      
      const exec = async (sql: string, params: any[] = []) => {
        return tx.$executeRawUnsafe(sql.replace(/__S__/g, schema), ...params);
      };

      const lines = await query(`SELECT * FROM "__S__"."invoice_lines" WHERE invoice_id = $1`, [id]);

      if (targetStatus === "issued") {
        for (const l of lines) {
          if (l.product_id) {
            const pRows = await query(`SELECT * FROM "__S__"."products" WHERE id = $1`, [l.product_id]);
            if (pRows[0]) {
              const prod = pRows[0];
              const qty = Number(l.qty);
              if (prod.track_inventory) {
                const newQtyOnHand = Number(prod.qty_on_hand) - qty;
                if (newQtyOnHand < 0) {
                  throw new BadRequestException(`Insufficient stock for product ${prod.name_en}`);
                }
              }
              await exec(
                `UPDATE "__S__"."products" 
                 SET qty_on_hand = CASE WHEN track_inventory THEN qty_on_hand - $1 ELSE qty_on_hand END,
                     qty_reserved = qty_reserved - $1
                 WHERE id = $2`,
                [qty, l.product_id]
              );
              await exec(
                `INSERT INTO "__S__"."stock_movements" (product_id, quantity, type, reference_id)
                 VALUES ($1, $2::numeric, 'SALE', $3)`,
                [l.product_id, -qty, id]
              );
            }
          }
        }
      }

      const customFields = inv.custom_fields ? (typeof inv.custom_fields === 'string' ? JSON.parse(inv.custom_fields) : inv.custom_fields) : {};
      customFields.wasProforma = true;

      await exec(
        `UPDATE "__S__"."invoices" 
         SET status = $1, number = $2, custom_fields = $3::jsonb, updated_at = now() 
         WHERE id = $4`,
        [targetStatus, number, JSON.stringify(customFields), id]
      );
    });

    if (targetStatus === "issued") {
      const tenantId = this.ctx.getTenantId()!;
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      await this.zatca.signAndChain(id, tenant?.name ?? "Seller", "300000000000003");
      await this.accounting.postInvoiceIssued(id, Number(inv.subtotal), Number(inv.vat_total));
    }

    return this.getInvoice(id);
  }

  private async nextNumber(): Promise<string> {
    const rows = await this.db.query<{ c: bigint }>(
      `SELECT COUNT(*)::bigint AS c FROM "__S__"."invoices" WHERE status <> 'PROFORMA'`);
    const n = Number(rows[0]?.c ?? 0) + 1;
    const year = new Date().getFullYear();
    return `INV-${year}-${String(n).padStart(5, "0")}`;
  }

  private async nextProformaNumber(): Promise<string> {
    const rows = await this.db.query<{ c: bigint }>(
      `SELECT COUNT(*)::bigint AS c FROM "__S__"."invoices" WHERE status = 'PROFORMA'`);
    const n = Number(rows[0]?.c ?? 0) + 1;
    const year = new Date().getFullYear();
    return `PROF-${year}-${String(n).padStart(5, "0")}`;
  }
}
