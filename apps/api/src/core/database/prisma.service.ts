import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { TenantContextService } from "../../tenancy/tenant-context.service";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly tenantContext?: TenantContextService) {
    super({ log: ["warn", "error"] });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      this.logger.warn(
        "Prisma could not connect during startup. The API will keep running, but database-backed routes will fail until Postgres is available.",
      );
      this.logger.error(error);
    }
  }

  /**
   * Execute a callback with the Postgres `search_path` set to the current
   * tenant schema (falling back to `public`). Use for any per-tenant raw SQL
   * or queries against tenant-specific tables created by the provisioner.
   */
  async withTenantSchema<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    const schema = this.tenantContext?.getSchema();
    if (!schema) return fn(this);
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}", public`);
      return fn(tx as unknown as PrismaClient);
    });
  }
}
