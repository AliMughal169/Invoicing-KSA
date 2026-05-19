import { Injectable } from "@nestjs/common";
import { PrismaService } from "../core/database/prisma.service";

/**
 * Provisions a dedicated Postgres schema for a tenant.
 * The `public` schema holds platform tables (tenants/users/members),
 * while each tenant gets its own schema for business data.
 *
 * The MVP creates the schema and a minimal `_meta` table as a marker.
 * Real business tables (crm, invoicing...) will be added via per-tenant
 * migrations applied here.
 */
@Injectable()
export class TenantProvisionerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sanitize a slug into a safe Postgres schema name. */
  schemaNameFor(slug: string): string {
    const safe = slug.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
    return `tenant_${safe}`;
  }

  async provision(schema: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${schema}"`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "${schema}"."_meta" (
         key   text PRIMARY KEY,
         value text NOT NULL,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${schema}"."_meta" (key, value)
       VALUES ('provisioned_at', now()::text)
       ON CONFLICT (key) DO NOTHING`,
    );
  }

  async drop(schema: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
}
