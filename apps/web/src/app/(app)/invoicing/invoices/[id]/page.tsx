"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/lib/i18n";

export default function InvoicePdfPage() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [qr, setQr] = useState<string>("");
  const { locale } = useI18n();

  // Layout states
  const [printOnLetterhead, setPrintOnLetterhead] = useState(false);
  const [topMargin, setTopMargin] = useState(0);
  const [bottomMargin, setBottomMargin] = useState(0);
  const [savingLayout, setSavingLayout] = useState(false);

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

    api.getSettings().then((data) => {
      setSettings(data);
      setPrintOnLetterhead(!!data.print_on_letterhead);
      setTopMargin(data.top_margin ?? 0);
      setBottomMargin(data.bottom_margin ?? 0);
    }).catch(() => {});

    try { setTenant(JSON.parse(localStorage.getItem("erp.tenant") || "null")); } catch {}
  }, [id]);

  if (!inv) return <div className="p-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-zinc-100 py-8 print:bg-transparent print:py-0 print-container">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: transparent !important;
            background: transparent !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
          .print-container {
            padding-top: 0mm !important;
            padding-bottom: 0mm !important;
            padding-left: 18mm !important;
            padding-right: 18mm !important;
            background-color: transparent !important;
            background: transparent !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {printOnLetterhead && settings?.letterhead_url && (
        <img 
          src={settings.letterhead_url}
          alt="Letterhead background"
          className="hidden print:block fixed inset-0 pointer-events-none w-full h-full object-fill"
          style={{ zIndex: 0 }}
        />
      )}

      <div className="max-w-4xl mx-auto px-6 print:max-w-none print:px-0 relative" style={{ zIndex: 10 }}>
        {/* Layout Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-white rounded-xl shadow-sm border print:hidden no-print">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/invoicing/invoices"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
            </Button>
            <Button onClick={() => window.print()} size="sm">
              <Printer className="h-4 w-4 mr-1" /> Print / Save PDF
            </Button>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <input 
                id="preview-lh-toggle"
                type="checkbox"
                checked={printOnLetterhead}
                onChange={(e) => setPrintOnLetterhead(e.target.checked)}
                className="h-4 w-4 rounded border border-input cursor-pointer"
              />
              <Label htmlFor="preview-lh-toggle" className="cursor-pointer text-xs font-semibold">Print on Letterhead</Label>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-500">Top Margin:</span>
                <input 
                  type="number"
                  min={0}
                  max={100}
                  value={topMargin}
                  onChange={(e) => setTopMargin(parseInt(e.target.value) || 0)}
                  className="w-16 h-8 text-center text-xs border rounded-md"
                />
                <span className="text-[10px] text-zinc-400">mm</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-500">Bottom Margin:</span>
                <input 
                  type="number"
                  min={0}
                  max={100}
                  value={bottomMargin}
                  onChange={(e) => setBottomMargin(parseInt(e.target.value) || 0)}
                  className="w-16 h-8 text-center text-xs border rounded-md"
                />
                <span className="text-[10px] text-zinc-400">mm</span>
              </div>
            </div>

            <Button 
              size="sm" 
              variant="secondary"
              disabled={savingLayout}
              onClick={async () => {
                setSavingLayout(true);
                try {
                  await api.updateSettings({
                    printOnLetterhead,
                    topMargin,
                    bottomMargin,
                  });
                  alert("Layout settings saved successfully!");
                } catch (err: any) {
                  alert("Failed to save layout settings: " + err.message);
                } finally {
                  setSavingLayout(false);
                }
              }}
            >
              {savingLayout ? "Saving..." : "Save Layout"}
            </Button>
          </div>
        </div>

        <div className="bg-white text-zinc-900 rounded-xl shadow-md p-12 print:shadow-none print:rounded-none print:p-0 print:bg-transparent transition-all duration-200">
          <table className="w-full border-none border-collapse">
            {printOnLetterhead && (
              <thead>
                <tr>
                  <td style={{ height: `${topMargin}mm` }} className="p-0 border-none"></td>
                </tr>
              </thead>
            )}
            <tbody>
              <tr>
                <td className="p-0 border-none">
                  {/* Header Section */}
                  {!printOnLetterhead && (
                    <div className="flex justify-between items-start pb-8 border-b-2 border-zinc-200">
                      <div className="flex items-center gap-5">
                        {settings?.company_logo_url && (
                          <img 
                            src={settings.company_logo_url} 
                            alt="Logo" 
                            className="h-20 w-auto object-contain max-w-[160px] border p-2 bg-white rounded-lg shadow-sm print:shadow-none" 
                          />
                        )}
                        <div>
                          <h1 className="text-2xl font-extrabold text-zinc-800 tracking-tight">
                            {settings?.company_name_en || tenant?.name || "—"}
                          </h1>
                          {settings?.company_name_ar && (
                            <h2 className="text-lg font-bold text-zinc-600 mt-0.5">
                              {settings.company_name_ar}
                            </h2>
                          )}
                          <div className="text-xs text-zinc-500 mt-2 space-y-1">
                            {settings?.cr_number && <p className="font-medium"><span className="text-zinc-400">CR No:</span> {settings.cr_number}</p>}
                            <p className="font-medium"><span className="text-zinc-400">VAT No:</span> {settings?.vat_number || "300000000000003"}</p>
                            {(settings?.address_line1 || settings?.city) && (
                              <p className="max-w-sm leading-relaxed">
                                {[
                                  settings.address_line1,
                                  settings.address_line2,
                                  settings.city,
                                  settings.state,
                                  settings.postal_code,
                                  settings.country
                                ].filter(Boolean).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="bg-zinc-100 rounded-lg p-3 inline-block text-right mb-2">
                          <span className="block text-lg font-black text-zinc-850 uppercase tracking-wider">{inv.is_tax_invoice ? "Tax Invoice" : "Simplified Invoice"}</span>
                          <span className="block text-sm font-bold text-zinc-700 tracking-wide dir-rtl mt-0.5">
                            {inv.is_tax_invoice ? "فاتورة ضريبية" : "فاتورة مبسطة"}
                          </span>
                        </div>
                        <h2 className="text-4xl font-black text-zinc-900 mt-1">{inv.number}</h2>
                        <div className="mt-2"><StatusBadge status={inv.status} /></div>
                      </div>
                    </div>
                  )}

                  {printOnLetterhead && (
                    <div className="flex justify-between items-start pb-6 border-b-2 border-zinc-200">
                      <div>
                        <span className="block text-2xl font-black text-zinc-800 uppercase tracking-wider">{inv.is_tax_invoice ? "Tax Invoice" : "Simplified Invoice"}</span>
                        <span className="block text-lg font-bold text-zinc-600 tracking-wide dir-rtl mt-0.5">
                          {inv.is_tax_invoice ? "فاتورة ضريبية" : "فاتورة مبسطة"}
                        </span>
                      </div>
                      <div className="text-right">
                        <h2 className="text-4xl font-black text-zinc-900">{inv.number}</h2>
                        <div className="mt-2"><StatusBadge status={inv.status} /></div>
                      </div>
                    </div>
                  )}

                  {/* Details Grid */}
                  <div className="grid grid-cols-3 gap-8 py-8 text-sm">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2">Bill To / العميل</p>
                      <div className="space-y-1">
                        <p className="font-bold text-base text-zinc-800">{inv.customer_name ?? "—"}</p>
                        {inv.customer_vat && (
                          <p className="text-xs text-zinc-500 font-medium">
                            <span className="text-zinc-400">VAT:</span> {inv.customer_vat}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2">Date Details / التواريخ</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">Issue Date:</span>
                          <span className="font-semibold text-zinc-700">{formatDate(inv.issue_date)}</span>
                        </div>
                        {inv.due_date && (
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">Due Date:</span>
                            <span className="font-semibold text-zinc-700">{formatDate(inv.due_date)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {inv.custom_fields && Object.keys(inv.custom_fields).length > 0 && (
                      <div className="bg-zinc-50/70 rounded-lg p-4 border border-zinc-100 print:bg-transparent print:border-none print:p-0">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2">Additional details</p>
                        <div className="space-y-1.5 text-xs">
                          {Object.entries(inv.custom_fields).map(([key, val]: any) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-zinc-400 capitalize">{key.replace(/_/g, " ")}:</span>
                              <span className="font-semibold text-zinc-700">{val === true ? "Yes" : val === false ? "No" : String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Table */}
                  <div className="mt-2">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-zinc-800 text-white rounded-lg overflow-hidden">
                          <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider rounded-l-lg">Description / الوصف</th>
                          <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider w-20">Qty / الكمية</th>
                          <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider w-32">Unit Price / سعر الوحدة</th>
                          {inv.is_tax_invoice && <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider w-20">VAT / الضريبة</th>}
                          <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider w-36 rounded-r-lg">Total / الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {inv.lines?.map((l: any) => (
                          <tr key={l.id} className="hover:bg-zinc-50/50 transition-colors print:break-inside-avoid">
                            <td className="p-4 font-medium text-zinc-800">{l.description}</td>
                            <td className="p-4 text-right text-zinc-600 font-semibold">{l.qty}</td>
                            <td className="p-4 text-right text-zinc-600 font-semibold">{formatSAR(l.unit_price)}</td>
                            {inv.is_tax_invoice && <td className="p-4 text-right text-zinc-600 font-semibold">{l.vat_rate}%</td>}
                            <td className="p-4 text-right text-zinc-800 font-bold">{formatSAR(l.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Totals / ZATCA Details */}
                  <div className="grid grid-cols-12 gap-8 pt-8 mt-6 border-t-2 border-zinc-100 print:break-inside-avoid">
                    <div className="col-span-7 flex flex-col gap-4">
                      {inv.is_tax_invoice && qr && (
                        <div className="flex gap-4 items-start">
                          <img src={qr} alt="ZATCA QR" className="border-2 p-1.5 bg-white rounded-lg shadow-sm print:shadow-none w-36 h-36" />
                          {inv.zatca_uuid && (
                            <div className="text-[9px] text-zinc-400 leading-normal font-mono space-y-1 mt-1">
                              <p className="break-all"><span className="font-bold text-zinc-500">UUID:</span> {inv.zatca_uuid}</p>
                              <p className="break-all"><span className="font-bold text-zinc-500">HASH:</span> {String(inv.zatca_hash)}</p>
                              <p className="break-all"><span className="font-bold text-zinc-500">PREV HASH:</span> {String(inv.zatca_prev_hash).slice(0, 32)}…</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="col-span-5 space-y-2 text-sm bg-zinc-50/50 p-6 rounded-xl border border-zinc-100 print:bg-transparent print:border-none print:p-0">
                      <div className="flex justify-between py-1">
                        <span className="text-zinc-400 font-medium">Subtotal / المجموع الفرعي</span>
                        <span className="font-bold text-zinc-700">{formatSAR(inv.subtotal)}</span>
                      </div>
                      {inv.is_tax_invoice && (
                        <div className="flex justify-between py-1">
                          <span className="text-zinc-400 font-medium">VAT 15% / ضريبة القيمة المضافة</span>
                          <span className="font-bold text-zinc-700">{formatSAR(inv.vat_total)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-lg font-black pt-4 border-t border-zinc-200 text-zinc-800">
                        <span>Total / الإجمالي الكلي</span>
                        <span className="text-xl text-zinc-900">{formatSAR(inv.total)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-16 pt-6 border-t border-zinc-200 text-[10px] text-zinc-400 text-center font-medium">
                    ZATCA-compliant simplified tax invoice · Generated by ERP SaaS
                  </div>
                </td>
              </tr>
            </tbody>
            {printOnLetterhead && (
              <tfoot>
                <tr>
                  <td style={{ height: `${bottomMargin}mm` }} className="p-0 border-none"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
