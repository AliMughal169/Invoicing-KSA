"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/page-shell";

const TYPE_LABEL: Record<string, string> = {
  asset: "Asset", liability: "Liability", equity: "Equity", revenue: "Revenue", expense: "Expense",
};

// Custom table footer wrapper since shadcn table doesn't ship one in our minimal set
function TFoot(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot {...props} />;
}

export default function TrialBalancePage() {
  const [data, setData] = useState<any>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(today);

  async function load() { setData(await api.trialBalance({ from, to })); }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const balanced = data && Math.abs(data.totals.debit - data.totals.credit) < 0.01;

  return (
    <PageShell>
      <PageHeader title="Trial Balance" description="Sum of debits and credits across all accounts" />

      <Card className="mb-4">
        <CardContent className="p-4">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5"><Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" /></div>
            <div className="space-y-1.5"><Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" /></div>
            <Button type="submit">Run</Button>
            {data && (
              <div className={`ms-auto text-xs px-2 py-1 rounded ${balanced ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
                {balanced ? "✓ Balanced" : "✗ Not balanced"}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {!data && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Loading…</TableCell></TableRow>}
              {data && data.accounts.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No activity in this period</TableCell></TableRow>
              )}
              {data?.accounts.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{TYPE_LABEL[a.type] ?? a.type}</TableCell>
                  <TableCell className="text-right">{a.balance_debit ? formatSAR(a.balance_debit) : "—"}</TableCell>
                  <TableCell className="text-right">{a.balance_credit ? formatSAR(a.balance_credit) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/accounting/ledger/${a.id}?from=${from}&to=${to}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {data && data.accounts.length > 0 && (
              <TFoot>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td colSpan={3} className="p-4">Totals</td>
                  <td className="p-4 text-right">{formatSAR(data.totals.debit)}</td>
                  <td className="p-4 text-right">{formatSAR(data.totals.credit)}</td>
                  <td></td>
                </tr>
              </TFoot>
            )}
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
