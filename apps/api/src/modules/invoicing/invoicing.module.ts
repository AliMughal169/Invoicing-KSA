import { Module } from "@nestjs/common";
import { InvoicingController } from "./invoicing.controller";
import { InvoicingService } from "./invoicing.service";
import { ZatcaService } from "./zatca.service";
import { AccountingModule } from "../accounting/accounting.module";

@Module({
  imports: [AccountingModule],
  controllers: [InvoicingController],
  providers: [InvoicingService, ZatcaService],
  exports: [InvoicingService],
})
export class InvoicingModule {}
