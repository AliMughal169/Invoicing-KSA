"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Send, CheckCircle2, FileText, Edit2, RefreshCw } from "lucide-react";
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

export default function QuotationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  // Dialog state
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  const [isTaxQuote, setIsTaxQuote] = useState(true);
  const [status, setStatus] = useState("draft");
  
  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const [quotationDueDate, setQuotationDueDate] = useState<string>(defaultDueDate);
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Suggestions
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);

  async function reload() {
    const [quotes, cus, prod] = await Promise.all([
      api.listQuotations(),
      api.listCustomers(),
      api.listProducts(),
    ]);
    setRows(quotes);
    setCustomers(cus);
    setProducts(prod);
    if (!customerId && cus[0]) setCustomerId(cus[0].id);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const vatRate = isTaxQuote ? 15 : 0;
  const vat = subtotal * (vatRate / 100);
  const total = subtotal + vat;

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

  function handleDescriptionChange(idx: number, value: string) {
    setActiveLineIdx(idx);
    setProductSuggestions([]);
    setLines((prev) => {
      const next = prev.map((l, i) => (i === idx ? { ...l, description: value } : l));
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
      unitPrice: Number(product.price_sar),
    });
    setProductSuggestions([]);
    setActiveLineIdx(null);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function openCreate() {
    setEditId(null);
    setCustomerId(customers[0]?.id || "");
    setLines([{ ...EMPTY_LINE }]);
    setQuotationDueDate(defaultDueDate);
    setIsTaxQuote(true);
    setStatus("draft");
    setOpen(true);
  }

  async function openEdit(qId: string) {
    const data = await api.getQuotation(qId);
    setEditId(qId);
    setCustomerId(data.customer_id);
    setIsTaxQuote(data.lines?.some((l: any) => Number(l.vat_rate) > 0) ?? true);
    setStatus(data.status);
    setQuotationDueDate(data.due_date ? data.due_date.slice(0, 10) : "");
    setLines(data.lines?.length ? data.lines.map((l: any) => ({
      description: l.description,
      qty: Number(l.qty),
      unitPrice: Number(l.unit_price),
    })) : [{ ...EMPTY_LINE }]);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return;

    // Filter out trailing empty line if it has no description
    const filteredLines = lines.filter((l, idx) => {
      const isLast = idx === lines.length - 1;
      return !(isLast && String(l.description || "").trim() === "");
    });

    if (!filteredLines.length) return;

    const payload = {
      customerId,
      dueDate: quotationDueDate || undefined,
      isTaxQuote,
      status,
      lines: filteredLines.map((l) => ({
        description: l.description,
        qty: Number(l.qty),
        unitPrice: Number(l.unitPrice),
        vatRate: isTaxQuote ? 15 : 0,
      })),
    };

    if (editId) {
      await api.updateQuotation(editId, payload);
    } else {
      await api.createQuotation(payload);
    }

    setOpen(false);
    reload();
  }

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
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> New quotation</Button>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit quotation" : "New quotation"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
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
                <Label>Expiry date (optional)</Label>
                <Input 
                  type="date"
                  value={quotationDueDate}
                  onChange={(e) => setQuotationDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              <div className="flex items-center gap-2 border rounded-lg p-3 bg-muted/30 h-10">
                <input 
                  id="tax-quote"
                  type="checkbox"
                  checked={isTaxQuote}
                  onChange={(e) => setIsTaxQuote(e.target.checked)}
                  className="h-4 w-4 rounded border border-input"
                />
                <Label htmlFor="tax-quote" className="cursor-pointer">Tax quotation (apply 15% VAT)</Label>
              </div>

              {editId && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    required
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="declined">Declined</option>
                    <option value="invoiced" disabled>Invoiced</option>
                  </select>
                </div>
              )}
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
              {isTaxQuote && <div className="flex justify-between"><span className="text-muted-foreground">VAT 15%</span><span>{formatSAR(vat)}</span></div>}
              <div className="flex justify-between text-base font-semibold pt-2 border-t"><span>Total</span><span>{formatSAR(total)}</span></div>
            </div>

            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">{editId ? "Save changes" : "Create quotation"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 mb-4">
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total quotes</p>
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
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p className="text-2xl font-semibold">{stats.sent}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-semibold">{stats.accepted}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Invoiced</p>
                  <p className="text-2xl font-semibold">{stats.invoiced}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-3">
            <Input 
              placeholder="Search by quotation number or customer..."
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
                <option value="all">All statuses</option>
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
            <TableHeader><TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Issue date</TableHead>
              <TableHead>Expiry date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredRows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No quotations found</TableCell></TableRow>}
              {filteredRows.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.number}</TableCell>
                  <TableCell className="text-muted-foreground">{q.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(q.issue_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{q.due_date ? formatDate(q.due_date) : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={q.status} />
                    {q.status === "invoiced" && q.invoice_number && (
                      <span className="ml-2 text-xs text-muted-foreground block">({q.invoice_number})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatSAR(q.total)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2 items-center">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/invoicing/quotations/${q.id}`}>
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </Link>
                      </Button>
                      
                      {q.status !== "invoiced" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(q.id)}>
                            <Edit2 className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button size="sm" variant="outline" className="text-emerald-500 hover:text-emerald-600" onClick={() => handleConvertToInvoice(q.id)}>
                            <RefreshCw className="h-3.5 w-3.5" /> Convert to Invoice
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(q.id)} className="text-destructive hover:bg-destructive/10">
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
