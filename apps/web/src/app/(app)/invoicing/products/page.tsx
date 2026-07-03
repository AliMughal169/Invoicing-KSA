"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, Edit, Package, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";

export default function ProductsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function reload() {
    try {
      const data = await api.listProducts();
      setRows(data);
    } catch (err) {
      console.error("Failed to load products list:", err);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((p) => {
      const qty = Number(p.qty_on_hand) || 0;
      const reorder = Number(p.reorder_level) || 0;
      const track = p.track_inventory || false;

      if (statusFilter !== "all") {
        if (statusFilter === "non-stock" && track) return false;
        if (statusFilter === "in-stock" && (!track || qty <= reorder)) return false;
        if (statusFilter === "low-stock" && (!track || qty > reorder || qty <= 0)) return false;
        if (statusFilter === "out-of-stock" && (!track || qty > 0)) return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          p.name_en?.toLowerCase().includes(query) ||
          p.name_ar?.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query) ||
          p.unit?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [rows, statusFilter, searchQuery]);

  return (
    <PageShell>
      <PageHeader
        title="Products & Inventory Workspace"
        description="Manage service items, track physical stock levels, and audit movements"
        actions={
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-zinc-100">
            <Link href="/invoicing/products/new">
              <Plus className="h-4 w-4 mr-2" /> Add Product
            </Link>
          </Button>
        }
      />

      <Card className="mb-6 bg-zinc-900/30 border-zinc-800 no-print">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-450" />
              <Input
                placeholder="Search products by title, SKU, or unit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-zinc-950/50 border-zinc-800 text-zinc-100 h-10 w-full placeholder:text-zinc-550"
              />
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 border border-zinc-800 rounded-md bg-zinc-950/20 px-3 h-10">
                <Filter className="h-4 w-4 text-zinc-450" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent border-none text-sm text-zinc-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-zinc-900 text-zinc-200">All Stock Statuses</option>
                  <option value="in-stock" className="bg-zinc-900 text-zinc-200">In Stock</option>
                  <option value="low-stock" className="bg-zinc-900 text-zinc-200">Low Stock</option>
                  <option value="out-of-stock" className="bg-zinc-900 text-zinc-200">Out of Stock</option>
                  <option value="non-stock" className="bg-zinc-900 text-zinc-200">Non-Stock/Service</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/30 border-zinc-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900/50">
                <TableHead className="font-semibold text-zinc-200">Product Name</TableHead>
                <TableHead className="font-semibold text-zinc-200">SKU</TableHead>
                <TableHead className="font-semibold text-zinc-200">Unit</TableHead>
                <TableHead className="text-right font-semibold text-zinc-200">Sales Price</TableHead>
                <TableHead className="text-right font-semibold text-zinc-200">Cost Price</TableHead>
                <TableHead className="text-right font-semibold text-zinc-200">Stock Balance</TableHead>
                <TableHead className="font-semibold text-zinc-200 pl-6">Stock Status</TableHead>
                <TableHead className="text-right font-semibold text-zinc-200">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-zinc-400 py-12">
                    No products found. Click "Add Product" to create one.
                  </TableCell>
                </TableRow>
              )}
              {filteredRows.map((p) => {
                const qty = Number(p.qty_on_hand) || 0;
                const reorder = Number(p.reorder_level) || 0;
                const track = p.track_inventory || false;

                let badgeText = "Non-Stock/Service";
                let badgeColor = "bg-zinc-900/80 text-zinc-400 border-zinc-800";
                let BadgeIcon = HelpCircle;

                if (track) {
                  if (qty > reorder) {
                    badgeText = `In Stock (${qty})`;
                    badgeColor = "bg-emerald-950/40 text-emerald-300 border-emerald-900/50";
                    BadgeIcon = CheckCircle;
                  } else if (qty <= reorder && qty > 0) {
                    badgeText = `Low Stock (${qty})`;
                    badgeColor = "bg-amber-950/40 text-amber-300 border-amber-900/50";
                    BadgeIcon = AlertTriangle;
                  } else {
                    badgeText = "Out of Stock";
                    badgeColor = "bg-rose-950/40 text-rose-300 border-rose-900/50";
                    BadgeIcon = Package;
                  }
                }

                return (
                  <TableRow key={p.id} className="border-zinc-800 hover:bg-zinc-900/10">
                    <TableCell className="font-semibold text-zinc-100">
                      <div className="flex flex-col">
                        <span>{p.name_en}</span>
                        <span className="text-xs text-zinc-400 dir-rtl text-right sm:text-left mt-0.5">{p.name_ar}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-300 font-mono text-xs">{p.sku ?? "—"}</TableCell>
                    <TableCell className="text-zinc-300">{p.unit ?? "Pcs"}</TableCell>
                    <TableCell className="text-right font-bold text-zinc-100">{formatSAR(p.sales_price)}</TableCell>
                    <TableCell className="text-right font-bold text-zinc-300">{formatSAR(p.cost_price)}</TableCell>
                    <TableCell className="text-right font-bold text-zinc-100">
                      {track ? qty : "—"}
                    </TableCell>
                    <TableCell className="pl-6">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${badgeColor}`}>
                        <BadgeIcon className="h-3.5 w-3.5" />
                        <span>{badgeText}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                      >
                        <Link href={`/invoicing/products/${p.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
