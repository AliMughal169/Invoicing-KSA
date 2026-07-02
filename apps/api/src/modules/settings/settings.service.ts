import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";

@Injectable()
export class SettingsService {
  constructor(private readonly db: TenantDb) {}

  // Settings
  async getSettings() {
    const rows = await this.db.query(`SELECT * FROM "__S__"."settings" WHERE id = 'default'`);
    if (!rows[0]) {
      return this.db.insertReturning(`INSERT INTO "__S__"."settings" (id) VALUES ('default') RETURNING *`);
    }
    return rows[0];
  }

  async updateSettings(input: Partial<{
    companyNameEn: string | null;
    companyNameAr: string | null;
    crNumber: string | null;
    vatNumber: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
    companyLogoUrl: string | null;
    letterheadUrl: string | null;
    topMargin: number;
    bottomMargin: number;
    printOnLetterhead: boolean;
  }>) {
    await this.getSettings(); // Ensure settings row is initialized

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const mapping: Record<string, string> = {
      companyNameEn: "company_name_en",
      companyNameAr: "company_name_ar",
      crNumber: "cr_number",
      vatNumber: "vat_number",
      addressLine1: "address_line1",
      addressLine2: "address_line2",
      city: "city",
      state: "state",
      country: "country",
      postalCode: "postal_code",
      companyLogoUrl: "company_logo_url",
      letterheadUrl: "letterhead_url",
      topMargin: "top_margin",
      bottomMargin: "bottom_margin",
      printOnLetterhead: "print_on_letterhead",
    };

    for (const [key, dbCol] of Object.entries(mapping)) {
      if (input[key as keyof typeof input] !== undefined) {
        fields.push(`${dbCol} = $${paramIdx++}`);
        values.push(input[key as keyof typeof input]);
      }
    }

    if (fields.length === 0) {
      return this.getSettings();
    }

    const query = `UPDATE "__S__"."settings" SET ${fields.join(", ")}, updated_at = now() WHERE id = 'default' RETURNING *`;
    const res = await this.db.query(query, values);
    return res[0];
  }

  async deleteLetterhead() {
    return this.updateSettings({
      letterheadUrl: null,
      topMargin: 0,
      bottomMargin: 0,
    });
  }

  // Custom Field Definitions
  async listCustomFieldDefinitions(entityType?: string) {
    if (entityType) {
      return this.db.query(
        `SELECT * FROM "__S__"."custom_field_definitions" WHERE entity_type = $1 ORDER BY created_at ASC`,
        [entityType],
      );
    }
    return this.db.query(`SELECT * FROM "__S__"."custom_field_definitions" ORDER BY created_at ASC`);
  }

  async createCustomFieldDefinition(input: {
    entityType: string;
    fieldKey: string;
    fieldLabel: string;
    fieldType: string;
    isRequired: boolean;
  }) {
    // Basic validation
    if (!input.entityType || !input.fieldKey || !input.fieldLabel || !input.fieldType) {
      throw new BadRequestException("All fields (entityType, fieldKey, fieldLabel, fieldType) are required");
    }

    const fieldKey = input.fieldKey.toLowerCase().replace(/[^a-z0-9_]/g, "_").trim();

    return this.db.insertReturning(
      `INSERT INTO "__S__"."custom_field_definitions"
        (entity_type, field_key, field_label, field_type, is_required)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (entity_type, field_key) 
       DO UPDATE SET 
         field_label = EXCLUDED.field_label,
         field_type = EXCLUDED.field_type,
         is_required = EXCLUDED.is_required
       RETURNING *`,
      [input.entityType, fieldKey, input.fieldLabel, input.fieldType, input.isRequired],
    );
  }

  async deleteCustomFieldDefinition(id: string) {
    const affected = await this.db.exec(
      `DELETE FROM "__S__"."custom_field_definitions" WHERE id = $1`,
      [id],
    );
    if (affected === 0) throw new NotFoundException("Custom field definition not found");
    return { ok: true };
  }
}
