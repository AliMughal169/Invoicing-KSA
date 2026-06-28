"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";

export default function QuotationPdfPage() {
  const { id } = useParams<{ id: string }>();
  const [q, setQ] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);

  useEffect(() => {
    api.getQuotation(id).then((data) => {
      setQ(data);
    });
    try { setTenant(JSON.parse(localStorage.getItem("erp.tenant") || "null")); } catch {}
  }, [id]);

  if (!q) return <div className="p-10 text-muted-foreground">Loading…</div>;

  const isTaxQuote = q.lines?.some((l: any) => Number(l.vat_rate) > 0) ?? true;

  return (
    <div className="min-h-screen bg-zinc-100 py-8 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto px-6 print:max-w-none print:px-0">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Button asChild variant="outline" size="sm">
            <Link href="/invoicing/quotations"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
          <Button onClick={() => window.print()} size="sm">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
        </div>

        <div className="bg-white text-zinc-900 rounded-lg shadow-sm p-10 print:shadow-none print:rounded-none">
          <div className="flex justify-between items-start pb-6 border-b">
            <div>
              <h1 className="text-2xl font-bold">{tenant?.name ?? "—"}</h1>
              <p className="text-xs text-zinc-500 mt-1">VAT: 300000000000003</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Sales Quotation</p>
              <p className="text-xs text-zinc-500">عرض سعر</p>
              <p className="text-lg font-semibold mt-1">{q.number}</p>
              <div className="mt-2 inline-block">
                <StatusBadge status={q.status} />
                {q.status === "invoiced" && q.invoice_number && (
                  <span className="ml-2 text-xs text-muted-foreground">({q.invoice_number})</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 py-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Quote to</p>
              <p className="font-medium">{q.customer_name ?? "—"}</p>
              {q.customer_vat && <p className="text-sm text-zinc-500">VAT: {q.customer_vat}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500">Issue date</p>
              <p className="font-medium">{formatDate(q.issue_date)}</p>
              {q.due_date && <>
                <p className="text-xs text-zinc-500 mt-2">Expiry date</p>
                <p className="font-medium">{formatDate(q.due_date)}</p>
              </>}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-right p-3 font-medium w-16">Qty</th>
                <th className="text-right p-3 font-medium w-28">Unit price</th>
                {isTaxQuote && <th className="text-right p-3 font-medium w-16">VAT %</th>}
                <th className="text-right p-3 font-medium w-32">Line total</th>
              </tr>
            </thead>
            <tbody>
              {q.lines?.map((l: any) => (
                <tr key={l.id} className="border-b border-zinc-100">
                  <td className="p-3">{l.description}</td>
                  <td className="p-3 text-right">{l.qty}</td>
                  <td className="p-3 text-right">{formatSAR(l.unit_price)}</td>
                  {isTaxQuote && <td className="p-3 text-right">{l.vat_rate}%</td>}
                  <td className="p-3 text-right">{formatSAR(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-6 pt-6">
            <div>
              {/* Left side empty for Quotations since there is no ZATCA QR */}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Subtotal</span>
                <span>{formatSAR(q.subtotal)}</span>
              </div>
              {isTaxQuote && <div className="flex justify-between">
                <span className="text-zinc-500">VAT 15%</span>
                <span>{formatSAR(q.vat_total)}</span>
              </div>}
              <div className="flex justify-between text-lg font-semibold pt-3 border-t">
                <span>Total</span>
                <span>{formatSAR(q.total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t text-xs text-zinc-400 text-center">
            Sales Quotation / Proforma Invoice · Generated by ERP SaaS
          </div>
        </div>
      </div>
    </div>
  );
}
