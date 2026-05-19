"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";

export default function ProductsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", sku: "", priceSar: "" });
  const [open, setOpen] = useState(false);

  async function reload() { setRows(await api.listProducts()); }
  useEffect(() => { reload(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.createProduct({ name: form.name, sku: form.sku, priceSar: Number(form.priceSar) });
    setForm({ name: "", sku: "", priceSar: "" });
    setOpen(false);
    reload();
  }

  return (
    <PageShell>
      <PageHeader
        title="Products & services"
        description="Items you sell"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New product</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>SKU</Label>
                  <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div className="space-y-2"><Label>Price (SAR)</Label>
                  <Input type="number" min="0" step="0.01" value={form.priceSar} onChange={(e) => setForm({ ...form, priceSar: e.target.value })} required /></div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit">Create</Button>
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
              <TableHead>Name</TableHead><TableHead>SKU</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">VAT %</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">No products yet</TableCell></TableRow>}
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatSAR(p.price_sar)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{p.vat_rate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
