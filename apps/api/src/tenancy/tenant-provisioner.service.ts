import { Injectable } from "@nestjs/common";
import { PrismaService } from "../core/database/prisma.service";

@Injectable()
export class TenantProvisionerService {
  constructor(private readonly prisma: PrismaService) {}

  schemaNameFor(slug: string): string {
    const safe = slug.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
    return `tenant_${safe}`;
  }

  async provision(schema: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    const q = (sql: string) => this.prisma.$executeRawUnsafe(sql.replace(/__S__/g, schema));

    await q(`CREATE TABLE IF NOT EXISTS "__S__"."_meta" (
      key text PRIMARY KEY, value text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now())`);

    // CRM
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."companies" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name text NOT NULL, vat_number text, created_at timestamptz DEFAULT now())`);
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."contacts" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name text NOT NULL, email text, phone text,
      company_id text REFERENCES "__S__"."companies"(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now())`);
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."opportunities" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name text NOT NULL,
      contact_id text REFERENCES "__S__"."contacts"(id) ON DELETE SET NULL,
      stage text NOT NULL DEFAULT 'new',
      amount_sar numeric(14,2) NOT NULL DEFAULT 0,
      expected_close date, created_at timestamptz DEFAULT now())`);

    // Tasks & Due Date Tracking
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."tasks" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      title text NOT NULL,
      description text,
      due_date date NOT NULL,
      completed_at timestamptz,
      status text NOT NULL DEFAULT 'open',
      priority text NOT NULL DEFAULT 'medium',
      related_type text,
      related_id text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now())`);

    // Invoicing
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."customers" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name text NOT NULL,
      company_name text,
      customer_type text NOT NULL DEFAULT 'business',
      salutation text,
      first_name text,
      last_name text,
      display_name text,
      currency text NOT NULL DEFAULT 'SAR',
      email text,
      vat_number text,
      contact_person_name text,
      company_phone text,
      contact_person_phone text,
      contact_person_phone_same_as_company boolean NOT NULL DEFAULT true,
      work_phone_country_code text,
      personal_phone_country_code text,
      work_phone text,
      personal_phone text,
      language text,
      documents_json text,
      remarks text,
      shipping_address_json text,
      billing_address_json text,
      address text,
      state text,
      city text,
      country text,
      created_at timestamptz DEFAULT now())`);
    for (const col of [
      "company_name text",
      "customer_type text NOT NULL DEFAULT 'business'",
      "salutation text",
      "first_name text",
      "last_name text",
      "display_name text",
      "currency text NOT NULL DEFAULT 'SAR'",
      "contact_person_name text",
      "company_phone text",
      "contact_person_phone text",
      "contact_person_phone_same_as_company boolean NOT NULL DEFAULT true",
      "work_phone_country_code text",
      "personal_phone_country_code text",
      "work_phone text",
      "personal_phone text",
      "language text",
      "documents_json text",
      "remarks text",
      "shipping_address_json text",
      "billing_address_json text",
      "address text",
      "state text",
      "city text",
      "country text",
    ]) {
      await q(`ALTER TABLE "__S__"."customers" ADD COLUMN IF NOT EXISTS ${col}`);
    }
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."customer_comments" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      customer_id text NOT NULL REFERENCES "__S__"."customers"(id) ON DELETE CASCADE,
      body text NOT NULL,
      created_at timestamptz DEFAULT now())`);
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."products" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      sku text, name text NOT NULL,
      price_sar numeric(14,2) NOT NULL DEFAULT 0,
      vat_rate numeric(5,2) NOT NULL DEFAULT 15.00,
      created_at timestamptz DEFAULT now())`);
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."invoices" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      number text NOT NULL,
      customer_id text REFERENCES "__S__"."customers"(id) ON DELETE SET NULL,
      issue_date date NOT NULL DEFAULT current_date,
      due_date date,
      status text NOT NULL DEFAULT 'draft',
      subtotal numeric(14,2) NOT NULL DEFAULT 0,
      vat_total numeric(14,2) NOT NULL DEFAULT 0,
      total numeric(14,2) NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'SAR',
      is_tax_invoice boolean NOT NULL DEFAULT true,
      zatca_uuid text,
      zatca_hash text,
      zatca_prev_hash text,
      zatca_qr text,
      zatca_xml text,
      zatca_signed_at timestamptz,
      created_at timestamptz DEFAULT now())`);
    // Backfill ZATCA columns for tenants provisioned before this column set.
    for (const col of [
      "is_tax_invoice boolean NOT NULL DEFAULT true",
      "zatca_uuid text",
      "zatca_hash text",
      "zatca_prev_hash text",
      "zatca_qr text",
      "zatca_xml text",
      "zatca_signed_at timestamptz",
    ]) {
      await q(`ALTER TABLE "__S__"."invoices" ADD COLUMN IF NOT EXISTS ${col}`);
    }
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."invoice_lines" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      invoice_id text NOT NULL REFERENCES "__S__"."invoices"(id) ON DELETE CASCADE,
      description text NOT NULL,
      qty numeric(14,2) NOT NULL DEFAULT 1,
      unit_price numeric(14,2) NOT NULL DEFAULT 0,
      vat_rate numeric(5,2) NOT NULL DEFAULT 15.00,
      line_total numeric(14,2) NOT NULL DEFAULT 0)`);

    // Vendors + Bills (AP side)
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."vendors" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name text NOT NULL,
      vat_number text,
      email text,
      phone text,
      address text,
      city text,
      country text,
      created_at timestamptz DEFAULT now())`);

    await q(`CREATE TABLE IF NOT EXISTS "__S__"."bills" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      number text NOT NULL,
      vendor_id text REFERENCES "__S__"."vendors"(id) ON DELETE SET NULL,
      bill_date date NOT NULL DEFAULT current_date,
      due_date date,
      status text NOT NULL DEFAULT 'draft',
      subtotal numeric(14,2) NOT NULL DEFAULT 0,
      vat_total numeric(14,2) NOT NULL DEFAULT 0,
      total numeric(14,2) NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'SAR',
      reference text,
      notes text,
      created_at timestamptz DEFAULT now())`);

    // Accounting
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."accounts" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      code text UNIQUE NOT NULL, name text NOT NULL, type text NOT NULL)`);
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."journal_entries" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      entry_date date NOT NULL DEFAULT current_date,
      memo text, source_type text, source_id text,
      created_at timestamptz DEFAULT now())`);
    await q(`CREATE TABLE IF NOT EXISTS "__S__"."journal_lines" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      je_id text NOT NULL REFERENCES "__S__"."journal_entries"(id) ON DELETE CASCADE,
      account_id text NOT NULL REFERENCES "__S__"."accounts"(id),
      debit numeric(14,2) NOT NULL DEFAULT 0,
      credit numeric(14,2) NOT NULL DEFAULT 0)`);

    // Seed KSA Chart of Accounts (expanded)
    await q(`INSERT INTO "__S__"."accounts" (code, name, type) VALUES
      ('1000','Cash','asset'),
      ('1100','Accounts Receivable','asset'),
      ('1400','Input VAT','asset'),
      ('2100','VAT Payable','liability'),
      ('2200','Accounts Payable','liability'),
      ('4000','Sales Revenue','revenue'),
      ('5000','Cost of Sales','expense'),
      ('5100','Rent Expense','expense'),
      ('5200','Salaries Expense','expense'),
      ('5300','Utilities Expense','expense'),
      ('5400','Travel & Entertainment','expense'),
      ('5500','Office Supplies','expense'),
      ('5600','Professional Fees','expense'),
      ('5700','Bank Charges','expense'),
      ('5900','Other Operating Expense','expense')
      ON CONFLICT (code) DO NOTHING`);

    await q(`CREATE TABLE IF NOT EXISTS "__S__"."bill_lines" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      bill_id text NOT NULL REFERENCES "__S__"."bills"(id) ON DELETE CASCADE,
      description text NOT NULL,
      qty numeric(14,2) NOT NULL DEFAULT 1,
      unit_price numeric(14,2) NOT NULL DEFAULT 0,
      vat_rate numeric(5,2) NOT NULL DEFAULT 15.00,
      line_total numeric(14,2) NOT NULL DEFAULT 0,
      expense_account_id text REFERENCES "__S__"."accounts"(id))`);

    await q(`INSERT INTO "__S__"."_meta" (key, value) VALUES ('provisioned_at', now()::text)
      ON CONFLICT (key) DO NOTHING`);
  }

  async drop(schema: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
}
