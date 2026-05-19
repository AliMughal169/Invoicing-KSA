import { Injectable } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";

@Injectable()
export class CrmService {
  constructor(private readonly db: TenantDb) {}

  // Companies
  listCompanies() {
    return this.db.query(`SELECT * FROM "__S__"."companies" ORDER BY created_at DESC`);
  }
  createCompany(name: string, vatNumber?: string) {
    return this.db.insertReturning(
      `INSERT INTO "__S__"."companies"(name, vat_number) VALUES ($1,$2) RETURNING *`,
      [name, vatNumber ?? null],
    );
  }

  // Contacts
  listContacts() {
    return this.db.query(`
      SELECT c.*, co.name AS company_name
      FROM "__S__"."contacts" c
      LEFT JOIN "__S__"."companies" co ON co.id = c.company_id
      ORDER BY c.created_at DESC`);
  }
  createContact(name: string, email?: string, phone?: string, companyId?: string) {
    return this.db.insertReturning(
      `INSERT INTO "__S__"."contacts"(name,email,phone,company_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, email ?? null, phone ?? null, companyId ?? null],
    );
  }
  async deleteContact(id: string) {
    await this.db.exec(`DELETE FROM "__S__"."contacts" WHERE id = $1`, [id]);
    return { ok: true };
  }

  // Opportunities
  listOpportunities() {
    return this.db.query(`
      SELECT o.*, c.name AS contact_name
      FROM "__S__"."opportunities" o
      LEFT JOIN "__S__"."contacts" c ON c.id = o.contact_id
      ORDER BY o.created_at DESC`);
  }
  createOpportunity(name: string, amount: number, stage = "new", contactId?: string) {
    return this.db.insertReturning(
      `INSERT INTO "__S__"."opportunities"(name,amount_sar,stage,contact_id)
       VALUES ($1,$2::numeric,$3,$4) RETURNING *`,
      [name, amount, stage, contactId ?? null],
    );
  }
  async updateOpportunityStage(id: string, stage: string) {
    await this.db.exec(
      `UPDATE "__S__"."opportunities" SET stage = $1 WHERE id = $2`,
      [stage, id],
    );
    return { ok: true };
  }
}
