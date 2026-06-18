import { Module } from "@nestjs/common";
import { PurchasingController } from "./purchasing.controller";
import { PurchasingService } from "./purchasing.service";
import { AccountingModule } from "../accounting/accounting.module";

@Module({
  imports: [AccountingModule],
  controllers: [PurchasingController],
  providers: [PurchasingService],
})
export class PurchasingModule {}
