"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Send, CheckCircle2, FileText, RefreshCw } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";

export default function InvoicesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");

  async function reload() {
    try {
      const data = await api.listInvoices();
      setRows(data);
    } catch {}
  }

  useEffect(() => {
    reload();
  }, []);

  // Filtering logic
  const filteredRows = useMemo(() => {
    return rows.filter((inv) => {
      // Status filter
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      
      // Due date filter
      if (dueDateFilter !== "all" && inv.due_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(inv.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const timeDiff = dueDate.getTime() - today.getTime();
        const daysDiff = timeDiff / (1000 * 3600 * 24);
        
        if (dueDateFilter === "overdue" && daysDiff >= 0) return false;
        if (dueDateFilter === "upcoming" && (daysDiff < 0 || daysDiff > 7)) return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          inv.number?.toLowerCase().includes(query) ||
          inv.customer_name?.toLowerCase().includes(query) ||
          inv.lines?.some((l: any) => l.description?.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [rows, statusFilter, dueDateFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = rows.length;
    const drafts = rows.filter((r) => r.status === "draft").length;
    const issued = rows.filter((r) => r.status === "issued").length;
    const paid = rows.filter((r) => r.status === "paid").length;
    const proformas = rows.filter((r) => r.status === "PROFORMA").length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = rows.filter((r) => r.status !== "paid" && r.status !== "PROFORMA" && r.due_date && new Date(r.due_date) < today).length;
    return { total, drafts, issued, paid, proformas, overdue };
  }, [rows]);

  return (
    <PageShell>
      <PageHeader 
        title="Invoices" 
        description="Manage and issue sales tax invoices for customers"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/invoicing/proforma/new">
                <Plus className="h-4 w-4 mr-2" /> New Proforma
              </Link>
            </Button>
            <Button asChild>
              <Link href="/invoicing/invoices/new">
                <Plus className="h-4 w-4 mr-2" /> Create Invoice
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 mb-4">
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Proforma</p>
                  <p className="text-2xl font-bold text-indigo-600">{stats.proformas}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Drafts</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.drafts}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Issued / Sent</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.issued}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-rose-600">{stats.overdue}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-3">
            <Input 
              placeholder="Search by invoice number, customer, or line description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="PROFORMA">Proforma</option>
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <select
                  value={dueDateFilter}
                  onChange={(e) => setDueDateFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Dates</option>
                  <option value="overdue">Overdue</option>
                  <option value="upcoming">Upcoming (within 7 days)</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No invoices found. Click "Create Invoice" or "New Proforma" to issue a new one.
                  </TableCell>
                </TableRow>
              )}
              {filteredRows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-semibold text-zinc-900">{inv.number}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(inv.issue_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : "—"}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                  <TableCell className="text-right font-bold text-zinc-900">{formatSAR(inv.total)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/invoicing/invoices/${inv.id}`}>
                          <FileText className="h-3.5 w-3.5 mr-1" /> View/Print
                        </Link>
                      </Button>
                      {inv.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={async () => { await api.issueInvoice(inv.id); reload(); }}>
                          <Send className="h-3.5 w-3.5 mr-1" /> Issue
                        </Button>
                      )}
                      {inv.status === "issued" && (
                        <Button size="sm" onClick={async () => { await api.payInvoice(inv.id); reload(); }}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Paid
                        </Button>
                      )}
                      {inv.status === "PROFORMA" && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={async () => { 
                            if (confirm("Are you sure you want to convert this proforma invoice to a signed Tax Invoice?")) {
                              try {
                                await api.convertProformaToTaxInvoice(inv.id, { status: "issued" }); 
                                reload();
                              } catch (err: any) {
                                alert("Failed to convert: " + err.message);
                              }
                            }
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Convert
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
