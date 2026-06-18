"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";

export default function VendorsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", vatNumber: "", email: "", phone: "", city: "", country: "" });
  const [open, setOpen] = useState(false);

  async function reload() { setRows(await api.listVendors()); }
  useEffect(() => { reload(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.createVendor(form);
    setForm({ name: "", vatNumber: "", email: "", phone: "", city: "", country: "" });
    setOpen(false);
    reload();
  }

  return (
    <PageShell>
      <PageHeader
        title="Vendors"
        description="Suppliers and service providers"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New vendor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New vendor</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>VAT #</Label>
                    <Input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="space-y-2"><Label>City</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Country</Label>
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="SA" /></div>
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
              <TableHead>Name</TableHead><TableHead>VAT #</TableHead>
              <TableHead>Email</TableHead><TableHead>City</TableHead><TableHead>Added</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No vendors yet</TableCell></TableRow>}
              {rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell className="text-muted-foreground">{v.vat_number ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{v.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{[v.city, v.country].filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(v.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
