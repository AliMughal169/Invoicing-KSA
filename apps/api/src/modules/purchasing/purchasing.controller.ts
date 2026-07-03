import { Body, Controller, Get, Param, Post, Patch, Delete, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";
import { BillLineInput, PurchasingService } from "./purchasing.service";

@UseGuards(JwtAuthGuard)
@Controller("purchasing")
export class PurchasingController {
  constructor(private readonly p: PurchasingService) {}

  // Vendors
  @Get("vendors") listVendors() { return this.p.listVendors(); }
  @Get("vendors/:id") getVendor(@Param("id") id: string) { return this.p.getVendor(id); }
  @Get("vendors/:id/bills") getVendorBills(@Param("id") id: string) { return this.p.getVendorBills(id); }
  @Post("vendors") createVendor(@Body() b: any) { return this.p.createVendor(b); }
  @Patch("vendors/:id") updateVendor(@Param("id") id: string, @Body() b: any) { return this.p.updateVendor(id, b); }
  @Delete("vendors/:id") deleteVendor(@Param("id") id: string) { return this.p.deleteVendor(id); }

  // Bills
  @Get("bills") listBills() { return this.p.listBills(); }
  @Get("bills/:id") getBill(@Param("id") id: string) { return this.p.getBill(id); }

  @Post("bills")
  createBill(@Body() b: {
    vendorId: string;
    billDate?: string;
    dueDate?: string;
    vendorInvoiceRef?: string;
    notes?: string;
    customFields?: Record<string, any>;
    lines: BillLineInput[];
  }) { return this.p.createBill(b); }

  @Patch("bills/:id")
  updateBill(@Param("id") id: string, @Body() b: {
    vendorId: string;
    billDate?: string;
    dueDate?: string;
    vendorInvoiceRef?: string;
    notes?: string;
    customFields?: Record<string, any>;
    lines: BillLineInput[];
  }) { return this.p.updateBill(id, b); }

  @Delete("bills/:id")
  deleteBill(@Param("id") id: string) { return this.p.deleteBill(id); }

  @Post("bills/:id/post")
  postBill(@Param("id") id: string) { return this.p.approveBill(id); }

  @Post("bills/:id/pay")
  payBill(@Param("id") id: string) { return this.p.payBill(id); }
}
