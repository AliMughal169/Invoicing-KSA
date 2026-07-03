"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, CheckCircle, FileText, Send, Search, Filter, Edit, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";

export default function BillsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function reload() {
    try {
      const data = await api.listBills();
      setRows(data);
    } catch (err) {
      console.error("Failed to load bills:", err);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.postBill(id);
      reload();
    } catch (err: any) {
      alert("Failed to approve bill: " + err.message);
    }
  };

  const handlePay = async (id: string) => {
    try {
      await api.payBill(id);
      reload();
    } catch (err: any) {
      alert("Failed to record bill payment: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft bill? This cannot be undone.")) return;
    try {
      await api.deleteBill(id);
      reload();
    } catch (err: any) {
      alert("Failed to delete bill: " + err.message);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) {
        return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          b.number?.toLowerCase().includes(q) ||
          b.vendor_invoice_ref?.toLowerCase().includes(q) ||
          b.vendor_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, statusFilter, searchQuery]);

  return (
    <PageShell>
      <PageHeader
        title="Purchase Bills"
        description="Verify supplier invoices, record stock additions, and settle accounts payable accounts"
        actions={
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-zinc-100">
            <Link href="/purchasing/bills/new">
              <Plus className="h-4 w-4 mr-2" /> New Bill
            </Link>
          </Button>
        }
      />

      {/* FILTER SEARCH TOOLBAR */}
      <Card className="mb-6 bg-zinc-900/30 border-zinc-800">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-450" />
            <Input
              placeholder="Search bills by number, supplier invoice reference, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-555 h-10 w-full"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 border border-zinc-800 rounded-md bg-zinc-950/20 px-3 h-10">
              <Filter className="h-4 w-4 text-zinc-455" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-none text-sm text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-zinc-900 text-zinc-200">All Statuses</option>
                <option value="DRAFT" className="bg-zinc-900 text-zinc-200">Draft</option>
                <option value="APPROVED" className="bg-zinc-900 text-zinc-200">Approved</option>
                <option value="PAID" className="bg-zinc-900 text-zinc-200">Paid</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/30 border-zinc-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="font-semibold text-zinc-200">Bill Number</TableHead>
                <TableHead className="font-semibold text-zinc-200">Vendor / Supplier</TableHead>
                <TableHead className="font-semibold text-zinc-200">Invoice Reference</TableHead>
                <TableHead className="font-semibold text-zinc-200">Bill Date</TableHead>
                <TableHead className="font-semibold text-zinc-200 text-center">Status</TableHead>
                <TableHead className="text-right font-semibold text-zinc-200">Total (SAR)</TableHead>
                <TableHead className="text-right font-semibold text-zinc-200 pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-zinc-400 py-12">
                    No supplier bills recorded matching search criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((b) => {
                  let statusColor = "text-zinc-400 bg-zinc-900";
                  if (b.status === "APPROVED") statusColor = "text-amber-300 bg-amber-950/40 border-amber-900/50";
                  if (b.status === "PAID") statusColor = "text-emerald-300 bg-emerald-950/40 border-emerald-900/50";

                  return (
                    <TableRow key={b.id} className="border-zinc-800 hover:bg-zinc-900/10">
                      <TableCell className="font-semibold text-zinc-100">
                        <div className="flex items-center gap-1.5 text-zinc-200">
                          <FileText className="h-4 w-4 text-zinc-450" />
                          <span>{b.number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-200 font-semibold">{b.vendor_name || "—"}</TableCell>
                      <TableCell className="text-zinc-300 font-mono text-xs">{b.vendor_invoice_ref || "—"}</TableCell>
                      <TableCell className="text-zinc-300">{new Date(b.bill_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-semibold ${statusColor}`}>
                          {b.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-zinc-100">{formatSAR(b.total)}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end items-center gap-2">
                          {b.status === "DRAFT" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(b.id)}
                                className="border-zinc-800 text-zinc-200 hover:bg-zinc-800"
                              >
                                <Send className="h-3.5 w-3.5 mr-1.5 text-indigo-400" /> Approve
                              </Button>
                              <Button
                                asChild
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-zinc-450 hover:text-zinc-100 hover:bg-zinc-800"
                              >
                                <Link href={`/purchasing/bills/${b.id}/edit`}>
                                  <Edit className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(b.id)}
                                className="h-8 w-8 text-zinc-455 hover:text-rose-400 hover:bg-zinc-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {b.status === "APPROVED" && (
                            <Button
                              size="sm"
                              onClick={() => handlePay(b.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-zinc-100"
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Record Payment
                            </Button>
                          )}
                          {b.status === "PAID" && (
                            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5" /> Settled
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
