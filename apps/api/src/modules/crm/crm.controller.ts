import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";
import { CrmService } from "./crm.service";

@UseGuards(JwtAuthGuard)
@Controller("crm")
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get("companies")
  listCompanies() { return this.crm.listCompanies(); }

  @Post("companies")
  createCompany(@Body() body: { name: string; vatNumber?: string }) {
    return this.crm.createCompany(body.name, body.vatNumber);
  }

  @Get("contacts")
  listContacts() { return this.crm.listContacts(); }

  @Post("contacts")
  createContact(@Body() body: { name: string; email?: string; phone?: string; companyId?: string }) {
    return this.crm.createContact(body.name, body.email, body.phone, body.companyId);
  }

  @Delete("contacts/:id")
  deleteContact(@Param("id") id: string) { return this.crm.deleteContact(id); }

  @Get("opportunities")
  listOpportunities() { return this.crm.listOpportunities(); }

  @Post("opportunities")
  createOpportunity(@Body() body: { name: string; amount: number; stage?: string; contactId?: string }) {
    return this.crm.createOpportunity(body.name, body.amount, body.stage, body.contactId);
  }

  @Patch("opportunities/:id/stage")
  updateStage(@Param("id") id: string, @Body() body: { stage: string }) {
    return this.crm.updateOpportunityStage(id, body.stage);
  }
}
