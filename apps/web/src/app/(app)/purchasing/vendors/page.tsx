"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Building2, Phone, Mail, ArrowRight, Search, Filter, Edit, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";

export default function VendorsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");

  async function reload() {
    try {
      const data = await api.listVendors();
      setRows(data);
    } catch (err) {
      console.error("Failed to load vendors:", err);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vendor? This cannot be undone.")) return;
    try {
      await api.deleteVendor(id);
      reload();
    } catch (err: any) {
      alert("Failed to delete vendor: " + err.message);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((v) => {
      const balance = Number(v.outstanding_balance) || 0;

      if (balanceFilter !== "all") {
        if (balanceFilter === "outstanding" && balance <= 0) return false;
        if (balanceFilter === "settled" && balance > 0) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          v.name_en?.toLowerCase().includes(q) ||
          v.name_ar?.toLowerCase().includes(q) ||
          v.vat_number?.toLowerCase().includes(q) ||
          v.cr_number?.toLowerCase().includes(q) ||
          v.email?.toLowerCase().includes(q) ||
          v.phone?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, balanceFilter, searchQuery]);

  return (
    <PageShell>
      <PageHeader
        title="Vendors Registry"
        description="Manage suppliers, service providers, and purchase outstanding balances"
        actions={
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-zinc-100">
            <Link href="/purchasing/vendors/new">
              <Plus className="h-4 w-4 mr-2" /> Add Vendor
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
              placeholder="Search vendors by title, English/Arabic names, VAT, CR, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-550 h-10 w-full"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 border border-zinc-800 rounded-md bg-zinc-950/20 px-3 h-10">
              <Filter className="h-4 w-4 text-zinc-455" />
              <select
                value={balanceFilter}
                onChange={(e) => setBalanceFilter(e.target.value)}
                className="bg-transparent border-none text-sm text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-zinc-900 text-zinc-200">All Balances</option>
                <option value="outstanding" className="bg-zinc-900 text-zinc-200">Has Outstanding</option>
                <option value="settled" className="bg-zinc-900 text-zinc-200">Settled (0 Balance)</option>
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
                <TableHead className="font-semibold text-zinc-200">Vendor Name</TableHead>
                <TableHead className="font-semibold text-zinc-200">15-Digit VAT #</TableHead>
                <TableHead className="font-semibold text-zinc-200">Payment Terms</TableHead>
                <TableHead className="text-right font-semibold text-zinc-200">Outstanding Balance</TableHead>
                <TableHead className="font-semibold text-zinc-200 pl-6">Contact Info</TableHead>
                <TableHead className="text-right font-semibold text-zinc-200 pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-zinc-400 py-12">
                    No vendors registered yet matching search criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((v) => {
                  const balance = Number(v.outstanding_balance) || 0;
                  return (
                    <TableRow key={v.id} className="border-zinc-800 hover:bg-zinc-900/10">
                      <TableCell className="font-semibold text-zinc-100">
                        <div className="flex flex-col">
                          <span>{v.name_en}</span>
                          <span className="text-xs text-zinc-400 dir-rtl text-right sm:text-left mt-0.5">{v.name_ar}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-300 font-mono text-xs">{v.vat_number || "—"}</TableCell>
                      <TableCell className="text-zinc-300">{v.payment_terms || "Due on Receipt"}</TableCell>
                      <TableCell className="text-right font-bold text-rose-455">{formatSAR(balance)}</TableCell>
                      <TableCell className="pl-6">
                        <div className="flex flex-col gap-1 text-xs text-zinc-450">
                          {v.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {v.email}
                            </span>
                          )}
                          {v.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {v.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end items-center gap-2">
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="border-zinc-850 hover:bg-zinc-800 text-zinc-200"
                          >
                            <Link href={`/purchasing/vendors/${v.id}`}>
                              View Profile <ArrowRight className="h-3.5 w-3.5 ml-1.5 text-indigo-400" />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-zinc-450 hover:text-zinc-100 hover:bg-zinc-800"
                          >
                            <Link href={`/purchasing/vendors/${v.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(v.id)}
                            className="h-8 w-8 text-zinc-455 hover:text-rose-400 hover:bg-zinc-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
