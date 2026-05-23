const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function ensureTasksTable(schema) {
  const sql = `CREATE TABLE IF NOT EXISTS "${schema}"."tasks" (
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
    updated_at timestamptz DEFAULT now()
  )`;
  await prisma.$executeRawUnsafe(sql);
}

async function main() {
  console.log('Loading tenants from public schema...');
  const tenants = await prisma.tenant.findMany();
  if (!tenants.length) {
    console.log('No tenants found in public.tenants. If you provision tenants differently, run provision for each schema manually.');
  }

  for (const t of tenants) {
    const schema = t.schema;
    try {
      process.stdout.write(`Ensuring tasks table for schema ${schema}... `);
      await ensureTasksTable(schema);
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
