import { Controller, Get, Module, UseGuards } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";

@Injectable()
class StatsService {
  constructor(private readonly db: TenantDb) {}

  async overview() {
    const [counts] = await this.db.query<any>(`
      SELECT
        (SELECT COUNT(*) FROM "__S__"."contacts")::int AS contacts_count,
        (SELECT COUNT(*) FROM "__S__"."opportunities")::int AS opportunities_count,
        (SELECT COALESCE(SUM(amount_sar),0) FROM "__S__"."opportunities"
            WHERE stage NOT IN ('won','lost'))::numeric AS pipeline_value,
        (SELECT COUNT(*) FROM "__S__"."invoices")::int AS invoices_count,
        (SELECT COALESCE(SUM(total),0) FROM "__S__"."invoices"
            WHERE status IN ('issued','paid'))::numeric AS revenue_total,
        (SELECT COALESCE(SUM(total),0) FROM "__S__"."invoices"
            WHERE status='issued')::numeric AS outstanding,
        (SELECT COALESCE(SUM(vat_total),0) FROM "__S__"."invoices"
            WHERE status IN ('issued','paid'))::numeric AS vat_due
    `);
    const recentInvoices = await this.db.query(`
      SELECT i.id, i.number, i.total, i.status, i.issue_date,
             c.name AS customer_name
      FROM "__S__"."invoices" i
      LEFT JOIN "__S__"."customers" c ON c.id = i.customer_id
      ORDER BY i.created_at DESC LIMIT 5`);
    const pipelineByStage = await this.db.query(`
      SELECT stage,
             COUNT(*)::int AS count,
             COALESCE(SUM(amount_sar),0)::numeric AS value
      FROM "__S__"."opportunities"
      GROUP BY stage ORDER BY stage`);
    return { ...counts, recentInvoices, pipelineByStage };
  }
}

@UseGuards(JwtAuthGuard)
@Controller("stats")
class StatsController {
  constructor(private readonly s: StatsService) {}
  @Get("overview") overview() { return this.s.overview(); }
}

@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
