import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";
import { AccountingService, JournalLineInput } from "./accounting.service";

@UseGuards(JwtAuthGuard)
@Controller("accounting")
export class AccountingController {
  constructor(private readonly acc: AccountingService) {}

  @Get("accounts") accounts() { return this.acc.listAccounts(); }

  @Post("accounts")
  createAccount(@Body() b: { code: string; name: string; type: string }) {
    return this.acc.createAccount(b.code, b.name, b.type);
  }

  @Get("journal") journal() { return this.acc.listJournal(); }
  @Get("journal/:id") getEntry(@Param("id") id: string) { return this.acc.getJournalEntry(id); }

  @Post("journal")
  createManual(@Body() b: { date?: string; memo: string; lines: JournalLineInput[] }) {
    return this.acc.createManualEntry(b);
  }

  @Get("ledger/:accountId")
  ledger(
    @Param("accountId") id: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.acc.generalLedger(id, from, to);
  }

  @Get("reports/trial-balance")
  trial(@Query("from") from?: string, @Query("to") to?: string) {
    return this.acc.trialBalance(from, to);
  }

  @Get("reports/vat")
  vat(@Query("from") from?: string, @Query("to") to?: string) {
    return this.acc.vatReport(from, to);
  }

  @Get("reports/pnl")
  pnl(@Query("from") from?: string, @Query("to") to?: string) {
    return this.acc.pnl(from, to);
  }
}
