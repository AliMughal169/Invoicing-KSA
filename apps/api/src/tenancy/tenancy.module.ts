import { Global, Module } from "@nestjs/common";
import { TenantContextService } from "./tenant-context.service";
import { TenantContextMiddleware } from "./tenant-context.middleware";
import { TenantProvisionerService } from "./tenant-provisioner.service";

@Global()
@Module({
  providers: [
    TenantContextService,
    TenantContextMiddleware,
    TenantProvisionerService,
  ],
  exports: [
    TenantContextService,
    TenantContextMiddleware,
    TenantProvisionerService,
  ],
})
export class TenancyModule {}
