import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";
import { TasksService } from "./tasks.service";

@UseGuards(JwtAuthGuard)
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  create(
    @Body()
    body: {
      title: string;
      description?: string;
      dueDate: string;
      priority?: string;
      relatedType?: string;
      relatedId?: string;
    },
  ) {
    return this.tasks.createTask({
      title: body.title,
      description: body.description,
      dueDate: body.dueDate,
      priority: body.priority,
      relatedType: body.relatedType,
      relatedId: body.relatedId,
    });
  }

  @Get()
  list(
    @Query("status") status?: string,
    @Query("priority") priority?: string,
    @Query("relatedType") relatedType?: string,
    @Query("relatedId") relatedId?: string,
  ) {
    return this.tasks.listTasks({
      status: status as any,
      priority: priority as any,
      relatedType,
      relatedId,
    });
  }

  @Get("overdue")
  getOverdue() {
    return this.tasks.getOverdue();
  }

  @Get("upcoming")
  getUpcoming() {
    return this.tasks.getUpcoming();
  }

  @Get("dashboard-summary")
  getDashboardSummary() {
    return this.tasks.getDashboardSummary();
  }

  @Get("invoice-due-dates")
  getInvoiceDueDates() {
    return this.tasks.getInvoiceDueDatesSummary();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.tasks.getTask(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: { title?: string; description?: string; dueDate?: string; priority?: string },
  ) {
    return this.tasks.updateTask(id, {
      title: body.title,
      description: body.description,
      dueDate: body.dueDate,
      priority: body.priority,
    });
  }

  @Patch(":id/complete")
  complete(@Param("id") id: string) {
    return this.tasks.completeTask(id);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.tasks.deleteTask(id);
  }
}
