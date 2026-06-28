import { Module } from "@nestjs/common";
import { QuotationsController } from "./quotations.controller";
import { QuotationsService } from "./quotations.service";
import { InvoicingModule } from "../invoicing/invoicing.module";

@Module({
  imports: [InvoicingModule],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
