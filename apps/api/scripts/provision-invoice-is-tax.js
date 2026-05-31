const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function ensureIsTaxInvoice(schema) {
  const statements = [
    `ALTER TABLE "${schema}"."invoices" ADD COLUMN IF NOT EXISTS is_tax_invoice boolean NOT NULL DEFAULT true`,
    // Optionally set existing rows to true if null
    `UPDATE "${schema}"."invoices" SET is_tax_invoice = true WHERE is_tax_invoice IS NULL`,
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
}

async function main() {
  console.log("Loading tenants from public.tenants...");
  const tenants = await prisma.tenant.findMany();

  for (const tenant of tenants) {
    try {
      process.stdout.write(`Ensuring is_tax_invoice for schema ${tenant.schema}... `);
      await ensureIsTaxInvoice(tenant.schema);
      console.log("OK");
    } catch (err) {
      console.error(`FAILED for ${tenant.schema}:`, err.message || err);
    }
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
