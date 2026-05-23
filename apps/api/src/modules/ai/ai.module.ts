import { Body, Controller, Injectable, Module, Post, UseGuards } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";

interface ToolCall { id: string; name: string; args: Record<string, any>; }
interface ChatMessage { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: any[]; tool_call_id?: string; }

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_revenue_summary",
      description: "Total revenue (issued+paid invoices), outstanding amount and VAT due for the workspace.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_invoices",
      description: "List recent invoices, optionally filtered by status (draft|issued|paid).",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Optional status filter" },
          limit: { type: "integer", description: "Max rows, default 10" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_customers",
      description: "List billing customers in the workspace.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_opportunities",
      description: "List CRM opportunities with their stage and amount.",
      parameters: { type: "object", properties: {} },
    },
  },
];

@Injectable()
class AiService {
  constructor(private readonly db: TenantDb) {}

  private async runTool(name: string, args: any) {
    if (name === "get_revenue_summary") {
      const [r] = await this.db.query<any>(`
        SELECT
          (SELECT COALESCE(SUM(total),0) FROM "__S__"."invoices" WHERE status IN ('issued','paid'))::numeric AS revenue,
          (SELECT COALESCE(SUM(total),0) FROM "__S__"."invoices" WHERE status='issued')::numeric AS outstanding,
          (SELECT COALESCE(SUM(vat_total),0) FROM "__S__"."invoices" WHERE status IN ('issued','paid'))::numeric AS vat_due,
          (SELECT COUNT(*)::int FROM "__S__"."invoices") AS invoice_count`);
      return r;
    }
    if (name === "list_invoices") {
      const limit = Math.min(Number(args?.limit ?? 10), 50);
      const status = args?.status;
      if (status) {
        return this.db.query(`
          SELECT i.number, i.status, i.total, i.issue_date, c.name AS customer
          FROM "__S__"."invoices" i LEFT JOIN "__S__"."customers" c ON c.id=i.customer_id
          WHERE i.status = $1
          ORDER BY i.created_at DESC LIMIT $2`, [status, limit]);
      }
      return this.db.query(`
        SELECT i.number, i.status, i.total, i.issue_date, c.name AS customer
        FROM "__S__"."invoices" i LEFT JOIN "__S__"."customers" c ON c.id=i.customer_id
        ORDER BY i.created_at DESC LIMIT $1`, [limit]);
    }
    if (name === "list_customers") {
      return this.db.query(`SELECT name, email, vat_number, company_phone, city, country FROM "__S__"."customers" ORDER BY created_at DESC LIMIT 50`);
    }
    if (name === "list_opportunities") {
      return this.db.query(`SELECT name, stage, amount_sar FROM "__S__"."opportunities" ORDER BY created_at DESC LIMIT 50`);
    }
    return { error: `unknown tool: ${name}` };
  }

  async chat(userMessage: string, history: ChatMessage[] = []): Promise<{ reply: string; trace: any[] }> {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are an ERP assistant for a Saudi Arabian SMB. " +
          "Answer concisely about the user's workspace data (invoices, customers, revenue, pipeline). " +
          "All amounts are in SAR. Use the available tools to fetch live data — never invent numbers. " +
          "You can reply in Arabic if the user writes in Arabic, otherwise English.",
      },
      ...history,
      { role: "user", content: userMessage },
    ];

    const trace: any[] = [];
    for (let step = 0; step < 5; step++) {
      const res = await fetch(`${process.env.LLM_PROXY_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.EMERGENT_LLM_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL || "gpt-4o-mini",
          messages,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.2,
        }),
      });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "LLM call failed");

      const choice = data.choices?.[0]?.message;
      if (!choice) throw new Error("Empty LLM response");

      // No more tools → return text.
      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        return { reply: choice.content ?? "", trace };
      }

      messages.push({ role: "assistant", content: choice.content ?? "", tool_calls: choice.tool_calls });
      for (const tc of choice.tool_calls) {
        const name = tc.function.name;
        const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
        const result = await this.runTool(name, args);
        trace.push({ tool: name, args, result });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }
    return { reply: "I hit the tool-call iteration limit. Try a more specific question.", trace };
  }
}

@UseGuards(JwtAuthGuard)
@Controller("ai")
class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("chat")
  chat(@Body() b: { message: string; history?: ChatMessage[] }) {
    return this.ai.chat(b.message, b.history ?? []);
  }
}

@Module({
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
