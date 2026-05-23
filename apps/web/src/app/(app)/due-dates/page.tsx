"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Clock3, FileText, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/page-shell";
import { DueDateBadge } from "@/components/due-date-badge";

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function DueDateItem({ item, kind }: { item: any; kind: "invoice" | "task" }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="font-medium truncate">{kind === "invoice" ? item.number : item.title}</p>
        <p className="text-sm text-muted-foreground truncate">
          {kind === "invoice" ? item.customer_name ?? "Unknown customer" : item.description ?? "Task reminder"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <DueDateBadge dueDate={item.due_date} status={item.status} />
        <div className="text-sm text-muted-foreground">{formatDate(item.due_date)}</div>
        {kind === "invoice" && <div className="text-sm font-medium">{formatSAR(item.total)}</div>}
      </div>
    </div>
  );
}

export default function DueDateDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [invoiceDueDates, setInvoiceDueDates] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getTaskDashboardSummary(), api.getInvoiceDueDates()])
      .then(([taskSummary, invoiceSummary]) => {
        setSummary(taskSummary);
        setInvoiceDueDates(invoiceSummary);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load due dates");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const taskStats = useMemo(
    () => [
      { label: "Overdue tasks", value: summary?.overdue ?? 0, icon: AlertTriangle },
      { label: "Upcoming tasks", value: summary?.upcoming ?? 0, icon: Clock3 },
      { label: "Completed tasks", value: summary?.completed ?? 0, icon: CalendarDays },
    ],
    [summary],
  );

  if (loading) return <PageShell><p className="text-muted-foreground">Loading...</p></PageShell>;
  if (error) return <PageShell><p className="text-destructive">Error: {error}</p></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title="Due Dates"
        description="Monitor upcoming and overdue work across tasks and invoices"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {taskStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-semibold">{stat.value}</p>
                  </div>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Due date overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Invoice overdue</p>
              <p className="mt-1 text-2xl font-semibold">{invoiceDueDates?.overdue?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Invoice upcoming</p>
              <p className="mt-1 text-2xl font-semibold">{invoiceDueDates?.upcoming?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Tracked tasks</p>
              <p className="mt-1 text-2xl font-semibold">{(summary?.overdueTasks?.length ?? 0) + (summary?.upcomingTasks?.length ?? 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoiceDueDates?.overdue?.length === 0 && invoiceDueDates?.upcoming?.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">No invoice due dates right now</p>
            ) : (
              <>
                {invoiceDueDates?.overdue?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-destructive">Overdue invoices</p>
                    {invoiceDueDates.overdue.map((item: any) => (
                      <DueDateItem key={item.id} item={item} kind="invoice" />
                    ))}
                  </div>
                )}
                {invoiceDueDates?.upcoming?.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-sm font-medium text-muted-foreground">Upcoming invoices</p>
                    {invoiceDueDates.upcoming.map((item: any) => (
                      <DueDateItem key={item.id} item={item} kind="invoice" />
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary?.overdueTasks?.length === 0 && summary?.upcomingTasks?.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">No task due dates right now</p>
            ) : (
              <>
                {summary?.overdueTasks?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-destructive">Overdue tasks</p>
                    {summary.overdueTasks.map((item: any) => (
                      <DueDateItem key={item.id} item={item} kind="task" />
                    ))}
                  </div>
                )}
                {summary?.upcomingTasks?.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-sm font-medium text-muted-foreground">Upcoming tasks</p>
                    {summary.upcomingTasks.map((item: any) => (
                      <DueDateItem key={item.id} item={item} kind="task" />
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}