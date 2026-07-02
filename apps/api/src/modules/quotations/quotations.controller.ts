import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";
import { QuotationsService } from "./quotations.service";

@UseGuards(JwtAuthGuard)
@Controller("invoicing/quotations")
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  list() {
    return this.quotationsService.listQuotations();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.quotationsService.getQuotation(id);
  }

  @Post()
  create(@Body() b: {
    customerId: string;
    issueDate?: string;
    dueDate?: string;
    isTaxQuote?: boolean;
    lines: { description: string; qty: number; unitPrice: number; vatRate?: number }[];
    customFields?: Record<string, any>;
  }) {
    return this.quotationsService.createQuotation(b);
  }

  @Post(":id")
  update(@Param("id") id: string, @Body() b: {
    customerId?: string;
    issueDate?: string;
    dueDate?: string;
    status?: string;
    isTaxQuote?: boolean;
    lines?: { description: string; qty: number; unitPrice: number; vatRate?: number }[];
    customFields?: Record<string, any>;
  }) {
    return this.quotationsService.updateQuotation(id, b);
  }

  @Post(":id/delete")
  delete(@Param("id") id: string) {
    return this.quotationsService.deleteQuotation(id);
  }

  @Post(":id/convert")
  convert(@Param("id") id: string) {
    return this.quotationsService.convertToInvoice(id);
  }
}
