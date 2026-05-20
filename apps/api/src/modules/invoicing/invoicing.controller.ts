import { Body, Controller, Get, Header, Param, Post, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";
import { InvoicingService } from "./invoicing.service";

@UseGuards(JwtAuthGuard)
@Controller("invoicing")
export class InvoicingController {
  constructor(private readonly inv: InvoicingService) {}

  @Get("customers") listCustomers() { return this.inv.listCustomers(); }
  @Post("customers")
  createCustomer(@Body() b: { name: string; email?: string; vatNumber?: string }) {
    return this.inv.createCustomer(b.name, b.email, b.vatNumber);
  }

  @Get("products") listProducts() { return this.inv.listProducts(); }
  @Post("products")
  createProduct(@Body() b: { name: string; priceSar: number; sku?: string; vatRate?: number }) {
    return this.inv.createProduct(b.name, b.priceSar, b.sku, b.vatRate);
  }

  @Get("invoices") list() { return this.inv.listInvoices(); }
  @Get("invoices/:id") get(@Param("id") id: string) { return this.inv.getInvoice(id); }

  @Get("invoices/:id/xml")
  @Header("Content-Type", "application/xml")
  async xml(@Param("id") id: string, @Res() res: Response) {
    const inv = await this.inv.getInvoice(id);
    res.send(inv.zatca_xml ?? "<error>not issued</error>");
  }

  @Post("invoices")
  create(@Body() b: {
    customerId: string; issueDate?: string; dueDate?: string;
    lines: { description: string; qty: number; unitPrice: number; vatRate?: number }[];
  }) { return this.inv.createInvoice(b); }

  @Post("invoices/:id/issue")
  issue(@Param("id") id: string) { return this.inv.issueInvoice(id); }

  @Post("invoices/:id/pay")
  pay(@Param("id") id: string) { return this.inv.markPaid(id); }
}
