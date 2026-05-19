import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "./core/database/database.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { AuthModule } from "./iam/auth/auth.module";
import { CrmModule } from "./modules/crm/crm.module";
import { InvoicingModule } from "./modules/invoicing/invoicing.module";
import { AccountingModule } from "./modules/accounting/accounting.module";
import { StatsModule } from "./modules/stats/stats.module";
import { HealthController } from "./health.controller";
import { TenantContextMiddleware } from "./tenancy/tenant-context.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    }),
    DatabaseModule,
    TenancyModule,
    AuthModule,
    CrmModule,
    AccountingModule,
    InvoicingModule,
    StatsModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes("*");
  }
}
