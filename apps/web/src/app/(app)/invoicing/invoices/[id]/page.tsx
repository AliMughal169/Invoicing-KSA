"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";

export default function InvoicePdfPage() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    api.getInvoice(id).then(async (data) => {
      setInv(data);
      if (data.zatca_qr) {
        try {
          const dataUrl = await QRCode.toDataURL(data.zatca_qr, { margin: 1, width: 180 });
          setQr(dataUrl);
        } catch { /* noop */ }
      }
    });
    try { setTenant(JSON.parse(localStorage.getItem("erp.tenant") || "null")); } catch {}
  }, [id]);

  if (!inv) return <div className="p-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-zinc-100 py-8 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto px-6 print:max-w-none print:px-0">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Button asChild variant="outline" size="sm">
            <Link href="/invoicing/invoices"><ArrowLeft className="h-4 w-4" /> Back</Link>
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
              <p className="text-xs uppercase tracking-wide text-zinc-500">{inv.is_tax_invoice ? "Tax Invoice" : "Simplified Invoice"}</p>
              <p className="text-xs text-zinc-500">{inv.is_tax_invoice ? "فاتورة ضريبية" : "فاتورة مبسطة"}</p>
              <p className="text-lg font-semibold mt-1">{inv.number}</p>
              <div className="mt-2 inline-block"><StatusBadge status={inv.status} /></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 py-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Bill to</p>
              <p className="font-medium">{inv.customer_name ?? "—"}</p>
              {inv.customer_vat && <p className="text-sm text-zinc-500">VAT: {inv.customer_vat}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500">Issue date</p>
              <p className="font-medium">{formatDate(inv.issue_date)}</p>
              {inv.due_date && <>
                <p className="text-xs text-zinc-500 mt-2">Due date</p>
                <p className="font-medium">{formatDate(inv.due_date)}</p>
              </>}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-right p-3 font-medium w-16">Qty</th>
                <th className="text-right p-3 font-medium w-28">Unit price</th>
                {inv.is_tax_invoice && <th className="text-right p-3 font-medium w-16">VAT %</th>}
                <th className="text-right p-3 font-medium w-32">Line total</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines?.map((l: any) => (
                <tr key={l.id} className="border-b border-zinc-100">
                  <td className="p-3">{l.description}</td>
                  <td className="p-3 text-right">{l.qty}</td>
                  <td className="p-3 text-right">{formatSAR(l.unit_price)}</td>
                  {inv.is_tax_invoice && <td className="p-3 text-right">{l.vat_rate}%</td>}
                  <td className="p-3 text-right">{formatSAR(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-6 pt-6">
            <div className="flex flex-col items-start gap-2">
              {inv.is_tax_invoice && qr && <img src={qr} alt="ZATCA QR" className="border p-1 bg-white" />}
              {inv.is_tax_invoice && inv.zatca_uuid && (
                <div className="text-[10px] text-zinc-500 leading-relaxed max-w-xs break-all">
                  <p>UUID: {inv.zatca_uuid}</p>
                  <p>Hash: {String(inv.zatca_hash).slice(0, 32)}…</p>
                  <p>Prev: {String(inv.zatca_prev_hash).slice(0, 32)}…</p>
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Subtotal</span>
                <span>{formatSAR(inv.subtotal)}</span>
              </div>
              {inv.is_tax_invoice && <div className="flex justify-between">
                <span className="text-zinc-500">VAT 15%</span>
                <span>{formatSAR(inv.vat_total)}</span>
              </div>}
              <div className="flex justify-between text-lg font-semibold pt-3 border-t">
                <span>Total</span>
                <span>{formatSAR(inv.total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t text-xs text-zinc-400 text-center">
            ZATCA-compliant simplified tax invoice · Generated by ERP SaaS
          </div>
        </div>
      </div>
    </div>
  );
}
