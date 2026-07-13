"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";

export default function CreditNotesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const data = await api.listInvoices("CREDIT_NOTE");
      setRows(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const query = searchQuery.toLowerCase();
      return (
        r.number?.toLowerCase().includes(query) ||
        r.customer_name?.toLowerCase().includes(query)
      );
    });
  }, [rows, searchQuery]);

  return (
    <PageShell>
      <PageHeader 
        title="Credit Notes / إشعارات دائنة" 
        description="Manage and issue sales return credit notes for dynamic adjustment"
      />

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search by note number or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        <Card className="shadow-sm border-zinc-200">
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-zinc-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="font-bold text-zinc-700">Note Reference</TableHead>
                    <TableHead className="font-bold text-zinc-700">Original Invoice</TableHead>
                    <TableHead className="font-bold text-zinc-700">Customer Profile</TableHead>
                    <TableHead className="font-bold text-zinc-700">Date</TableHead>
                    <TableHead className="font-bold text-zinc-700 text-center">Status</TableHead>
                    <TableHead className="font-bold text-zinc-700 text-right">Adjusted Total (SAR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                        Loading credit notes...
                      </TableCell>
                    </TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                        No credit notes found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row) => (
                      <TableRow 
                        key={row.id} 
                        className="hover:bg-zinc-50/50 cursor-pointer"
                        onClick={() => router.push(`/invoicing/invoices/${row.id}`)}
                      >
                        <TableCell className="font-bold text-zinc-900">
                          <span className="text-indigo-600 hover:underline">
                            {row.number}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {row.original_invoice_id ? (
                            <Link href={`/invoicing/invoices/${row.original_invoice_id}`} className="text-zinc-600 hover:underline hover:text-indigo-600 text-xs font-mono">
                              View Original
                            </Link>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-zinc-800">{row.customer_name ?? "—"}</TableCell>
                        <TableCell className="text-zinc-600 text-xs">{formatDate(row.issue_date)}</TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="text-right font-bold text-zinc-900">
                          {formatSAR(row.total)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
