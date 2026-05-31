"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Send, CheckCircle2, FileText } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
interface Line { description: string; qty: number; unitPrice: number; }
const EMPTY_LINE: Line = { description: "", qty: 1, unitPrice: 0 };

export default function InvoicesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [isTaxInvoice, setIsTaxInvoice] = useState(true);
  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>(defaultDueDate);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);

  async function reload() {
    const [inv, cus, prod] = await Promise.all([api.listInvoices(), api.listCustomers(), api.listProducts()]);
    setRows(inv); setCustomers(cus); setProducts(prod);
    if (!customerId && cus[0]) setCustomerId(cus[0].id);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const vatRate = isTaxInvoice ? 15 : 0;
  const vat = subtotal * (vatRate / 100);
  const total = subtotal + vat;

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
        if (dueDateFilter === "this-week" && (daysDiff < 0 || daysDiff > 7)) return false;
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = rows.filter((r) => r.status !== "paid" && r.due_date && new Date(r.due_date) < today).length;
    return { total, drafts, issued, paid, overdue };
  }, [rows]);

  // Product search for autocomplete
  function handleDescriptionChange(idx: number, value: string) {
    setActiveLineIdx(idx);
    setProductSuggestions([]);
    setLines((prev) => {
      const next = prev.map((l, i) => (i === idx ? { ...l, description: value } : l));
      // If typing into the last line and it was previously empty, append a new empty line
      const wasLastEmpty = prev[idx] && String(prev[idx].description || "").trim() === "";
      if (idx === prev.length - 1 && value.trim() !== "" && wasLastEmpty) {
        next.push({ ...EMPTY_LINE });
      }
      return next;
    });

    if (value.length >= 2) {
      const matches = products.filter((p) => p.name.toLowerCase().includes(value.toLowerCase()));
      setProductSuggestions(matches);
    }
  }

  function selectProduct(idx: number, product: any) {
    updateLine(idx, { 
      description: product.name,
      unitPrice: product.price_sar
    });
    setProductSuggestions([]);
    setActiveLineIdx(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return;
    await api.createInvoice({ 
      customerId, 
      dueDate: invoiceDueDate || undefined,
      isTaxInvoice,
      lines: lines.map(l => ({ ...l, qty: Number(l.qty), unitPrice: Number(l.unitPrice) })) 
    });
    setOpen(false);
    setLines([{ ...EMPTY_LINE }]);
    setInvoiceDueDate(defaultDueDate);
    setIsTaxInvoice(true);
    reload();
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((arr) => arr.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  return (
    <PageShell>
      <PageHeader
        title="Invoices"
        description="Create, issue, and track invoices"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New invoice</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      required
                    >
                      <option value="">Select customer</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Due date (optional)</Label>
                    <Input 
                      type="date"
                      value={invoiceDueDate}
                      onChange={(e) => setInvoiceDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 border rounded-lg p-3 bg-muted/30">
                  <input 
                    id="tax-invoice"
                    type="checkbox"
                    checked={isTaxInvoice}
                    onChange={(e) => setIsTaxInvoice(e.target.checked)}
                    className="h-4 w-4 rounded border border-input"
                  />
                  <Label htmlFor="tax-invoice" className="cursor-pointer">Tax invoice (apply 15% VAT)</Label>
                </div>

                <div className="space-y-2">
                  <Label>Lines</Label>
                  <div className="space-y-3">
                    {lines.map((l, i) => (
                      <div key={i}>
                        <div className="grid grid-cols-12 gap-2 relative">
                          <div className="col-span-6 relative">
                            <Input className="w-full" placeholder="Description"
                              value={l.description}
                              onChange={(e) => handleDescriptionChange(i, e.target.value)} required />
                            {activeLineIdx === i && productSuggestions.length > 0 && (
                              <div className="absolute top-full left-0 right-0 bg-white border border-input rounded-md shadow-lg z-10 max-h-48 overflow-y-auto mt-1">
                                {productSuggestions.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => selectProduct(i, p)}
                                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                                  >
                                    <div className="font-medium">{p.name}</div>
                                    <div className="text-xs text-muted-foreground">{formatSAR(p.price_sar)}</div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <Input className="col-span-2" type="number" min="0" placeholder="Qty"
                            value={l.qty}
                            onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} required />
                          <Input className="col-span-3" type="number" min="0" step="0.01" placeholder="Unit price"
                            value={l.unitPrice}
                            onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })} required />
                          <Button type="button" size="icon" variant="ghost" className="col-span-1"
                            onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                            disabled={lines.length === 1}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
                    <Plus className="h-4 w-4" /> Add line
                  </Button>
                </div>

                <div className="border-t pt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatSAR(subtotal)}</span></div>
                  {isTaxInvoice && <div className="flex justify-between"><span className="text-muted-foreground">VAT 15%</span><span>{formatSAR(vat)}</span></div>}
                  <div className="flex justify-between text-base font-semibold pt-2 border-t"><span>Total</span><span>{formatSAR(total)}</span></div>
                </div>

                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit">Create draft</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total invoices</p>
                  <p className="text-2xl font-semibold">{stats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Drafts</p>
                  <p className="text-2xl font-semibold">{stats.drafts}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Issued</p>
                  <p className="text-2xl font-semibold">{stats.issued}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-semibold">{stats.overdue}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-3">
            <Input 
              placeholder="Search by invoice number, customer, or description..."
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
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <select
                  value={dueDateFilter}
                  onChange={(e) => setDueDateFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All dates</option>
                  <option value="overdue">Overdue</option>
                  <option value="upcoming">Upcoming (this week)</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Customer</TableHead>
              <TableHead>Issue date</TableHead><TableHead>Due date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredRows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No invoices found</TableCell></TableRow>}
              {filteredRows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.number}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(inv.issue_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : "—"}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                  <TableCell className="text-right font-medium">{formatSAR(inv.total)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/invoicing/invoices/${inv.id}`}>
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </Link>
                      </Button>
                      {inv.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={async () => { await api.issueInvoice(inv.id); reload(); }}>
                          <Send className="h-3.5 w-3.5" /> Issue
                        </Button>
                      )}
                      {inv.status === "issued" && (
                        <Button size="sm" onClick={async () => { await api.payInvoice(inv.id); reload(); }}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark paid
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
