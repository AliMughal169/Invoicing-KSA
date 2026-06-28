const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function ensureQuotationsTables(schema) {
  // Ensure quotations table exists
  const createQuotationsSql = `CREATE TABLE IF NOT EXISTS "${schema}"."quotations" (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    number text NOT NULL,
    customer_id text REFERENCES "${schema}"."customers"(id) ON DELETE SET NULL,
    issue_date date NOT NULL DEFAULT current_date,
    due_date date,
    status text NOT NULL DEFAULT 'draft',
    subtotal numeric(14,2) NOT NULL DEFAULT 0,
    vat_total numeric(14,2) NOT NULL DEFAULT 0,
    total numeric(14,2) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'SAR',
    converted_to_invoice_id text REFERENCES "${schema}"."invoices"(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`;
  await prisma.$executeRawUnsafe(createQuotationsSql);

  // Ensure quotation_lines table exists
  const createQuotationLinesSql = `CREATE TABLE IF NOT EXISTS "${schema}"."quotation_lines" (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    quotation_id text NOT NULL REFERENCES "${schema}"."quotations"(id) ON DELETE CASCADE,
    description text NOT NULL,
    qty numeric(14,2) NOT NULL DEFAULT 1,
    unit_price numeric(14,2) NOT NULL DEFAULT 0,
    vat_rate numeric(5,2) NOT NULL DEFAULT 15.00,
    line_total numeric(14,2) NOT NULL DEFAULT 0
  )`;
  await prisma.$executeRawUnsafe(createQuotationLinesSql);
}

async function main() {
  console.log('Loading tenants from public schema...');
  const tenants = await prisma.tenant.findMany();
  if (!tenants.length) {
    console.log('No tenants found in public.tenants.');
  }

  for (const t of tenants) {
    const schema = t.schema;
    try {
      process.stdout.write(`Ensuring quotations tables for schema ${schema}... `);
      await ensureQuotationsTables(schema);
      console.log('OK');
    } catch (err) {
      console.error(`FAILED for ${schema}:`, err.message || err);
    }
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
