import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantDb } from "../../core/database/tenant-db.service";

export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  completed_at?: string;
  status: "open" | "completed" | "overdue";
  priority: "low" | "medium" | "high";
  related_type?: string;
  related_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskFilters {
  status?: "open" | "completed" | "overdue";
  priority?: "low" | "medium" | "high";
  relatedType?: string;
  relatedId?: string;
}

@Injectable()
export class TasksService {
  constructor(private readonly db: TenantDb) {}

  // Create a new task
  async createTask(data: {
    title: string;
    dueDate: string;
    description?: string;
    priority?: string;
    relatedType?: string;
    relatedId?: string;
  }) {
    return this.db.insertReturning<Task>(
      `INSERT INTO "__S__"."tasks"
       (title, description, due_date, priority, status, related_type, related_id, created_at, updated_at)
       VALUES ($1, $2, $3::date, $4, 'open', $5, $6, now(), now())
       RETURNING *`,
      [
        data.title,
        data.description ?? null,
        data.dueDate,
        data.priority ?? "medium",
        data.relatedType ?? null,
        data.relatedId ?? null,
      ],
    );
  }

  // Get all tasks with optional filters
  async listTasks(filters?: TaskFilters) {
    let sql = `SELECT * FROM "__S__"."tasks" WHERE 1=1`;
    const params: any[] = [];

    if (filters?.status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }
    if (filters?.priority) {
      sql += ` AND priority = $${params.length + 1}`;
      params.push(filters.priority);
    }
    if (filters?.relatedType) {
      sql += ` AND related_type = $${params.length + 1}`;
      params.push(filters.relatedType);
    }
    if (filters?.relatedId) {
      sql += ` AND related_id = $${params.length + 1}`;
      params.push(filters.relatedId);
    }

    sql += ` ORDER BY due_date ASC, priority DESC`;

    return this.db.query<Task>(sql, params);
  }

  // Get upcoming tasks (due in next 7 days)
  async getUpcoming() {
    return this.db.query<Task>(
      `SELECT * FROM "__S__"."tasks"
       WHERE status = 'open' AND due_date BETWEEN current_date AND current_date + 7
       ORDER BY due_date ASC`,
    );
  }

  // Get overdue tasks
  async getOverdue() {
    return this.db.query<Task>(
      `SELECT * FROM "__S__"."tasks"
       WHERE status = 'open' AND due_date < current_date
       ORDER BY due_date ASC`,
    );
  }

  // Get task by ID
  async getTask(id: string) {
    const rows = await this.db.query<Task>(
      `SELECT * FROM "__S__"."tasks" WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Task not found");
    return rows[0];
  }

  // Mark task as completed
  async completeTask(id: string) {
    await this.getTask(id); // Verify exists
    return this.db.insertReturning<Task>(
      `UPDATE "__S__"."tasks"
       SET status = 'completed', completed_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
  }

  // Update task
  async updateTask(
    id: string,
    data: { title?: string; description?: string; dueDate?: string; priority?: string },
  ) {
    await this.getTask(id); // Verify exists
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(data.description);
    }
    if (data.dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}::date`);
      params.push(data.dueDate);
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(data.priority);
    }

    if (updates.length === 0) return this.getTask(id);

    updates.push(`updated_at = now()`);
    params.push(id);

    return this.db.insertReturning<Task>(
      `UPDATE "__S__"."tasks" SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );
  }

  // Delete task
  async deleteTask(id: string) {
    await this.getTask(id); // Verify exists
    await this.db.exec(`DELETE FROM "__S__"."tasks" WHERE id = $1`, [id]);
    return { success: true };
  }

  // Get dashboard summary
  async getDashboardSummary() {
    const [overdue, upcoming, completed] = await Promise.all([
      this.getOverdue(),
      this.getUpcoming(),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM "__S__"."tasks" WHERE status = 'completed'`,
      ),
    ]);

    return {
      overdue: overdue.length,
      upcoming: upcoming.length,
      completed: completed[0]?.count ?? 0,
      overdueTasks: overdue,
      upcomingTasks: upcoming,
    };
  }

  // Get invoice due date summary
  async getInvoiceDueDatesSummary() {
    const overdue = await this.db.query<any>(
      `SELECT i.id, i.number, c.name AS customer_name, i.due_date, i.total
       FROM "__S__"."invoices" i
       LEFT JOIN "__S__"."customers" c ON c.id = i.customer_id
       WHERE i.status != 'paid' AND i.due_date < current_date
       ORDER BY i.due_date ASC`,
    );

    const upcoming = await this.db.query<any>(
      `SELECT i.id, i.number, c.name AS customer_name, i.due_date, i.total
       FROM "__S__"."invoices" i
       LEFT JOIN "__S__"."customers" c ON c.id = i.customer_id
       WHERE i.status != 'paid' AND i.due_date BETWEEN current_date AND current_date + 7
       ORDER BY i.due_date ASC`,
    );

    return { overdue, upcoming };
  }
}
