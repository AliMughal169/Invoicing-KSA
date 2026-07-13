"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/page-shell";

function LedgerContent() {
  const { accountId } = useParams<{ accountId: string }>();
  const params = useSearchParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.generalLedger(accountId, {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    }).then(setData);
  }, [accountId, params]);

  return (
    <PageShell>
      <Button asChild variant="outline" size="sm" className="mb-4">
        <Link href="/accounting/trial-balance"><ArrowLeft className="h-4 w-4" /> Trial Balance</Link>
      </Button>
      <PageHeader
        title={data ? `${data.account.code} — ${data.account.name}` : "Loading…"}
        description={data ? `${data.account.type.toUpperCase()} · Ending balance: ${formatSAR(data.ending_balance)}` : undefined}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Memo</TableHead><TableHead>Source</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data && data.lines.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No activity</TableCell></TableRow>
              )}
              {data?.lines.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground">{formatDate(l.entry_date)}</TableCell>
                  <TableCell>{l.memo ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{l.source_type}</TableCell>
                  <TableCell className="text-right">{Number(l.debit) > 0 ? formatSAR(l.debit) : "—"}</TableCell>
                  <TableCell className="text-right">{Number(l.credit) > 0 ? formatSAR(l.credit) : "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatSAR(l.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}

export default function GLPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading general ledger...</div>}>
      <LedgerContent />
    </Suspense>
  );
}
