import { Body, Controller, Get, Header, Param, Post, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";
import { InvoicingService } from "./invoicing.service";

@UseGuards(JwtAuthGuard)
@Controller("invoicing")
export class InvoicingController {
  constructor(private readonly inv: InvoicingService) {}

  @Get("customers") listCustomers() { return this.inv.listCustomers(); }
  @Get("customers/:id") getCustomer(@Param("id") id: string) { return this.inv.getCustomer(id); }
  @Post("customers")
  createCustomer(@Body() b: {
    name: string;
    companyName?: string;
    customerType?: string;
    salutation?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    currency?: string;
    email?: string;
    vatNumber?: string;
    contactPersonName?: string;
    companyPhone?: string;
    contactPersonPhone?: string;
    contactPersonPhoneSameAsCompany?: boolean;
    workPhoneCountryCode?: string;
    personalPhoneCountryCode?: string;
    workPhone?: string;
    personalPhone?: string;
    language?: string;
    documents?: { name: string; size?: number; type?: string; lastModified?: number }[];
    remarks?: string;
    shippingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    billingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    address?: string;
    state?: string;
    city?: string;
    country?: string;
    customFields?: Record<string, any>;
  }) {
    return this.inv.createCustomer(b);
  }
  @Post("customers/:id")
  updateCustomer(@Param("id") id: string, @Body() b: {
    name?: string;
    companyName?: string;
    customerType?: string;
    salutation?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    currency?: string;
    email?: string;
    vatNumber?: string;
    contactPersonName?: string;
    companyPhone?: string;
    contactPersonPhone?: string;
    contactPersonPhoneSameAsCompany?: boolean;
    workPhoneCountryCode?: string;
    personalPhoneCountryCode?: string;
    workPhone?: string;
    personalPhone?: string;
    language?: string;
    documents?: { name: string; size?: number; type?: string; lastModified?: number }[];
    remarks?: string;
    shippingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    billingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    address?: string;
    state?: string;
    city?: string;
    country?: string;
    customFields?: Record<string, any>;
  }) {
    return this.inv.updateCustomer(id, b);
  }
  @Post("customers/:id/delete") deleteCustomer(@Param("id") id: string) { return this.inv.deleteCustomer(id); }
  @Get("customers/:id/comments") customerComments(@Param("id") id: string) { return this.inv.customerComments(id); }
  @Post("customers/:id/comments") addCustomerComment(@Param("id") id: string, @Body() b: { body: string }) {
    return this.inv.addCustomerComment(id, b.body);
  }
  @Get("customers/:id/statement") customerStatement(@Param("id") id: string) { return this.inv.customerStatement(id); }

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
    customerId?: string; issueDate?: string; dueDate?: string; isTaxInvoice?: boolean;
    lines: { description: string; qty: number; unitPrice: number; vatRate?: number }[];
    customFields?: Record<string, any>;
  }) { return this.inv.createInvoice(b); }

  @Post("invoices/:id/issue")
  issue(@Param("id") id: string) { return this.inv.issueInvoice(id); }

  @Post("invoices/:id/pay")
  pay(@Param("id") id: string) { return this.inv.markPaid(id); }
}
