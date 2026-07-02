"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FileText, RefreshCw } from "lucide-react";
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

export default function QuotationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function reload() {
    try {
      const quotes = await api.listQuotations();
      setRows(quotes);
    } catch {}
  }

  useEffect(() => {
    reload();
  }, []);

  // Filtering
  const filteredRows = useMemo(() => {
    return rows.filter((q) => {
      if (statusFilter !== "all" && q.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          q.number?.toLowerCase().includes(query) ||
          q.customer_name?.toLowerCase().includes(query) ||
          q.lines?.some((l: any) => l.description?.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [rows, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = rows.length;
    const drafts = rows.filter((r) => r.status === "draft").length;
    const sent = rows.filter((r) => r.status === "sent").length;
    const accepted = rows.filter((r) => r.status === "accepted").length;
    const invoiced = rows.filter((r) => r.status === "invoiced").length;
    return { total, drafts, sent, accepted, invoiced };
  }, [rows]);

  async function handleDelete(qId: string) {
    if (confirm("Are you sure you want to delete this quotation?")) {
      await api.deleteQuotation(qId);
      reload();
    }
  }

  async function handleConvertToInvoice(qId: string) {
    try {
      await api.convertQuotationToInvoice(qId);
      alert("Quotation converted to invoice successfully!");
      reload();
    } catch (err: any) {
      alert("Failed to convert: " + err.message);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Quotations"
        description="Manage Sales Quotes and Proforma Invoices"
        actions={
          <Button asChild>
            <Link href="/invoicing/quotations/new">
              <Plus className="h-4 w-4 mr-2" /> New Quotation
            </Link>
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Quotes</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
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
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.accepted}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-3">
            <Input 
              placeholder="Search by quotation number, customer name, or line description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10"
            />
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="invoiced">Invoiced</option>
              </select>
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
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No quotations found. Click "New Quotation" to create one.
                  </TableCell>
                </TableRow>
              )}
              {filteredRows.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-semibold text-zinc-900">{q.number}</TableCell>
                  <TableCell className="text-muted-foreground">{q.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(q.issue_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{q.due_date ? formatDate(q.due_date) : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={q.status} />
                    {q.status === "invoiced" && q.invoice_number && (
                      <span className="ml-2 text-xs text-muted-foreground block font-semibold mt-0.5">({q.invoice_number})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold text-zinc-900">{formatSAR(q.total)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2 items-center">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/invoicing/quotations/${q.id}`}>
                          <FileText className="h-3.5 w-3.5 mr-1" /> View/Print
                        </Link>
                      </Button>
                      
                      {q.status !== "invoiced" && (
                        <>
                          <Button size="sm" variant="outline" className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50" onClick={() => handleConvertToInvoice(q.id)}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Convert
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(q.id)} className="text-zinc-400 hover:text-rose-600 hover:bg-rose-50/20">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
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
