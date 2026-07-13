import { Body, Controller, Get, Header, Param, Post, Res, UseGuards, Patch, Delete, Query } from "@nestjs/common";
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
  }) { return this.inv.createCustomer(b); }

  @Patch("customers/:id")
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

  @Delete("customers/:id")
  deleteCustomer(@Param("id") id: string) {
    return this.inv.deleteCustomer(id);
  }

  @Get("customers/:id/comments") customerComments(@Param("id") id: string) { return this.inv.customerComments(id); }
  @Post("customers/:id/comments") addCustomerComment(@Param("id") id: string, @Body() b: { body: string }) {
    return this.inv.addCustomerComment(id, b.body);
  }
  @Patch("customers/:id/comments/:commentId")
  updateCustomerComment(@Param("id") id: string, @Param("commentId") commentId: string, @Body() b: { body: string }) {
    return this.inv.updateCustomerComment(id, commentId, b.body);
  }
  @Delete("customers/:id/comments/:commentId")
  deleteCustomerComment(@Param("id") id: string, @Param("commentId") commentId: string) {
    return this.inv.deleteCustomerComment(id, commentId);
  }

  @Get("customers/:id/statement") customerStatement(@Param("id") id: string) { return this.inv.customerStatement(id); }

  @Get("products") listProducts() { return this.inv.listProducts(); }
  @Get("products/:id")
  getProduct(@Param("id") id: string) {
    return this.inv.getProduct(id);
  }
  @Post("products")
  createProduct(@Body() b: any) {
    return this.inv.createProduct(b);
  }
  @Patch("products/:id")
  updateProduct(@Param("id") id: string, @Body() b: any) {
    return this.inv.updateProduct(id, b);
  }

  @Get("invoices") list(@Query("type") type?: string) { return this.inv.listInvoices(type); }
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

  @Post("invoices/proforma")
  createProforma(@Body() b: {
    customerId?: string; issueDate?: string; dueDate?: string; isTaxInvoice?: boolean;
    lines: { description: string; qty: number; unitPrice: number; vatRate?: number }[];
    customFields?: Record<string, any>;
  }) { return this.inv.createProformaInvoice(b); }

  @Post("invoices/:id/convert-proforma")
  convertProforma(@Param("id") id: string, @Body() b: { status?: "draft" | "issued" }) {
    return this.inv.convertProformaToTaxInvoice(id, b.status);
  }

  @Post("invoices/:id/issue")
  issue(@Param("id") id: string) { return this.inv.issueInvoice(id); }

  @Post("invoices/:id/approve")
  approve(@Param("id") id: string) { return this.inv.issueInvoice(id); }

  @Post("invoices/:id/pay")
  pay(@Param("id") id: string) { return this.inv.markPaid(id); }

  @Post("corrections")
  createCorrection(@Body() b: {
    parentInvoiceId: string;
    type: 'CREDIT_NOTE' | 'DEBIT_NOTE';
    lines?: any[];
    customFields?: Record<string, any>;
  }) {
    return this.inv.createCorrectionDocument(b.parentInvoiceId, b.type, b);
  }
}
