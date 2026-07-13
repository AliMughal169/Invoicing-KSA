import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";
import { PrismaService } from "../../core/database/prisma.service";
import { TenantContextService } from "../../tenancy/tenant-context.service";

@Injectable()
export class SettingsService {
  constructor(
    private readonly db: TenantDb,
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

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

  async listNoteTemplates() {
    return this.db.query(
      `SELECT id, title, content, is_default AS "isDefault", created_at AS "createdAt"
       FROM "__S__"."note_templates"
       ORDER BY created_at DESC`
    );
  }

  async getNoteTemplate(id: string) {
    const rows = await this.db.query(
      `SELECT id, title, content, is_default AS "isDefault", created_at AS "createdAt"
       FROM "__S__"."note_templates"
       WHERE id = $1`,
      [id]
    );
    if (!rows[0]) throw new NotFoundException("Template not found");
    return rows[0];
  }

  async createNoteTemplate(input: { title: string; content: string; isDefault?: boolean }) {
    const title = input.title;
    const content = input.content;
    const isDefault = input.isDefault ?? false;

    const schema = this.ctx.getSchema()!;
    return this.prisma.$transaction(async (tx) => {
      const exec = async (sql: string, params: any[] = []) => {
        return tx.$executeRawUnsafe(sql.replace(/__S__/g, schema), ...params);
      };
      const insert = async <T = any>(sql: string, params: any[] = []) => {
        const rows = await tx.$queryRawUnsafe<T[]>(sql.replace(/__S__/g, schema), ...params);
        return rows[0];
      };

      if (isDefault) {
        await exec(`UPDATE "__S__"."note_templates" SET is_default = false`);
      }

      return insert<any>(
        `INSERT INTO "__S__"."note_templates" (title, content, is_default)
         VALUES ($1, $2, $3)
         RETURNING id, title, content, is_default AS "isDefault", created_at AS "createdAt"`,
        [title, content, isDefault]
      );
    });
  }

  async updateNoteTemplate(id: string, input: { title?: string; content?: string; isDefault?: boolean }) {
    const template = await this.getNoteTemplate(id);
    const title = input.title ?? template.title;
    const content = input.content ?? template.content;
    const isDefault = input.isDefault ?? template.isDefault;

    const schema = this.ctx.getSchema()!;
    return this.prisma.$transaction(async (tx) => {
      const exec = async (sql: string, params: any[] = []) => {
        return tx.$executeRawUnsafe(sql.replace(/__S__/g, schema), ...params);
      };
      const query = async <T = any>(sql: string, params: any[] = []) => {
        const rows = await tx.$queryRawUnsafe<T[]>(sql.replace(/__S__/g, schema), ...params);
        return rows[0];
      };

      if (isDefault) {
        await exec(`UPDATE "__S__"."note_templates" SET is_default = false WHERE id <> $1`, [id]);
      }

      return query<any>(
        `UPDATE "__S__"."note_templates"
         SET title = $1, content = $2, is_default = $3
         WHERE id = $4
         RETURNING id, title, content, is_default AS "isDefault", created_at AS "createdAt"`,
        [title, content, isDefault, id]
      );
    });
  }

  async deleteNoteTemplate(id: string) {
    await this.getNoteTemplate(id);
    await this.db.exec(`DELETE FROM "__S__"."note_templates" WHERE id = $1`, [id]);
    return { success: true };
  }

  async setDefaultNoteTemplate(id: string) {
    await this.getNoteTemplate(id);
    const schema = this.ctx.getSchema()!;
    return this.prisma.$transaction(async (tx) => {
      const exec = async (sql: string, params: any[] = []) => {
        return tx.$executeRawUnsafe(sql.replace(/__S__/g, schema), ...params);
      };
      const query = async <T = any>(sql: string, params: any[] = []) => {
        const rows = await tx.$queryRawUnsafe<T[]>(sql.replace(/__S__/g, schema), ...params);
        return rows[0];
      };

      await exec(`UPDATE "__S__"."note_templates" SET is_default = false`);
      return query<any>(
        `UPDATE "__S__"."note_templates"
         SET is_default = true
         WHERE id = $1
         RETURNING id, title, content, is_default AS "isDefault", created_at AS "createdAt"`,
        [id]
      );
    });
  }
}
