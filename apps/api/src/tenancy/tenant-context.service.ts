import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
  schema: string;
  userId?: string;
}

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantContext>();

  run<T>(ctx: TenantContext, fn: () => T): T {
    return this.als.run(ctx, fn);
  }

  get(): TenantContext | undefined {
    return this.als.getStore();
  }

  getTenantId(): string | undefined {
    return this.als.getStore()?.tenantId;
  }

  getSchema(): string | undefined {
    return this.als.getStore()?.schema;
  }

  getUserId(): string | undefined {
    return this.als.getStore()?.userId;
  }
}
