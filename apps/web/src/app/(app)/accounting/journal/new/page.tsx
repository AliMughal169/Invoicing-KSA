"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatSAR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/page-shell";

interface Line { accountId: string; debit: string; credit: string; }
const EMPTY: Line = { accountId: "", debit: "", credit: "" };

export default function NewJournalEntryPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY }, { ...EMPTY }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.listAccounts().then(setAccounts); }, []);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diff = +(totalDebit - totalCredit).toFixed(2);
  const balanced = Math.abs(diff) < 0.005 && totalDebit > 0;

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((arr) => arr.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!balanced) { setError("Entry not balanced"); return; }
    setBusy(true);
    try {
      await api.createManualJE({
        date, memo,
        lines: lines
          .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
          .map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || undefined,
            credit: Number(l.credit) || undefined,
          })),
      });
      router.push("/accounting/journal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <PageShell>
      <PageHeader title="New journal entry" description="Manual debits and credits — must balance" />
      <form onSubmit={submit}>
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Memo</Label>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description" required /></div>
            </div>

            <div className="space-y-2">
              <Label>Lines</Label>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <select value={l.accountId}
                      onChange={(e) => updateLine(i, { accountId: e.target.value })}
                      className="col-span-6 h-10 rounded-md border border-input bg-background px-2 text-sm" required>
                      <option value="">Select account</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                    <Input className="col-span-2" type="number" min="0" step="0.01" placeholder="Debit"
                      value={l.debit} onChange={(e) => updateLine(i, { debit: e.target.value, credit: "" })} />
                    <Input className="col-span-2" type="number" min="0" step="0.01" placeholder="Credit"
                      value={l.credit} onChange={(e) => updateLine(i, { credit: e.target.value, debit: "" })} />
                    <Button type="button" size="icon" variant="ghost" className="col-span-1"
                      onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                      disabled={lines.length <= 2}>
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

            <div className="border-t pt-4 grid grid-cols-3 gap-4 text-sm">
              <div><p className="text-muted-foreground">Total debit</p><p className="font-semibold mt-1">{formatSAR(totalDebit)}</p></div>
              <div><p className="text-muted-foreground">Total credit</p><p className="font-semibold mt-1">{formatSAR(totalCredit)}</p></div>
              <div><p className="text-muted-foreground">Difference</p>
                <p className={`font-semibold mt-1 ${balanced ? "text-emerald-400" : "text-destructive"}`}>
                  {balanced ? "✓ Balanced" : formatSAR(diff)}
                </p>
              </div>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={!balanced || busy}>{busy ? "Posting…" : "Post entry"}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </PageShell>
  );
}
