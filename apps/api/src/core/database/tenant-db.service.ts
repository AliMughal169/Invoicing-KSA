import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { TenantContextService } from "../../tenancy/tenant-context.service";

/**
 * Lightweight per-tenant raw SQL helper.
 * Every query is automatically scoped to the caller's tenant schema.
 */
@Injectable()
export class TenantDb {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  private schema(): string {
    const s = this.ctx.getSchema();
    if (!s) throw new ForbiddenException("No tenant context");
    return s;
  }

  /** SELECT — returns rows. */
  async query<T = any>(sqlTemplate: string, params: any[] = []): Promise<T[]> {
    const schema = this.schema();
    const sql = sqlTemplate.replace(/__S__/g, schema);
    return this.prisma.$queryRawUnsafe<T[]>(sql, ...params);
  }

  /** INSERT/UPDATE/DELETE — returns affected rows count. */
  async exec(sqlTemplate: string, params: any[] = []): Promise<number> {
    const schema = this.schema();
    const sql = sqlTemplate.replace(/__S__/g, schema);
    return this.prisma.$executeRawUnsafe(sql, ...params);
  }

  /** Helper for INSERT ... RETURNING. */
  async insertReturning<T = any>(sqlTemplate: string, params: any[] = []): Promise<T> {
    const rows = await this.query<T>(sqlTemplate, params);
    return rows[0];
  }
}
