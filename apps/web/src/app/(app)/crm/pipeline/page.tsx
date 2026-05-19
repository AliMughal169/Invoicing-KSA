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
import { PageHeader, PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";

const STAGES = ["new", "qualified", "proposal", "won", "lost"];

export default function PipelinePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", amount: "" });
  const [open, setOpen] = useState(false);

  async function reload() { setRows(await api.listOpportunities()); }
  useEffect(() => { reload(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.createOpportunity({ name: form.name, amount: Number(form.amount) });
    setForm({ name: "", amount: "" });
    setOpen(false);
    reload();
  }

  async function moveStage(id: string, stage: string) {
    await api.updateOppStage(id, stage);
    reload();
  }

  return (
    <PageShell>
      <PageHeader
        title="Pipeline"
        description="Track opportunities through stages"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> New opportunity</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New opportunity</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Amount (SAR)</Label>
                  <Input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {STAGES.map((stage) => {
          const items = rows.filter((r) => r.stage === stage);
          const total = items.reduce((s, r) => s + Number(r.amount_sar), 0);
          return (
            <Card key={stage} className="flex flex-col">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <StatusBadge status={stage} />
                <span className="text-xs text-muted-foreground">{items.length} · {formatSAR(total)}</span>
              </div>
              <CardContent className="p-3 space-y-2 flex-1 min-h-[140px]">
                {items.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Empty</p>}
                {items.map((o) => (
                  <div key={o.id} className="rounded-md border bg-background p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{o.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatSAR(o.amount_sar)}</p>
                    <div className="flex gap-1 flex-wrap">
                      {STAGES.filter(s => s !== stage).map(s => (
                        <button key={s} onClick={() => moveStage(o.id, s)}
                          className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border text-muted-foreground hover:text-foreground hover:bg-secondary">
                          → {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
