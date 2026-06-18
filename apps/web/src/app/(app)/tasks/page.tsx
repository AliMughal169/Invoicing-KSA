"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";
import { DueDateBadge } from "@/components/due-date-badge";

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  priority: string;
  status: string;
  completed_at?: string;
}

function isOverdue(task: Task) {
  return task.status !== "completed" && new Date(task.due_date) < new Date();
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [formData, setFormData] = useState({ title: "", description: "", due_date: "", priority: "medium" });

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await api.listTasks();
      setTasks(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (statusFilter !== "all") {
          if (statusFilter === "overdue" && !isOverdue(task)) return false;
          if (statusFilter !== "overdue" && task.status !== statusFilter) return false;
        }
        if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
        return true;
      }),
    [tasks, priorityFilter, statusFilter],
  );

  const stats = useMemo(() => {
    const open = tasks.filter((task) => task.status !== "completed").length;
    const completed = tasks.filter((task) => task.status === "completed").length;
    const overdue = tasks.filter(isOverdue).length;
    return { open, completed, overdue };
  }, [tasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTask({
        title: formData.title,
        description: formData.description || undefined,
        dueDate: formData.due_date,
        priority: formData.priority,
      });
      setFormData({ title: "", description: "", due_date: "", priority: "medium" });
      setOpenDialog(false);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await api.completeTask(taskId);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete task");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.deleteTask(taskId);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  if (loading) return <PageShell><p className="text-muted-foreground">Loading...</p></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title="Tasks"
        description="Track work items, deadlines, and follow-ups across your workspace"
        actions={
          <Button onClick={() => setOpenDialog(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> New task
          </Button>
        }
      />

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Total tasks</p>
                <p className="text-2xl font-semibold">{tasks.length}</p>
              </div>
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-semibold">{stats.open}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-semibold">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-semibold">{stats.overdue}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No tasks found
                    </TableCell>
                  </TableRow>
                )}
                {filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                        {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{task.priority}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <DueDateBadge dueDate={task.due_date} status={task.status} />
                        <span className="text-sm text-muted-foreground">{formatDate(task.due_date)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{task.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        {task.status !== "completed" && (
                          <Button size="sm" variant="outline" onClick={() => handleCompleteTask(task.id)}>
                            Mark done
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteTask(task.id)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 p-4 lg:hidden">
            {filteredTasks.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">No tasks found</p>
            ) : (
              filteredTasks.map((task) => (
                <div key={task.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <p className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                      {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-muted-foreground">{task.priority}</span>
                        <DueDateBadge dueDate={task.due_date} status={task.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">Due {formatDate(task.due_date)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {task.status !== "completed" && (
                      <Button className="flex-1 sm:flex-none" size="sm" variant="outline" onClick={() => handleCompleteTask(task.id)}>
                        Mark done
                      </Button>
                    )}
                    <Button className="flex-1 sm:flex-none" size="sm" variant="destructive" onClick={() => handleDeleteTask(task.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Task title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Task description (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}