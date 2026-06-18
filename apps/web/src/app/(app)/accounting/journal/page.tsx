"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/page-shell";

export default function JournalPage() {
  const [journal, setJournal] = useState<any[]>([]);
  const [vat, setVat] = useState<any>(null);
  const [pnl, setPnl] = useState<any>(null);

  useEffect(() => {
    api.listJournal().then(setJournal);
    api.vatReport().then(setVat);
    api.pnl().then(setPnl);
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="Accounting"
        description="Journal entries, VAT, and P&L"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/accounting/trial-balance">Trial Balance</Link>
            </Button>
            <Button asChild>
              <Link href="/accounting/journal/new"><Plus className="h-4 w-4" /> New entry</Link>
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="journal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="vat">VAT report</TabsTrigger>
          <TabsTrigger value="pnl">P&L</TabsTrigger>
        </TabsList>

        <TabsContent value="journal">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Memo</TableHead><TableHead>Source</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {journal.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No journal entries</TableCell></TableRow>}
                  {journal.map((je) => (
                    <TableRow key={je.id}>
                      <TableCell className="text-muted-foreground">{formatDate(je.entry_date)}</TableCell>
                      <TableCell className="font-medium">{je.memo ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{je.source_type ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatSAR(je.total_debit)}</TableCell>
                      <TableCell className="text-right">{formatSAR(je.total_credit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vat">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Output VAT (sales)</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{vat ? formatSAR(vat.output_vat) : "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">Taxable sales: {vat ? formatSAR(vat.taxable_sales) : "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Input VAT (purchases)</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{vat ? formatSAR(vat.input_vat) : "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">Taxable purchases: {vat ? formatSAR(vat.taxable_purchases) : "—"}</p>
              </CardContent>
            </Card>
            <Card className={vat && Number(vat.net_vat_due) < 0 ? "border-emerald-500/40" : ""}>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Net VAT due</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{vat ? formatSAR(vat.net_vat_due) : "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {vat && Number(vat.net_vat_due) < 0 ? "Reclaim from ZATCA" : "Payable to ZATCA"}
                </p>
              </CardContent>
            </Card>
          </div>
          {vat && <p className="text-xs text-muted-foreground mt-4">Period: {vat.from} → {vat.to} · Invoices: {vat.invoice_count} · Bills: {vat.bill_count}</p>}
        </TabsContent>

        <TabsContent value="pnl">
          <Card>
            <CardContent className="p-6 space-y-2 text-sm">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Revenue</h3>
              {pnl?.revenue?.length ? pnl.revenue.map((r: any) => (
                <div key={r.code} className="flex justify-between pl-3">
                  <span className="text-muted-foreground"><span className="font-mono text-xs">{r.code}</span> {r.name}</span>
                  <span>{formatSAR(r.amount)}</span>
                </div>
              )) : <p className="text-muted-foreground pl-3">No revenue</p>}
              <div className="flex justify-between pt-2 border-t">
                <span className="font-medium">Total revenue</span>
                <span className="font-medium">{pnl ? formatSAR(pnl.revenue_total) : "—"}</span>
              </div>

              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2 pt-4">Expenses</h3>
              {pnl?.expense?.length ? pnl.expense.map((r: any) => (
                <div key={r.code} className="flex justify-between pl-3">
                  <span className="text-muted-foreground"><span className="font-mono text-xs">{r.code}</span> {r.name}</span>
                  <span>{formatSAR(r.amount)}</span>
                </div>
              )) : <p className="text-muted-foreground pl-3">No expenses</p>}
              <div className="flex justify-between pt-2 border-t">
                <span className="font-medium">Total expenses</span>
                <span className="font-medium">{pnl ? formatSAR(pnl.expense_total) : "—"}</span>
              </div>

              <div className="flex justify-between border-t pt-3 text-base mt-3">
                <span>Net income</span>
                <span className={`font-semibold ${pnl && pnl.net < 0 ? "text-destructive" : ""}`}>{pnl ? formatSAR(pnl.net) : "—"}</span>
              </div>
              {pnl && <p className="text-xs text-muted-foreground pt-2">Period: {pnl.from} → {pnl.to}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
