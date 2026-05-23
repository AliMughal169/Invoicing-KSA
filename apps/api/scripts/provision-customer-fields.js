const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function ensureCustomerColumns(schema) {
  const statements = [
    `ALTER TABLE "${schema}"."customers" ADD COLUMN IF NOT EXISTS contact_person_name text`,
    `ALTER TABLE "${schema}"."customers" ADD COLUMN IF NOT EXISTS company_phone text`,
    `ALTER TABLE "${schema}"."customers" ADD COLUMN IF NOT EXISTS contact_person_phone text`,
    `ALTER TABLE "${schema}"."customers" ADD COLUMN IF NOT EXISTS contact_person_phone_same_as_company boolean NOT NULL DEFAULT true`,
    `ALTER TABLE "${schema}"."customers" ADD COLUMN IF NOT EXISTS address text`,
    `ALTER TABLE "${schema}"."customers" ADD COLUMN IF NOT EXISTS state text`,
    `ALTER TABLE "${schema}"."customers" ADD COLUMN IF NOT EXISTS city text`,
    `ALTER TABLE "${schema}"."customers" ADD COLUMN IF NOT EXISTS country text`,
    `UPDATE "${schema}"."customers"
     SET contact_person_phone = company_phone
     WHERE (contact_person_phone IS NULL OR contact_person_phone = '') AND company_phone IS NOT NULL`,
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
      process.stdout.write(`Ensuring customer fields for schema ${tenant.schema}... `);
      await ensureCustomerColumns(tenant.schema);
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
