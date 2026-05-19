"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

export default function ContactsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [open, setOpen] = useState(false);

  async function reload() { setRows(await api.listContacts()); }
  useEffect(() => { reload(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.createContact(form);
    setForm({ name: "", email: "", phone: "" });
    setOpen(false);
    reload();
  }
  async function remove(id: string) {
    await api.deleteContact(id);
    reload();
  }

  return (
    <PageShell>
      <PageHeader
        title="Contacts"
        description="People in your CRM"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> New contact</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New contact</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
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
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No contacts yet</TableCell></TableRow>
              )}
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.company_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
