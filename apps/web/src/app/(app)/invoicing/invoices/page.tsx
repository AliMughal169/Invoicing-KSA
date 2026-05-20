"use client";
import { useEffect, useState } from "react";
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
  const [customers, setCustomers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);

  async function reload() {
    const [inv, cus] = await Promise.all([api.listInvoices(), api.listCustomers()]);
    setRows(inv); setCustomers(cus);
    if (!customerId && cus[0]) setCustomerId(cus[0].id);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return;
    await api.createInvoice({ customerId, lines: lines.map(l => ({ ...l, qty: Number(l.qty), unitPrice: Number(l.unitPrice) })) });
    setOpen(false);
    setLines([{ ...EMPTY_LINE }]);
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
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-5">
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
                  <Label>Lines</Label>
                  <div className="space-y-2">
                    {lines.map((l, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2">
                        <Input className="col-span-6" placeholder="Description"
                          value={l.description}
                          onChange={(e) => updateLine(i, { description: e.target.value })} required />
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
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
                    <Plus className="h-4 w-4" /> Add line
                  </Button>
                </div>

                <div className="border-t pt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatSAR(subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT 15%</span><span>{formatSAR(vat)}</span></div>
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Customer</TableHead>
              <TableHead>Issue date</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No invoices yet</TableCell></TableRow>}
              {rows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.number}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(inv.issue_date)}</TableCell>
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
