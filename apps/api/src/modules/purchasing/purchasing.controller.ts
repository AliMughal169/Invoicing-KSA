import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";
import { BillLineInput, PurchasingService } from "./purchasing.service";

@UseGuards(JwtAuthGuard)
@Controller("purchasing")
export class PurchasingController {
  constructor(private readonly p: PurchasingService) {}

  // Vendors
  @Get("vendors") listVendors() { return this.p.listVendors(); }
  @Get("vendors/:id") getVendor(@Param("id") id: string) { return this.p.getVendor(id); }
  @Post("vendors") createVendor(@Body() b: any) { return this.p.createVendor(b); }

  // Bills
  @Get("bills") listBills() { return this.p.listBills(); }
  @Get("bills/:id") getBill(@Param("id") id: string) { return this.p.getBill(id); }

  @Post("bills")
  createBill(@Body() b: {
    vendorId: string;
    billDate?: string;
    dueDate?: string;
    reference?: string;
    notes?: string;
    lines: BillLineInput[];
  }) { return this.p.createBill(b); }

  @Post("bills/:id/post")
  postBill(@Param("id") id: string) { return this.p.postBill(id); }

  @Post("bills/:id/pay")
  payBill(@Param("id") id: string) { return this.p.payBill(id); }
}
