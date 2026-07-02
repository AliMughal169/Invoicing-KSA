const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigrationForSchema(schema) {
  // 1. Create settings table
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "${schema}"."settings" (
    id text PRIMARY KEY DEFAULT 'default',
    company_name_en text,
    company_name_ar text,
    cr_number text,
    vat_number text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    country text,
    postal_code text,
    company_logo_url text,
    letterhead_url text,
    top_margin integer DEFAULT 0,
    bottom_margin integer DEFAULT 0,
    print_on_letterhead boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`);

  // 2. Seed settings
  await prisma.$executeRawUnsafe(`INSERT INTO "${schema}"."settings" (id) VALUES ('default') ON CONFLICT DO NOTHING`);

  // 3. Alter settings table for layout columns
  await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."settings" ADD COLUMN IF NOT EXISTS top_margin integer DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."settings" ADD COLUMN IF NOT EXISTS bottom_margin integer DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."settings" ADD COLUMN IF NOT EXISTS print_on_letterhead boolean DEFAULT false`);

  // 4. Create custom_field_definitions table
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "${schema}"."custom_field_definitions" (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    entity_type text NOT NULL,
    field_key text NOT NULL,
    field_label text NOT NULL,
    field_type text NOT NULL,
    is_required boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT custom_field_definitions_entity_key_unique_${schema.replace(/[^a-zA-Z0-9]/g, '_')} UNIQUE (entity_type, field_key)
  )`);

  // 5. Alter columns
  await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."invoices" ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."quotations" ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."customers" ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb`);
}

async function main() {
  console.log('Loading tenants from public schema...');
  const tenants = await prisma.tenant.findMany();
  if (!tenants.length) {
    console.log('No tenants found.');
  }

  for (const t of tenants) {
    const schema = t.schema;
    try {
      process.stdout.write(`Ensuring settings and custom fields tables/columns for schema ${schema}... `);
      await runMigrationForSchema(schema);
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
