"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Calendar, FileText, Phone, Mail, MapPin, Receipt, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { formatSAR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell } from "@/components/page-shell";

export default function VendorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vendor, setVendor] = useState<any>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const v = await api.getVendor(id);
      setVendor(v);
      const b = await api.getVendorBills(id);
      setBills(b);
    } catch (err) {
      console.error("Failed to load vendor profile details:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <div className="p-8 text-zinc-300">Loading vendor details...</div>
      </PageShell>
    );
  }

  if (!vendor) {
    return (
      <PageShell>
        <div className="p-8 text-zinc-300">Vendor profile not found.</div>
      </PageShell>
    );
  }

  const outstanding = Number(vendor.outstanding_balance) || 0;
  const paidBillsCount = bills.filter(b => b.status === "PAID").length;
  const pendingBillsCount = bills.filter(b => b.status === "APPROVED").length;

  return (
    <PageShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/purchasing/vendors")}
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-zinc-100 tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6 text-indigo-400" />
              {vendor.name_en}
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">{vendor.name_ar}</p>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid sm:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Outstanding Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-rose-400">{formatSAR(outstanding)}</div>
              <p className="text-xs text-zinc-550 mt-1">Pending supplier dues</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Approved Bills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-amber-400">{pendingBillsCount} Bills</div>
              <p className="text-xs text-zinc-550 mt-1">Waiting for disbursement</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Paid Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-emerald-400">{paidBillsCount} Bills</div>
              <p className="text-xs text-zinc-550 mt-1">Settled payments ledger</p>
            </CardContent>
          </Card>
        </div>

        {/* profile metadata Card */}
        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Vendor Information Details</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-6 text-sm text-zinc-300">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-zinc-450" />
                <span className="text-zinc-400">VAT Number:</span>
                <span className="font-mono font-semibold text-zinc-100">{vendor.vat_number || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-zinc-450" />
                <span className="text-zinc-400">CR Number:</span>
                <span className="font-mono text-zinc-100">{vendor.cr_number || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-zinc-450" />
                <span className="text-zinc-400">Payment Terms:</span>
                <span className="text-zinc-100 font-semibold">{vendor.payment_terms || "Due on Receipt"}</span>
              </div>
            </div>

            <div className="space-y-3">
              {vendor.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-zinc-450" />
                  <span className="text-zinc-400">Email:</span>
                  <a href={`mailto:${vendor.email}`} className="text-indigo-400 hover:underline">{vendor.email}</a>
                </div>
              )}
              {vendor.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-zinc-450" />
                  <span className="text-zinc-400">Phone:</span>
                  <span className="text-zinc-100">{vendor.phone}</span>
                </div>
              )}
              {vendor.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-zinc-450 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-zinc-400">Physical Address:</span>
                    <span className="text-zinc-200 mt-0.5">{vendor.address}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* TABS CONTAINER */}
        <Tabs defaultValue="bills" className="w-full">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="bills" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
              Bills History
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
              Payments Ledger
            </TabsTrigger>
          </TabsList>

          {/* Bills History Tab */}
          <TabsContent value="bills" className="mt-4">
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="sticky top-0 bg-zinc-950 z-10">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-200">Bill Number</TableHead>
                        <TableHead className="text-zinc-200">Invoice Ref</TableHead>
                        <TableHead className="text-zinc-200">Bill Date</TableHead>
                        <TableHead className="text-zinc-200">Due Date</TableHead>
                        <TableHead className="text-right text-zinc-200">Total Amount</TableHead>
                        <TableHead className="text-center text-zinc-200">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bills.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-zinc-400 py-8">
                            No bills found for this vendor.
                          </TableCell>
                        </TableRow>
                      ) : (
                        bills.map((b) => {
                          let statusColor = "text-zinc-400 bg-zinc-900";
                          if (b.status === "APPROVED") statusColor = "text-amber-300 bg-amber-950/40 border-amber-900/50";
                          if (b.status === "PAID") statusColor = "text-emerald-300 bg-emerald-950/40 border-emerald-900/50";

                          return (
                            <TableRow key={b.id} className="border-zinc-800 hover:bg-zinc-900/10">
                              <TableCell className="font-semibold text-zinc-100">
                                <Link href={`/invoicing/bills/${b.id}`} className="hover:underline flex items-center gap-1.5 text-indigo-400">
                                  <FileText className="h-3.5 w-3.5" /> {b.number}
                                </Link>
                              </TableCell>
                              <TableCell className="text-zinc-300 font-mono text-xs">{b.vendor_invoice_ref || "—"}</TableCell>
                              <TableCell className="text-zinc-300">{new Date(b.bill_date).toLocaleDateString()}</TableCell>
                              <TableCell className="text-zinc-300">
                                {b.due_date ? new Date(b.due_date).toLocaleDateString() : "—"}
                              </TableCell>
                              <TableCell className="text-right font-bold text-zinc-100">{formatSAR(b.total)}</TableCell>
                              <TableCell className="text-center">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-semibold ${statusColor}`}>
                                  {b.status}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Ledger Tab */}
          <TabsContent value="payments" className="mt-4">
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="sticky top-0 bg-zinc-950 z-10">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-200">Payment Date</TableHead>
                        <TableHead className="text-zinc-200">Ref Bill</TableHead>
                        <TableHead className="text-zinc-200">Payment Method</TableHead>
                        <TableHead className="text-right text-zinc-200">Paid Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bills.filter(b => b.status === "PAID").length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-zinc-400 py-8">
                            No paid settlements found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        bills.filter(b => b.status === "PAID").map((b) => (
                          <TableRow key={b.id} className="border-zinc-800 hover:bg-zinc-900/10">
                            <TableCell className="text-zinc-350">{new Date(b.created_at || b.bill_date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-zinc-200 font-semibold">
                              <Link href={`/invoicing/bills/${b.id}`} className="hover:underline text-indigo-400">
                                {b.number}
                              </Link>
                            </TableCell>
                            <TableCell className="text-zinc-300">Bank Transfer / Cash</TableCell>
                            <TableCell className="text-right font-bold text-emerald-400">-{formatSAR(b.total)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
