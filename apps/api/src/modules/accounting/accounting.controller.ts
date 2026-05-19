import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";
import { AccountingService } from "./accounting.service";

@UseGuards(JwtAuthGuard)
@Controller("accounting")
export class AccountingController {
  constructor(private readonly acc: AccountingService) {}

  @Get("accounts") accounts() { return this.acc.listAccounts(); }
  @Get("journal") journal() { return this.acc.listJournal(); }

  @Get("reports/vat")
  vat(@Query("from") from?: string, @Query("to") to?: string) {
    return this.acc.vatReport(from, to);
  }

  @Get("reports/pnl")
  pnl(@Query("from") from?: string, @Query("to") to?: string) {
    return this.acc.pnl(from, to);
  }
}
