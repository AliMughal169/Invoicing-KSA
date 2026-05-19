"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <PageHeader title="Accounting" description="Journal entries, VAT, and P&L" />

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
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Output VAT</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{vat ? formatSAR(vat.output_vat) : "—"}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Taxable sales</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{vat ? formatSAR(vat.taxable_sales) : "—"}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Invoices</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{vat?.invoice_count ?? "—"}</p></CardContent>
            </Card>
          </div>
          {vat && <p className="text-xs text-muted-foreground mt-4">Period: {vat.from} → {vat.to}</p>}
        </TabsContent>

        <TabsContent value="pnl">
          <Card>
            <CardContent className="p-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-medium">{pnl ? formatSAR(pnl.revenue) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expenses</span>
                <span className="font-medium">{pnl ? formatSAR(pnl.expense) : "—"}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-base">
                <span>Net income</span>
                <span className="font-semibold">{pnl ? formatSAR(pnl.net) : "—"}</span>
              </div>
              {pnl && <p className="text-xs text-muted-foreground pt-2">Period: {pnl.from} → {pnl.to}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
