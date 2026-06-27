"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { customerFormToApi, emptyCustomerForm } from "@/lib/customer";
import { CustomerForm } from "@/components/customer-form";
import { PageHeader, PageShell } from "@/components/page-shell";

export default function NewCustomerPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <PageShell>
      <PageHeader
        title="New customer"
        description="Create a customer profile on a dedicated page"
      />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <CustomerForm
        initialValues={emptyCustomerForm()}
        submitLabel="Create customer"
        busy={busy}
        showStickButtons={true}
        onCancel={() => router.push("/invoicing/customers")}
        onSubmit={async (values) => {
          setBusy(true);
          setError(null);
          try {
            const created = await api.createCustomer(customerFormToApi(values));
            if (!created || !created.id) {
              setError("Failed to create customer: Invalid response from server");
              return;
            }
            router.push(`/invoicing/customers/${created.id}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create customer";
            setError(message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </PageShell>
  );
}
