import { AlertTriangle, Clock3, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DueDateBadge } from "@/components/due-date-badge";
import { formatSAR } from "@/lib/utils";

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function DueDateRow({ item, kind }: { item: any; kind: "invoice" | "task" }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium">{kind === "invoice" ? item.number : item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {kind === "invoice" ? item.customer_name ?? "Unknown customer" : item.description ?? "Task reminder"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <DueDateBadge dueDate={item.due_date} status={item.status} />
        <span className="text-xs text-muted-foreground">{formatDate(item.due_date)}</span>
        {kind === "invoice" && <span className="text-xs font-medium">{formatSAR(item.total)}</span>}
      </div>
    </div>
  );
}

export function DueDateWidget({
  taskSummary,
  invoiceDueDates,
}: {
  taskSummary: any;
  invoiceDueDates: any;
}) {
  const stats = [
    { label: "Overdue", value: taskSummary?.overdue ?? 0, icon: AlertTriangle },
    { label: "Upcoming", value: taskSummary?.upcoming ?? 0, icon: Clock3 },
    { label: "Invoices", value: (invoiceDueDates?.overdue?.length ?? 0) + (invoiceDueDates?.upcoming?.length ?? 0), icon: FileText },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Due date tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center justify-between rounded-xl border bg-muted/30 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-semibold">{stat.value}</p>
                </div>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Next items</p>
          {taskSummary?.overdueTasks?.[0] ? (
            <DueDateRow item={taskSummary.overdueTasks[0]} kind="task" />
          ) : null}
          {taskSummary?.upcomingTasks?.[0] ? (
            <DueDateRow item={taskSummary.upcomingTasks[0]} kind="task" />
          ) : null}
          {invoiceDueDates?.overdue?.[0] ? (
            <DueDateRow item={invoiceDueDates.overdue[0]} kind="invoice" />
          ) : null}
          {invoiceDueDates?.upcoming?.[0] ? (
            <DueDateRow item={invoiceDueDates.upcoming[0]} kind="invoice" />
          ) : null}
          {!taskSummary?.overdueTasks?.[0] && !taskSummary?.upcomingTasks?.[0] && !invoiceDueDates?.overdue?.[0] && !invoiceDueDates?.upcoming?.[0] && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing due soon</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}