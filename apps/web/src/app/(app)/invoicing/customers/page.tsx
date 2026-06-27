"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { buildCustomerContactName, buildCustomerDisplayName, customerLocationLabel, customerPhoneLabel, formatCustomerAddress } from "@/lib/customer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";

export default function CustomersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);

  async function reload() {
    setRows(await api.listCustomers());
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="Customers"
        description="Billing customers with contact, currency, and address details"
        actions={
          <Button asChild>
            <Link href="/invoicing/customers/new"><Plus className="h-4 w-4" /> New customer</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company name</TableHead>
                  <TableHead>Person name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Work phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>VAT #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No customers yet
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((customer) => (
                  <TableRow
                    key={customer.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={() => router.push(`/invoicing/customers/${customer.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/invoicing/customers/${customer.id}`);
                      }
                    }}
                  >
                    <TableCell className="font-medium">
                      {customer.company_name ?? buildCustomerDisplayName(customer)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{buildCustomerContactName(customer)}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{customerPhoneLabel(customer)}</TableCell>
                    <TableCell className="text-muted-foreground">{customerLocationLabel(customer)}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.vat_number ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 p-4 lg:hidden">
            {rows.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">No customers yet</p>
            ) : (
              rows.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => router.push(`/invoicing/customers/${customer.id}`)}
                  className="w-full rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{customer.company_name ?? buildCustomerDisplayName(customer)}</p>
                        <p className="text-sm text-muted-foreground">{buildCustomerContactName(customer)}</p>
                      </div>
                      <span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-secondary-foreground">
                        {customer.customer_type ?? "business"}
                      </span>
                    </div>
                    <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                      <p><span className="font-medium text-foreground">Email:</span> {customer.email ?? "—"}</p>
                      <p><span className="font-medium text-foreground">Work phone:</span> {customerPhoneLabel(customer)}</p>
                      <p><span className="font-medium text-foreground">Location:</span> {customerLocationLabel(customer)}</p>
                      <p><span className="font-medium text-foreground">VAT:</span> {customer.vat_number ?? "—"}</p>
                    </div>
                    {customer.billing_address_json && (
                      <p className="text-xs text-muted-foreground">Billing: {formatCustomerAddress(customer.billing_address_json)}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
