"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Send, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";

interface Line { description: string; qty: number; unitPrice: number; expenseAccountId: string; }
const EMPTY: Line = { description: "", qty: 1, unitPrice: 0, expenseAccountId: "" };

export default function BillsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY }]);

  async function reload() {
    const [bills, vens, accs] = await Promise.all([
      api.listBills(), api.listVendors(), api.listAccounts(),
    ]);
    setRows(bills); setVendors(vens);
    setAccounts(accs.filter((a: any) => a.type === "expense"));
    if (!vendorId && vens[0]) setVendorId(vens[0].id);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId) return;
    await api.createBill({
      vendorId, reference: reference || undefined,
      lines: lines.map(l => ({
        description: l.description, qty: Number(l.qty), unitPrice: Number(l.unitPrice),
        expenseAccountId: l.expenseAccountId || undefined,
      })),
    });
    setOpen(false);
    setLines([{ ...EMPTY }]); setReference("");
    reload();
  }
  function updateLine(i: number, patch: Partial<Line>) {
    setLines((arr) => arr.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  return (
    <PageShell>
      <PageHeader
        title="Bills"
        description="Vendor bills and expenses (AP)"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New bill</Button></DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>New bill</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Vendor</Label>
                    <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required>
                      <option value="">Select vendor</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor reference</Label>
                    <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="INV-AWS-Q3" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Lines</Label>
                  <div className="space-y-2">
                    {lines.map((l, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2">
                        <Input className="col-span-4" placeholder="Description"
                          value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} required />
                        <Input className="col-span-1" type="number" min="0" placeholder="Qty"
                          value={l.qty} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} required />
                        <Input className="col-span-2" type="number" min="0" step="0.01" placeholder="Unit price"
                          value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })} required />
                        <select value={l.expenseAccountId}
                          onChange={(e) => updateLine(i, { expenseAccountId: e.target.value })}
                          className="col-span-4 h-10 rounded-md border border-input bg-background px-2 text-sm">
                          <option value="">Auto-categorize</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                        <Button type="button" size="icon" variant="ghost" className="col-span-1"
                          onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                          disabled={lines.length === 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => setLines([...lines, { ...EMPTY }])}>
                    <Plus className="h-4 w-4" /> Add line
                  </Button>
                </div>

                <div className="border-t pt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatSAR(subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT 15% (Input)</span><span>{formatSAR(vat)}</span></div>
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
              <TableHead>Number</TableHead><TableHead>Vendor</TableHead>
              <TableHead>Reference</TableHead><TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No bills yet</TableCell></TableRow>}
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.number}</TableCell>
                  <TableCell className="text-muted-foreground">{b.vendor_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{b.reference ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(b.bill_date)}</TableCell>
                  <TableCell><StatusBadge status={b.status === "posted" ? "issued" : b.status} /></TableCell>
                  <TableCell className="text-right font-medium">{formatSAR(b.total)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2">
                      {b.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={async () => { await api.postBill(b.id); reload(); }}>
                          <Send className="h-3.5 w-3.5" /> Post
                        </Button>
                      )}
                      {b.status === "posted" && (
                        <Button size="sm" onClick={async () => { await api.payBill(b.id); reload(); }}>
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
