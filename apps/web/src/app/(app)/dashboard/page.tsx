"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText, TrendingUp, Wallet, Users } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type Stats = {
  contacts_count: number; opportunities_count: number; pipeline_value: string;
  invoices_count: number; revenue_total: string; outstanding: string; vat_due: string;
  recentInvoices: any[]; pipelineByStage: any[];
};

const KPI = [
  { key: "revenue_total", label: "Revenue", icon: Wallet, money: true },
  { key: "outstanding", label: "Outstanding", icon: FileText, money: true },
  { key: "pipeline_value", label: "Pipeline value", icon: TrendingUp, money: true },
  { key: "contacts_count", label: "Contacts", icon: Users, money: false },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.statsOverview().then(setStats).catch(e => setError(e.message)); }, []);

  if (error) return <PageShell><p className="text-destructive">{error}</p></PageShell>;
  if (!stats) return <PageShell><p className="text-muted-foreground">Loading...</p></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Overview of your workspace"
        actions={
          <Button asChild>
            <Link href="/invoicing/invoices">
              New invoice <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {KPI.map((k) => {
          const Icon = k.icon;
          const v = (stats as any)[k.key];
          return (
            <Card key={k.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {k.money ? formatSAR(v) : v}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentInvoices.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No invoices yet</TableCell></TableRow>
                )}
                {stats.recentInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell className="text-muted-foreground">{inv.customer_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(inv.issue_date)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="text-right font-medium">{formatSAR(inv.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>VAT due</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Output VAT (YTD)</p>
              <p className="text-3xl font-semibold mt-1">{formatSAR(stats.vat_due)}</p>
            </div>
            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoices issued</span>
                <span>{stats.invoices_count}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Open opportunities</span>
                <span>{stats.opportunities_count}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
