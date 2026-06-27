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

  if (!customer) {
    return <PageShell><div className="py-10 text-muted-foreground">Loading customer...</div></PageShell>;
  }

  const documents = parseCustomerDocuments(customer.documents_json ?? customer.documents);
  const initialValues = customerRecordToFormValues(customer);
  const totalRevenue = asNumber(customer.total_received) || asNumber(customer.total_invoiced) - asNumber(customer.outstanding_balance);

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/invoicing/customers"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Edit3 className="h-4 w-4" /> Edit customer
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Customer overview</p>
                  <CardTitle className="mt-2 text-3xl">{customer.company_name ?? buildCustomerDisplayName(customer)}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{buildCustomerContactName(customer)} · {customer.customer_type ?? "business"} · {customer.currency ?? "SAR"}</p>
                </div>
                <details className="relative">
                  <summary className="flex list-none cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
                    <Settings className="h-4 w-4" /> Settings
                  </summary>
                  <div className="absolute right-0 top-12 z-10 w-44 rounded-md border bg-background p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => setEditOpen(true)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <Edit3 className="h-4 w-4" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm("Delete this customer? This cannot be undone.")) return;
                        await api.deleteCustomer(customer.id);
                        router.push("/invoicing/customers");
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </details>
              </div>

              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="flex flex-wrap">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                  <TabsTrigger value="statement">Statement</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-0 space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total receivables</CardTitle></CardHeader>
                      <CardContent><p className="text-2xl font-semibold">{formatSAR(customer.total_invoiced ?? 0)}</p></CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Due payments</CardTitle></CardHeader>
                      <CardContent><p className="text-2xl font-semibold">{formatSAR(customer.outstanding_balance ?? 0)}</p></CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Received</CardTitle></CardHeader>
                      <CardContent><p className="text-2xl font-semibold">{formatSAR(customer.total_received ?? 0)}</p></CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm text-muted-foreground">Revenue from this customer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {monthlyRevenue.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No chart data yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {monthlyRevenue.map((item) => {
                            const max = Math.max(...monthlyRevenue.flatMap((entry) => [entry.invoiced, entry.received, 0]));
                            const invoicedWidth = max ? Math.max(8, (item.invoiced / max) * 100) : 0;
                            const receivedWidth = max ? Math.max(8, (item.received / max) * 100) : 0;
                            return (
                              <div key={item.period} className="grid gap-2 md:grid-cols-[120px_1fr_auto] md:items-center">
                                <div className="text-sm font-medium">{item.period}</div>
                                <div className="space-y-2">
                                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full bg-primary" style={{ width: `${invoicedWidth}%` }} />
                                  </div>
                                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${receivedWidth}%` }} />
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground md:text-right">
                                  <div>Invoiced {formatSAR(item.invoiced)}</div>
                                  <div>Received {formatSAR(item.received)}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Profile details</CardTitle></CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p><span className="font-medium">Company:</span> {customer.company_name ?? "—"}</p>
                        <p><span className="font-medium">Display:</span> {buildCustomerDisplayName(customer)}</p>
                        <p><span className="font-medium">Person:</span> {buildCustomerContactName(customer)}</p>
                        <p><span className="font-medium">Email:</span> {customer.email ?? "—"}</p>
                        <p><span className="font-medium">Work phone:</span> {customerPhoneLabel(customer)}</p>
                        <p><span className="font-medium">Language:</span> {customer.language ?? "—"}</p>
                        <p><span className="font-medium">Currency:</span> {customer.currency ?? "SAR"}</p>
                        <p><span className="font-medium">VAT #:</span> {customer.vat_number ?? "—"}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Addresses</CardTitle></CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div>
                          <p className="font-medium">Billing</p>
                          <p className="text-muted-foreground">{formatCustomerAddress(customer.billing_address_json ?? customer.billing_address, customer.city, customer.country)}</p>
                        </div>
                        <div>
                          <p className="font-medium">Shipping</p>
                          <p className="text-muted-foreground">{formatCustomerAddress(customer.shipping_address_json ?? customer.shipping_address)}</p>
                        </div>
                        <div>
                          <p className="font-medium">Location</p>
                          <p className="text-muted-foreground">{customerLocationLabel(customer)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader><CardTitle className="text-sm">Documents and remarks</CardTitle></CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div>
                        <p className="font-medium">Documents</p>
                        {documents.length === 0 ? (
                          <p className="text-muted-foreground">No documents uploaded.</p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {documents.map((document) => (
                              <li key={`${document.name}-${document.lastModified ?? 0}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                                <span>{document.name}</span>
                                <span className="text-muted-foreground">{document.size ? `${Math.round(document.size / 1024)} KB` : "Attached"}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">Remarks</p>
                        <p className="whitespace-pre-wrap text-muted-foreground">{customer.remarks ?? "—"}</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="comments" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Add comment</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <textarea
                        value={commentBody}
                        onChange={(event) => setCommentBody(event.target.value)}
                        rows={4}
                        className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Record a payment reminder, call note, or any special instruction."
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
                        >
                          {savingComment ? "Saving..." : "Add comment"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-sm">Comment history</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {customer.comments?.length ? customer.comments.map((comment: any) => (
                        <div key={comment.id} className="rounded-lg border p-3">
                          <p className="whitespace-pre-wrap">{comment.body}</p>
                          <p className="mt-2 text-xs text-muted-foreground">{formatDate(comment.created_at)}</p>
                        </div>
                      )) : <p className="text-muted-foreground">No comments yet.</p>}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="transactions" className="mt-0 space-y-4">
                  <details open className="rounded-lg border bg-card p-4">
                    <summary className="cursor-pointer text-sm font-medium">Invoices</summary>
                    <div className="mt-4 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Number</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customer.invoices?.length ? customer.invoices.map((invoice: any) => (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-medium">{invoice.number}</TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(invoice.issue_date)}</TableCell>
                              <TableCell className="text-muted-foreground">{invoice.status}</TableCell>
                              <TableCell className="text-right">{formatSAR(invoice.total)}</TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No invoices yet.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </details>

                  <details className="rounded-lg border bg-card p-4">
                    <summary className="cursor-pointer text-sm font-medium">Quotations</summary>
                    <div className="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Quotations will appear here when quotation management is connected to customer records.
                    </div>
                  </details>

                  <details className="rounded-lg border bg-card p-4">
                    <summary className="cursor-pointer text-sm font-medium">Expenses</summary>
                    <div className="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Customer-specific expense tracking is not yet linked in the backend.
                    </div>
                  </details>

                  <details className="rounded-lg border bg-card p-4">
                    <summary className="cursor-pointer text-sm font-medium">Payments</summary>
                    <div className="mt-4 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Memo</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customer.payments?.length ? customer.payments.map((payment: any) => (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium">{payment.invoice_number}</TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(payment.created_at ?? payment.entry_date)}</TableCell>
                              <TableCell className="text-muted-foreground">{payment.memo ?? "Payment received"}</TableCell>
                              <TableCell className="text-right text-emerald-600">{formatSAR(payment.invoice_total)}</TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No payments yet.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                </TabsContent>

                <TabsContent value="statement" className="mt-0 space-y-4">
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => window.print()}>
                      <Printer className="h-4 w-4" /> Download PDF
                    </Button>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Statement of account</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statementRows.length ? statementRows.map((entry: any) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-muted-foreground">{formatDate(entry.entry_date)}</TableCell>
                              <TableCell className="font-medium">{entry.reference}</TableCell>
                              <TableCell className="text-muted-foreground">{entry.description}</TableCell>
                              <TableCell className="text-right">{entry.kind === "invoice" ? formatSAR(entry.amount) : "—"}</TableCell>
                              <TableCell className="text-right">{entry.kind === "payment" ? formatSAR(Math.abs(asNumber(entry.amount))) : "—"}</TableCell>
                              <TableCell className="text-right font-medium">{formatSAR(entry.runningBalance)}</TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No statement entries yet.</TableCell></TableRow>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick facts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(customer.created_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Invoices</span>
                <span>{customer.invoice_count ?? customer.invoices?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Payments</span>
                <span>{customer.payment_count ?? customer.payments?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Last invoice</span>
                <span>{formatDate(customer.last_invoice_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Revenue</span>
                <span>{formatSAR(totalRevenue)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(customer.statement ?? []).slice(-5).reverse().map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-md border p-3">
                  <CreditCard className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">{entry.reference} · {formatDate(entry.entry_date)}</p>
                  </div>
                  <span className="text-sm font-medium">{formatSAR(entry.amount)}</span>
                </div>
              ))}
              {(customer.statement ?? []).length === 0 && <p className="text-muted-foreground">No recent activity.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
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
    </PageShell>
  );
}
