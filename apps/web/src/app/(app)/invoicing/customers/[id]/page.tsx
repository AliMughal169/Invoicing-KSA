"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Edit3, FileText, Printer, Settings, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { buildCustomerContactName, buildCustomerDisplayName, customerFormToApi, customerLocationLabel, customerPhoneLabel, customerRecordToFormValues, formatCustomerAddress, parseCustomerDocuments } from "@/lib/customer";
import { formatDate, formatSAR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageShell } from "@/components/page-shell";
import { CustomerForm } from "@/components/customer-form";
import { StatusBadge } from "@/components/status-badge";

function asNumber(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function chartMonthLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [busy, setBusy] = useState(false);

  // Comments CRUD states
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  async function reload() {
    try {
      setError(null);
      const data = await api.getCustomer(id);
      setCustomer(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load customer";
      setError(message);
      console.error("Failed to load customer:", err);
    }
  }

  useEffect(() => {
    void reload();
  }, [id]);

  const monthlyRevenue = useMemo(() => {
    if (!customer) return [];
    const buckets = new Map<string, { period: string; invoiced: number; received: number }>();
    for (const invoice of customer.invoices ?? []) {
      const key = String(invoice.issue_date ?? "").slice(0, 7);
      if (!key) continue;
      const period = chartMonthLabel(`${key}-01`);
      const bucket = buckets.get(key) ?? { period, invoiced: 0, received: 0 };
      bucket.invoiced += asNumber(invoice.total);
      buckets.set(key, bucket);
    }
    for (const payment of customer.payments ?? []) {
      const key = String(payment.created_at ?? payment.entry_date ?? "").slice(0, 7);
      if (!key) continue;
      const period = chartMonthLabel(`${key}-01`);
      const bucket = buckets.get(key) ?? { period, invoiced: 0, received: 0 };
      bucket.received += asNumber(payment.invoice_total);
      buckets.set(key, bucket);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, bucket]) => bucket);
  }, [customer]);

  const statementRows = useMemo(() => {
    let balance = 0;
    return (customer?.statement ?? []).map((entry: any) => {
      balance += asNumber(entry.balance_delta ?? entry.amount);
      return { ...entry, runningBalance: balance };
    });
  }, [customer]);

  const regularInvoices = useMemo(() => {
    return customer?.invoices?.filter((inv: any) => inv.status !== "PROFORMA") ?? [];
  }, [customer]);

  const proformaInvoices = useMemo(() => {
    return customer?.invoices?.filter((inv: any) => inv.status === "PROFORMA") ?? [];
  }, [customer]);

  const totalRevenue = useMemo(() => {
    if (!customer) return 0;
    return asNumber(customer.total_received);
  }, [customer]);

  const initialValues = useMemo(() => {
    if (!customer) return null;
    return customerRecordToFormValues(customer);
  }, [customer]);

  const documents = useMemo(() => {
    if (!customer) return [];
    return parseCustomerDocuments(customer.documents_json ?? customer.documents);
  }, [customer]);

  if (error) {
    return (
      <PageShell>
        <div className="space-y-4">
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">Failed to load customer</p>
            <p>{error}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/invoicing/customers"><ArrowLeft className="h-4 w-4" /> Back to customers</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  if (!customer || !initialValues) {
    return <PageShell><div className="p-8 text-zinc-300">Loading customer profile...</div></PageShell>;
  }

  const handleDeleteComment = async () => {
    if (!commentToDelete) return;
    setBusy(true);
    try {
      await api.deleteCustomerComment(customer.id, commentToDelete);
      setCommentToDelete(null);
      await reload();
    } catch (err: any) {
      alert("Failed to delete comment: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    setBusy(true);
    try {
      await api.updateCustomerComment(customer.id, commentId, editingCommentText);
      setEditingCommentId(null);
      await reload();
    } catch (err: any) {
      alert("Failed to save changes: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      {/* Premium Ledger Statement Print Container (only visible on print) */}
      <div className="hidden print:block fixed inset-0 bg-white text-zinc-950 p-10 z-50 print-ledger-container font-sans text-xs">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            .no-print, header, footer, nav, aside, button, .tabs-list {
              display: none !important;
            }
            body {
              background: white !important;
              color: black !important;
            }
            .print-ledger-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: 100%;
              background: white !important;
              display: block !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            th, td {
              border: 1px solid #e2e8f0 !important;
              padding: 8px 10px !important;
              text-align: left;
            }
            th {
              background-color: #1f2937 !important;
              color: white !important;
              font-weight: bold !important;
            }
            tr:nth-child(even) {
              background-color: #f8fafc !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}} />

        <div className="flex justify-between items-start pb-6 border-b-2 border-zinc-300">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight">LEDGER STATEMENT OF ACCOUNT</h1>
            <p className="text-sm font-bold text-zinc-700 mt-1">{customer.name}</p>
            <div className="text-[10px] text-zinc-500 mt-3 space-y-1 leading-normal">
              {customer.cr_number && <p><span className="font-bold text-zinc-650">CR No:</span> {customer.cr_number}</p>}
              <p><span className="font-bold text-zinc-650">VAT No:</span> {customer.vat_number || "—"}</p>
              <p><span className="font-bold text-zinc-650">Address:</span> {formatCustomerAddress(customer)}</p>
            </div>
          </div>

          <div className="w-[320px] border border-zinc-300 rounded-lg p-4 bg-zinc-50/50">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Statement Summary</h2>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-500">Statement Period:</span>
                <span className="font-semibold text-zinc-800">As of {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Opening Balance:</span>
                <span className="font-semibold text-zinc-800">{formatSAR(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Invoiced (Debits):</span>
                <span className="font-semibold text-zinc-800">{formatSAR(customer.total_invoiced)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Paid (Credits):</span>
                <span className="font-semibold text-emerald-700">-{formatSAR(customer.total_received)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-black pt-2 border-t border-zinc-300 text-zinc-900">
                <span>Outstanding Closing Balance:</span>
                <span>{formatSAR(customer.outstanding_balance)}</span>
              </div>
            </div>
          </div>
        </div>

        <table className="w-full text-[11px] mt-6 border-collapse">
          <thead>
            <tr className="bg-zinc-800 text-white font-bold text-xs">
              <th className="p-3 w-[15%]">Date</th>
              <th className="p-3 w-[20%]">Document / Reference</th>
              <th className="p-3 w-[35%]">Transaction Type / Description</th>
              <th className="p-3 w-[10%] text-right">Debit (+)</th>
              <th className="p-3 w-[10%] text-right">Credit (-)</th>
              <th className="p-3 w-[10%] text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {statementRows.length ? statementRows.map((entry: any) => (
              <tr key={entry.id} className="border-b border-zinc-200">
                <td className="p-3 text-zinc-650">{formatDate(entry.entry_date)}</td>
                <td className="p-3 font-semibold text-blue-600">
                  <a href={entry.kind === "invoice" ? `/invoicing/invoices/${entry.id}` : "#"} className="hover:underline">
                    {entry.reference}
                  </a>
                </td>
                <td className="p-3 text-zinc-500">{entry.description}</td>
                <td className="p-3 text-right font-semibold text-zinc-800">{entry.kind === "invoice" ? formatSAR(entry.amount) : "—"}</td>
                <td className="p-3 text-right font-semibold text-emerald-700">{entry.kind === "payment" ? formatSAR(Math.abs(asNumber(entry.amount))) : "—"}</td>
                <td className="p-3 text-right font-bold text-zinc-900">{formatSAR(entry.runningBalance)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-400">No transactions recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 pb-6 mb-6 border-b no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-350">
            <Link href="/invoicing/customers" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Customers
            </Link>
            <span>/</span>
            <span className="text-zinc-200 font-medium">{customer.name}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight">{customer.name}</h1>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="text-zinc-200 border-zinc-700 hover:bg-zinc-800">
            <Settings className="h-4 w-4 mr-1.5" /> Edit Profile
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-4 items-start no-print">
        <div className="xl:col-span-3 space-y-6">
          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader className="p-6">
              <Tabs defaultValue="overview">
                <TabsList className="mb-4 bg-zinc-900/50 border-zinc-800 text-zinc-300">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">Overview</TabsTrigger>
                  <TabsTrigger value="transactions" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">Transactions</TabsTrigger>
                  <TabsTrigger value="comments" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">Comments</TabsTrigger>
                  <TabsTrigger value="statement" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">Statement</TabsTrigger>
                </TabsList>

                {/* Overview Content */}
                <TabsContent value="overview" className="mt-0 space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-zinc-900/40 border-zinc-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-zinc-350">Total Receivables</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-zinc-100">{formatSAR(customer.total_invoiced ?? 0)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-zinc-900/40 border-zinc-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-zinc-350">Outstanding Balance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-rose-400">{formatSAR(customer.outstanding_balance ?? 0)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-zinc-900/40 border-zinc-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-zinc-350">Payments Received</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-emerald-400">{formatSAR(customer.total_received ?? 0)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-zinc-300">Revenue Analysis (Last 6 Months)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {monthlyRevenue.length === 0 ? (
                        <p className="text-sm text-zinc-400">No transactions recorded yet.</p>
                      ) : (
                        <div className="space-y-4">
                          {monthlyRevenue.map((item) => {
                            const max = Math.max(...monthlyRevenue.flatMap((entry) => [entry.invoiced, entry.received, 0]));
                            const invoicedWidth = max ? Math.max(8, (item.invoiced / max) * 100) : 0;
                            const receivedWidth = max ? Math.max(8, (item.received / max) * 100) : 0;
                            return (
                              <div key={item.period} className="grid gap-2 md:grid-cols-[120px_1fr_auto] md:items-center">
                                <div className="text-sm font-semibold text-zinc-200">{item.period}</div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-2.5 rounded-full bg-blue-500" style={{ width: `${invoicedWidth}%` }} />
                                    <span className="text-xs text-zinc-300 font-semibold">{formatSAR(item.invoiced)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${receivedWidth}%` }} />
                                    <span className="text-xs text-zinc-300 font-semibold">{formatSAR(item.received)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="bg-zinc-900/40 border-zinc-800">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold text-zinc-300">Profile Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-zinc-200">
                        <p><span className="font-semibold text-zinc-450">Company Name:</span> {customer.company_name ?? "—"}</p>
                        <p><span className="font-semibold text-zinc-450">Display Name:</span> {buildCustomerDisplayName(customer)}</p>
                        <p><span className="font-semibold text-zinc-450">Contact Person:</span> {buildCustomerContactName(customer)}</p>
                        <p><span className="font-semibold text-zinc-450">Email Address:</span> {customer.email ?? "—"}</p>
                        <p><span className="font-semibold text-zinc-450">Work Phone:</span> {customerPhoneLabel(customer)}</p>
                        <p><span className="font-semibold text-zinc-450">Preferred Language:</span> {customer.language ?? "—"}</p>
                        <p><span className="font-semibold text-zinc-450">Currency:</span> {customer.currency ?? "SAR"}</p>
                        <p><span className="font-semibold text-zinc-450">VAT Registration:</span> {customer.vat_number ?? "—"}</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/40 border-zinc-800">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold text-zinc-300">Addresses</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm text-zinc-200">
                        <div>
                          <p className="font-bold text-zinc-300 text-xs uppercase tracking-wider">Billing Address</p>
                          <p className="mt-1 text-zinc-300 leading-relaxed">
                            {formatCustomerAddress(customer.billing_address_json ?? customer.billing_address, customer.city, customer.country)}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-zinc-800">
                          <p className="font-bold text-zinc-300 text-xs uppercase tracking-wider">Shipping Address</p>
                          <p className="mt-1 text-zinc-300 leading-relaxed">
                            {formatCustomerAddress(customer.shipping_address_json ?? customer.shipping_address)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-zinc-300">Remarks & Documents</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-zinc-200">
                      <div>
                        <p className="font-bold text-zinc-300 text-xs uppercase tracking-wider mb-2">Remarks</p>
                        <p className="whitespace-pre-wrap text-zinc-300">{customer.remarks ?? "No remarks recorded."}</p>
                      </div>
                      <div className="pt-4 border-t border-zinc-800">
                        <p className="font-bold text-zinc-300 text-xs uppercase tracking-wider mb-2">Attached Documents</p>
                        {documents.length === 0 ? (
                          <p className="text-zinc-400">No documents uploaded.</p>
                        ) : (
                          <ul className="space-y-2">
                            {documents.map((doc) => {
                              const fileUrl = (doc as any).url || `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/settings/uploads/${encodeURIComponent(doc.name)}`;
                              return (
                                <li key={`${doc.name}-${doc.lastModified ?? 0}`} className="flex items-center justify-between rounded-md border border-zinc-800 px-3 py-2 bg-zinc-900/20">
                                  <a
                                    href={fileUrl}
                                    download={doc.name}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-zinc-200 hover:text-indigo-400 hover:underline transition-colors"
                                  >
                                    {doc.name}
                                  </a>
                                  <span className="text-xs text-zinc-400">{doc.size ? `${Math.round(doc.size / 1024)} KB` : "Attached"}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Transactions Content */}
                <TabsContent value="transactions" className="mt-0 space-y-4">
                  <details open className="rounded-lg border bg-card p-4 border-zinc-800 bg-zinc-900/10">
                    <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Invoices</summary>
                    <div className="mt-4 max-h-[400px] overflow-y-auto overflow-x-auto custom-scrollbar border border-zinc-800 rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-zinc-900/50 border-zinc-800">
                            <TableHead className="font-semibold text-zinc-200">Number</TableHead>
                            <TableHead className="font-semibold text-zinc-200">Date</TableHead>
                            <TableHead className="font-semibold text-zinc-200">Status</TableHead>
                            <TableHead className="text-right font-semibold text-zinc-200">Total</TableHead>
                            <TableHead className="text-right font-semibold text-zinc-200">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {regularInvoices.length ? regularInvoices.map((invoice: any) => (
                            <TableRow key={invoice.id} className="border-zinc-800 hover:bg-zinc-900/20">
                              <TableCell className="font-semibold text-zinc-100">{invoice.number}</TableCell>
                              <TableCell className="text-zinc-300">{formatDate(invoice.issue_date)}</TableCell>
                              <TableCell><StatusBadge status={invoice.status} /></TableCell>
                              <TableCell className="text-right font-bold text-zinc-100">{formatSAR(invoice.total)}</TableCell>
                              <TableCell className="text-right">
                                <Button asChild size="sm" variant="ghost" className="text-zinc-200 hover:text-white hover:bg-zinc-800">
                                  <Link href={`/invoicing/invoices/${invoice.id}`}>
                                    <FileText className="h-3.5 w-3.5 mr-1" /> View
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={5} className="py-8 text-center text-zinc-400">No invoices yet.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </details>

                  <details className="rounded-lg border bg-card p-4 border-zinc-800 bg-zinc-900/10">
                    <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Proforma Invoices</summary>
                    <div className="mt-4 max-h-[400px] overflow-y-auto overflow-x-auto custom-scrollbar border border-zinc-800 rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-zinc-900/50 border-zinc-800">
                            <TableHead className="font-semibold text-zinc-200">Number</TableHead>
                            <TableHead className="font-semibold text-zinc-200">Date</TableHead>
                            <TableHead className="font-semibold text-zinc-200">Status</TableHead>
                            <TableHead className="text-right font-semibold text-zinc-200">Total</TableHead>
                            <TableHead className="text-right font-semibold text-zinc-200">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {proformaInvoices.length ? proformaInvoices.map((invoice: any) => (
                            <TableRow key={invoice.id} className="border-zinc-800 hover:bg-zinc-900/20">
                              <TableCell className="font-semibold text-zinc-100">{invoice.number}</TableCell>
                              <TableCell className="text-zinc-300">{formatDate(invoice.issue_date)}</TableCell>
                              <TableCell><StatusBadge status={invoice.status} /></TableCell>
                              <TableCell className="text-right font-bold text-zinc-100">{formatSAR(invoice.total)}</TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex gap-2">
                                  <Button asChild size="sm" variant="ghost" className="text-zinc-200 hover:text-white hover:bg-zinc-800">
                                    <Link href={`/invoicing/invoices/${invoice.id}`}>
                                      <FileText className="h-3.5 w-3.5 mr-1" /> View
                                    </Link>
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="text-zinc-200 border-zinc-700 hover:bg-zinc-800"
                                    onClick={async () => {
                                      if (confirm("Are you sure you want to convert this proforma invoice to a signed Tax Invoice?")) {
                                        await api.convertProformaToTaxInvoice(invoice.id, { status: "issued" });
                                        await reload();
                                      }
                                    }}
                                  >
                                    Convert to Tax
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={5} className="py-8 text-center text-zinc-400">No proforma invoices yet.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </details>

                  <details className="rounded-lg border bg-card p-4 border-zinc-800 bg-zinc-900/10">
                    <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Quotations</summary>
                    <div className="mt-4 max-h-[400px] overflow-y-auto overflow-x-auto custom-scrollbar border border-zinc-800 rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-zinc-900/50 border-zinc-800">
                            <TableHead className="font-semibold text-zinc-200">Number</TableHead>
                            <TableHead className="font-semibold text-zinc-200">Issue Date</TableHead>
                            <TableHead className="font-semibold text-zinc-200">Expiry Date</TableHead>
                            <TableHead className="font-semibold text-zinc-200">Status</TableHead>
                            <TableHead className="text-right font-semibold text-zinc-200">Total</TableHead>
                            <TableHead className="text-right font-semibold text-zinc-200">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customer.quotations?.length ? customer.quotations.map((q: any) => (
                            <TableRow key={q.id} className="border-zinc-800 hover:bg-zinc-900/20">
                              <TableCell className="font-semibold text-zinc-100">{q.number}</TableCell>
                              <TableCell className="text-zinc-300">{formatDate(q.issue_date)}</TableCell>
                              <TableCell className="text-zinc-300">{q.due_date ? formatDate(q.due_date) : "—"}</TableCell>
                              <TableCell><StatusBadge status={q.status} /></TableCell>
                              <TableCell className="text-right font-bold text-zinc-100">{formatSAR(q.total)}</TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex gap-2">
                                  <Button asChild size="sm" variant="ghost" className="text-zinc-200 hover:text-white hover:bg-zinc-800">
                                    <Link href={`/invoicing/quotations/${q.id}`}>
                                      <FileText className="h-3.5 w-3.5 mr-1" /> View
                                    </Link>
                                  </Button>
                                  {q.status !== "invoiced" && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="text-zinc-200 border-zinc-700 hover:bg-zinc-800"
                                      onClick={async () => {
                                        if (confirm("Convert quotation to proforma invoice?")) {
                                          await api.convertQuotationToProforma(q.id);
                                          await reload();
                                        }
                                      }}
                                    >
                                      To Proforma
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={6} className="py-8 text-center text-zinc-400">No quotations yet.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </details>

                  <details className="rounded-lg border bg-card p-4 border-zinc-800 bg-zinc-900/10">
                    <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Payments</summary>
                    <div className="mt-4 max-h-[400px] overflow-y-auto overflow-x-auto custom-scrollbar border border-zinc-800 rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-zinc-900/50 border-zinc-800">
                            <TableHead className="font-semibold text-zinc-200">Invoice</TableHead>
                            <TableHead className="font-semibold text-zinc-200">Date</TableHead>
                            <TableHead className="font-semibold text-zinc-200">Memo</TableHead>
                            <TableHead className="text-right font-semibold text-zinc-200">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customer.payments?.length ? customer.payments.map((payment: any) => (
                            <TableRow key={payment.id} className="border-zinc-800 hover:bg-zinc-900/20">
                              <TableCell className="font-semibold text-zinc-100">{payment.invoice_number}</TableCell>
                              <TableCell className="text-zinc-300">{formatDate(payment.created_at ?? payment.entry_date)}</TableCell>
                              <TableCell className="text-zinc-300">{payment.memo ?? "Payment received"}</TableCell>
                              <TableCell className="text-right text-emerald-400 font-bold">{formatSAR(payment.invoice_total)}</TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={4} className="py-8 text-center text-zinc-400">No payments yet.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                </TabsContent>

                {/* Comments Content */}
                <TabsContent value="comments" className="mt-0 space-y-4">
                  <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader><CardTitle className="text-sm font-bold text-zinc-200">Write a comment</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <textarea
                        placeholder="Type updates or notes about this client..."
                        className="w-full min-h-[100px] p-3 border rounded-md text-sm text-zinc-200 bg-zinc-950/50 border-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={async () => {
                            if (!commentBody.trim()) return;
                            setSavingComment(true);
                            try {
                              await api.addCustomerComment(customer.id, commentBody);
                              setCommentBody("");
                              await reload();
                            } finally {
                              setSavingComment(false);
                            }
                          }}
                          disabled={savingComment}
                          className="bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                        >
                          {savingComment ? "Saving..." : "Add comment"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader><CardTitle className="text-sm font-bold text-zinc-200">Comment history</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {customer.comments?.length ? customer.comments.map((comment: any) => (
                        <div key={comment.id} className="rounded-lg border p-4 bg-zinc-900/25 border-zinc-800">
                          {editingCommentId === comment.id ? (
                            <div className="space-y-3">
                              <textarea
                                className="w-full min-h-[80px] p-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700 text-zinc-200 bg-zinc-950/50 border-zinc-800"
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                              />
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="outline" className="border-zinc-750 text-zinc-200 hover:bg-zinc-800" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                                <Button size="sm" onClick={() => handleEditComment(comment.id)} disabled={busy}>Save Changes</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start gap-4">
                              <div className="space-y-1">
                                <p className="whitespace-pre-wrap text-zinc-200 text-sm leading-relaxed">{comment.body}</p>
                                <p className="text-[10px] text-zinc-450 font-semibold">{formatDate(comment.created_at)}</p>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8 text-zinc-450 hover:text-zinc-100 hover:bg-zinc-800/40"
                                  onClick={() => {
                                    setEditingCommentId(comment.id);
                                    setEditingCommentText(comment.body);
                                  }}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8 text-zinc-450 hover:text-rose-400 hover:bg-rose-950/20"
                                  onClick={() => {
                                    setCommentToDelete(comment.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )) : <p className="text-zinc-400 text-sm">No comments yet.</p>}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Ledger Statement Content */}
                <TabsContent value="statement" className="mt-0 space-y-4">
                  <div className="flex justify-end">
                    <Button onClick={() => window.print()} className="bg-zinc-800 text-zinc-100 hover:bg-zinc-700">
                      <Printer className="h-4 w-4 mr-1.5" /> Print Statement
                    </Button>
                  </div>
                  <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-zinc-200 font-sans">Statement of account</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[400px] overflow-y-auto overflow-x-auto custom-scrollbar border border-zinc-800 rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-zinc-900/50 border-zinc-800">
                            <TableHead className="font-semibold text-zinc-200">Date</TableHead>
                            <TableHead className="font-semibold text-zinc-200">Reference</TableHead>
                            <TableHead className="font-semibold text-zinc-200">Description</TableHead>
                            <TableHead className="text-right font-semibold text-zinc-200">Debit</TableHead>
                            <TableHead className="text-right font-semibold text-zinc-200">Credit</TableHead>
                            <TableHead className="text-right font-semibold text-zinc-200">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statementRows.length ? statementRows.map((entry: any) => (
                            <TableRow key={entry.id} className="border-zinc-800 hover:bg-zinc-900/20">
                              <TableCell className="text-zinc-300">{formatDate(entry.entry_date)}</TableCell>
                              <TableCell className="font-semibold text-blue-400">
                                <Link href={entry.kind === "invoice" ? `/invoicing/invoices/${entry.id}` : "#"} className="hover:underline">
                                  {entry.reference}
                                </Link>
                              </TableCell>
                              <TableCell className="text-zinc-300">{entry.description}</TableCell>
                              <TableCell className="text-right font-semibold text-zinc-200">{entry.kind === "invoice" ? formatSAR(entry.amount) : "—"}</TableCell>
                              <TableCell className="text-right font-semibold text-emerald-400">{entry.kind === "payment" ? formatSAR(Math.abs(asNumber(entry.amount))) : "—"}</TableCell>
                              <TableCell className="text-right font-bold text-zinc-100">{formatSAR(entry.runningBalance)}</TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={6} className="py-8 text-center text-zinc-400">No statement entries yet.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:h-fit">
          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-zinc-200">Quick facts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-200">
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Created</span>
                <span className="font-medium">{formatDate(customer.created_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Invoices</span>
                <span className="font-medium">{customer.invoice_count ?? customer.invoices?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Payments</span>
                <span className="font-medium">{customer.payment_count ?? customer.payments?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Last invoice</span>
                <span className="font-medium">{formatDate(customer.last_invoice_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Revenue</span>
                <span className="font-medium text-emerald-400">{formatSAR(totalRevenue)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-zinc-200">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-200">
              {(customer.statement ?? []).slice(-5).reverse().map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-md border border-zinc-800 p-3 bg-zinc-900/10">
                  <CreditCard className="mt-0.5 h-4 w-4 text-zinc-450" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-200">{entry.description}</p>
                    <p className="text-xs text-zinc-400">{entry.reference} · {formatDate(entry.entry_date)}</p>
                  </div>
                  <span className="text-sm font-bold text-zinc-100">{formatSAR(entry.amount)}</span>
                </div>
              ))}
              {(customer.statement ?? []).length === 0 && <p className="text-zinc-400">No recent activity.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto bg-zinc-900 text-zinc-200 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Edit customer</DialogTitle>
          </DialogHeader>
          <CustomerForm
            key={customer.id}
            initialValues={initialValues}
            submitLabel="Save changes"
            busy={busy}
            onCancel={() => setEditOpen(false)}
            onSubmit={async (values) => {
              setBusy(true);
              try {
                await api.updateCustomer(customer.id, customerFormToApi(values));
                setEditOpen(false);
                await reload();
              } finally {
                setBusy(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Comment Delete Confirmation Dialog */}
      <Dialog open={!!commentToDelete} onOpenChange={(open) => !open && setCommentToDelete(null)}>
        <DialogContent className="max-w-md bg-zinc-900 border border-zinc-800 text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 font-bold text-lg">Confirm Comment Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-zinc-300 leading-normal">
            Are you sure you want to delete this comment? This action is permanent and cannot be undone.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="border-zinc-800 text-zinc-200 hover:bg-zinc-800" onClick={() => setCommentToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteComment} disabled={busy}>
              {busy ? "Deleting..." : "Delete Permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
