const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function ensureVendorsAndBills(schema) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "${schema}"."vendors" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name text NOT NULL, vat_number text, email text, phone text,
      address text, city text, country text,
      created_at timestamptz DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${schema}"."bills" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      number text NOT NULL,
      vendor_id text REFERENCES "${schema}"."vendors"(id) ON DELETE SET NULL,
      bill_date date NOT NULL DEFAULT current_date,
      due_date date,
      status text NOT NULL DEFAULT 'draft',
      subtotal numeric(14,2) NOT NULL DEFAULT 0,
      vat_total numeric(14,2) NOT NULL DEFAULT 0,
      total numeric(14,2) NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'SAR',
      reference text, notes text,
      created_at timestamptz DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${schema}"."bill_lines" (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      bill_id text NOT NULL REFERENCES "${schema}"."bills"(id) ON DELETE CASCADE,
      description text NOT NULL,
      qty numeric(14,2) NOT NULL DEFAULT 1,
      unit_price numeric(14,2) NOT NULL DEFAULT 0,
      vat_rate numeric(5,2) NOT NULL DEFAULT 15.00,
      line_total numeric(14,2) NOT NULL DEFAULT 0,
      expense_account_id text REFERENCES "${schema}"."accounts"(id))`,
    `INSERT INTO "${schema}"."accounts" (code, name, type) VALUES
      ('1400','Input VAT','asset'),
      ('2200','Accounts Payable','liability'),
      ('5100','Rent Expense','expense'),
      ('5200','Salaries Expense','expense'),
      ('5300','Utilities Expense','expense'),
      ('5400','Travel & Entertainment','expense'),
      ('5500','Office Supplies','expense'),
      ('5600','Professional Fees','expense'),
      ('5700','Bank Charges','expense'),
      ('5900','Other Operating Expense','expense')
      ON CONFLICT (code) DO NOTHING`,
  ];
  for (const sql of statements) await prisma.$executeRawUnsafe(sql);
}

async function main() {
  const tenants = await prisma.tenant.findMany();
  for (const t of tenants) {
    process.stdout.write(`Provisioning vendors/bills for ${t.schema}... `);
    try { await ensureVendorsAndBills(t.schema); console.log("OK"); }
    catch (e) { console.error("FAIL", e.message || e); }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
