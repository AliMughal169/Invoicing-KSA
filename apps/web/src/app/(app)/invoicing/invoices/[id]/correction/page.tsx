"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Save, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatSAR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LineItem {
  productId: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discountType: "percent" | "amount";
  discountValue: number;
  vatRate: number;
}

const EMPTY_LINE: LineItem = {
  productId: "",
  description: "",
  qty: 1,
  unit: "Pcs",
  unitPrice: 0,
  discountType: "percent",
  discountValue: 0,
  vatRate: 15,
};

export default function CorrectionInvoicePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const type = (searchParams.get("type") as "CREDIT_NOTE" | "DEBIT_NOTE") || "CREDIT_NOTE";

  // Master lists
  const [parentInvoice, setParentInvoice] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [cfDefinitions, setCfDefinitions] = useState<any[]>([]);

  // State fields
  const [lines, setLines] = useState<LineItem[]>([]);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [noteTemplates, setNoteTemplates] = useState<any[]>([]);
  const [notesContent, setNotesContent] = useState("");
  const [notesPlaceholder, setNotesPlaceholder] = useState("Enter terms and conditions...");
  const [saving, setSaving] = useState(false);

  const productRef = useRef<HTMLTableCellElement>(null);

  // Load parent invoice & masters
  useEffect(() => {
    if (!id) return;
    
    api.getInvoice(id).then((inv) => {
      setParentInvoice(inv);
      if (inv.lines && inv.lines.length > 0) {
        setLines(
          inv.lines.map((l: any) => ({
            productId: l.product_id || "",
            description: l.description || "",
            qty: Number(l.qty) || 1,
            unit: "Pcs",
            unitPrice: Number(l.unit_price) || 0,
            discountType: "percent",
            discountValue: 0,
            vatRate: Number(l.vat_rate) || 15,
          }))
        );
      } else {
        setLines([{ ...EMPTY_LINE }]);
      }
      setCustomFields(inv.custom_fields || {});
    }).catch((err) => console.error("Error loading parent invoice", err));

    api.listProducts().then(setProducts).catch((err) => console.error("Error loading products", err));
    api.listCustomFields("invoice").then(setCfDefinitions).catch((err) => console.error("Error loading custom fields", err));
    api.listNoteTemplates().then((tpls) => {
      setNoteTemplates(tpls || []);
      const def = tpls?.find((t: any) => t.isDefault);
      if (def) {
        setNotesContent(def.content);
        setNotesPlaceholder(def.content);
      }
    }).catch((err) => console.error("Error loading note templates", err));
  }, [id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (productRef.current && !productRef.current.contains(event.target as Node)) {
        setActiveLineIdx(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 8);
    const q = productSearch.toLowerCase();
    return products.filter((p) =>
      p.nameEn?.toLowerCase().includes(q) ||
      p.nameAr?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const computedLines = useMemo(() => {
    return lines.map((l) => {
      const base = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
      let discountAmt = 0;
      if (l.discountType === "percent") {
        discountAmt = base * ((Number(l.discountValue) || 0) / 100);
      } else {
        discountAmt = Number(l.discountValue) || 0;
      }
      const taxable = Math.max(0, base - discountAmt);
      const vat = taxable * ((Number(l.vatRate) || 0) / 100);
      const total = taxable + vat;
      return {
        ...l,
        base,
        discountAmt,
        taxable,
        vat,
        total,
      };
    });
  }, [lines]);

  const financialSummary = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTaxableAmount = 0;
    let totalVat = 0;
    let totalDue = 0;

    computedLines.forEach((l) => {
      subtotal += l.base;
      totalDiscount += l.discountAmt;
      totalTaxableAmount += l.taxable;
      totalVat += l.vat;
      totalDue += l.total;
    });

    return {
      subtotal,
      totalDiscount,
      totalTaxableAmount,
      totalVat,
      totalDue,
    };
  }, [computedLines]);

  const addLineItem = () => {
    setLines([...lines, { ...EMPTY_LINE }]);
  };

  const removeLineItem = (idx: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLineItem = (idx: number, key: keyof LineItem, val: any) => {
    const next = [...lines];
    next[idx] = { ...next[idx], [key]: val };
    setLines(next);
  };

  const selectProductForLine = (idx: number, prod: any) => {
    const next = [...lines];
    next[idx] = {
      ...next[idx],
      productId: prod.id,
      description: prod.nameEn || prod.name_en || prod.name,
      unitPrice: Number(prod.salesPrice || prod.sales_price || prod.price_sar) || 0,
      unit: prod.unit || "Pcs",
    };
    setLines(next);
    setActiveLineIdx(null);
    setProductSearch("");
  };

  const handleSave = async () => {
    if (!id || !parentInvoice) return;

    setSaving(true);
    try {
      const finalLines = computedLines.map((l) => ({
        productId: l.productId || undefined,
        description: l.description,
        qty: Number(l.qty) || 1,
        unitPrice: Number(l.unitPrice) || 0,
        vatRate: Number(l.vatRate),
      }));

      const payload = {
        parentInvoiceId: id,
        type: type,
        lines: finalLines,
        customFields: {
          ...customFields,
          total_discount: financialSummary.totalDiscount,
          notes_content: notesContent,
        },
      };

      const created = await api.createCorrectionDocument(payload);
      router.push(`/invoicing/invoices/${created.id}`);
    } catch (err: any) {
      alert("Failed to save correction: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  if (!parentInvoice) return <div className="p-10 text-muted-foreground">Loading parent invoice details...</div>;

  const isCredit = type === "CREDIT_NOTE";
  const titleEn = isCredit ? "NEW CREDIT NOTE / Sales Return" : "NEW DEBIT NOTE / Supplemental Invoice";
  const titleAr = isCredit ? "إشعار دائن جديد" : "إشعار مدين جديد";

  return (
    <PageShell>
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href={`/invoicing/invoices/${id}`} className="hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Parent Invoice ({parentInvoice.number})
            </Link>
            <span>/</span>
            <span className="text-zinc-500">Correction</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-800 tracking-tight flex items-center gap-2">
            {titleEn}
          </h1>
          <p className="text-sm font-semibold text-indigo-600 dir-rtl text-right">{titleAr}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/invoicing/invoices/${id}`)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-zinc-100 font-semibold"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving Correction..." : `Save ${isCredit ? "Credit Note" : "Debit Note"}`}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: Customer Profile (Read-only) */}
          <Card className="shadow-sm border-zinc-200">
            <CardHeader>
              <CardTitle className="text-base text-zinc-800">Linked Customer Profile</CardTitle>
              <CardDescription>Locked to match the parent document context</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4 text-sm bg-zinc-50 p-4 rounded-lg border border-zinc-150">
                <div>
                  <p className="text-xs text-zinc-400 font-bold uppercase">Customer Name</p>
                  <p className="font-semibold text-zinc-700 mt-0.5">{parentInvoice.customer_name ?? "Simplified Customer"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-bold uppercase">VAT Number</p>
                  <p className="font-semibold text-zinc-700 mt-0.5">{parentInvoice.customer_vat ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-bold uppercase">Original Invoice</p>
                  <p className="font-mono font-semibold text-indigo-650 mt-0.5">{parentInvoice.number}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Items Table */}
          <Card className="shadow-sm border-zinc-200 overflow-visible">
            <CardHeader className="border-b bg-zinc-50/50 py-4">
              <CardTitle className="text-base text-zinc-800">Adjust Line Items</CardTitle>
              <CardDescription>Configure return quantities or pricing differences</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-visible">
              <div className="w-full pb-32 overflow-visible">
                <Table className="w-full border-collapse">
                  <TableHeader className="bg-zinc-50/70 border-b">
                    <TableRow>
                      <TableHead className="w-[45%] font-bold text-zinc-700">Item Detail / Description</TableHead>
                      <TableHead className="w-[12%] font-bold text-zinc-700 text-center">Qty</TableHead>
                      <TableHead className="w-[15%] font-bold text-zinc-700 text-right">Unit Price (SAR)</TableHead>
                      <TableHead className="w-[12%] font-bold text-zinc-700 text-center">VAT Rate</TableHead>
                      <TableHead className="w-[12%] font-bold text-zinc-700 text-right">Total (SAR)</TableHead>
                      <TableHead className="w-[4%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, idx) => (
                      <TableRow key={idx} className="hover:bg-zinc-50/30 overflow-visible align-top">
                        {/* Description / Autocomplete Cell */}
                        <TableCell className="relative overflow-visible" ref={idx === activeLineIdx ? productRef : undefined}>
                          <div className="space-y-1.5">
                            <Input
                              value={line.description}
                              onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                              onFocus={() => {
                                setActiveLineIdx(idx);
                                setProductSearch("");
                              }}
                              placeholder="Type or click to search catalog..."
                              className="h-9 text-xs"
                            />
                            {idx === activeLineIdx && (
                              <div className="absolute left-4 right-4 z-50 mt-1 rounded-md border border-zinc-200 bg-white shadow-xl max-h-[220px] overflow-y-auto custom-scrollbar p-1">
                                <div className="p-2 border-b">
                                  <input
                                    type="text"
                                    placeholder="Filter by SKU or Name..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="w-full h-8 px-2 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    autoFocus
                                  />
                                </div>
                                {filteredProducts.length === 0 ? (
                                  <div className="p-3 text-center text-xs text-zinc-400">No matching products</div>
                                ) : (
                                  filteredProducts.map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => selectProductForLine(idx, p)}
                                      className="flex w-full flex-col text-left px-3 py-2 text-xs hover:bg-zinc-50 rounded-md transition"
                                    >
                                      <span className="font-bold text-zinc-800">{p.nameEn || p.name_en}</span>
                                      <span className="text-[10px] text-zinc-400 font-mono">SKU: {p.sku} | SAR {p.salesPrice || p.sales_price || p.price_sar}</span>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Quantity Cell */}
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={line.qty}
                            onChange={(e) => updateLineItem(idx, "qty", parseFloat(e.target.value) || 0)}
                            className="h-9 text-center text-xs font-semibold"
                          />
                        </TableCell>

                        {/* Unit Price Cell */}
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unitPrice}
                            onChange={(e) => updateLineItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                            className="h-9 text-right text-xs font-mono"
                          />
                        </TableCell>

                        {/* VAT Rate Cell */}
                        <TableCell className="text-center">
                          <select
                            value={line.vatRate}
                            onChange={(e) => updateLineItem(idx, "vatRate", parseInt(e.target.value) || 0)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none"
                          >
                            <option value={15}>15% (Standard)</option>
                            <option value={5}>5% (Reduced)</option>
                            <option value={0}>0% (Zero-rated)</option>
                          </select>
                        </TableCell>

                        {/* Line Total Cell */}
                        <TableCell className="text-right font-mono text-xs font-bold text-zinc-700 pt-5">
                          {formatSAR(computedLines[idx].total)}
                        </TableCell>

                        {/* Action Delete Cell */}
                        <TableCell className="text-center pt-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLineItem(idx)}
                            className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10"
                            disabled={lines.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <div className="p-4 border-t flex justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLineItem}
                    className="h-8 text-xs flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> Add Line
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          {/* Financial Breakdown Card */}
          <Card className="shadow-sm border-zinc-200 bg-zinc-50/50">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-base text-zinc-800">Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between py-1 border-b border-zinc-150">
                  <span className="text-zinc-500 font-medium">Subtotal (Excl. VAT)</span>
                  <span className="font-semibold text-zinc-700">{formatSAR(financialSummary.subtotal)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-150 text-emerald-650">
                  <span className="font-medium">Total Discount</span>
                  <span className="font-semibold">- {formatSAR(financialSummary.totalDiscount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-150">
                  <span className="text-zinc-500 font-medium">Taxable Amount</span>
                  <span className="font-semibold text-zinc-700">{formatSAR(financialSummary.totalTaxableAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-150">
                  <span className="text-zinc-500 font-medium">VAT Total (15%)</span>
                  <span className="font-semibold text-zinc-700">{formatSAR(financialSummary.totalVat)}</span>
                </div>
                <div className="flex justify-between py-2 text-base font-bold text-zinc-800 border-t border-zinc-200">
                  <span>Grand Total</span>
                  <span className="text-indigo-650">{formatSAR(financialSummary.totalDue)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Custom Fields */}
          {cfDefinitions.length > 0 && (
            <Card className="shadow-sm border-zinc-200">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">Custom Metadata Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cfDefinitions.map((cf) => (
                  <div key={cf.id} className="space-y-1">
                    <Label className="text-xs text-zinc-500 font-semibold">{cf.field_label}</Label>
                    <Input
                      value={customFields[cf.field_key] ?? ""}
                      onChange={(e) => setCustomFields({ ...customFields, [cf.field_key]: e.target.value })}
                      required={cf.is_required}
                      placeholder={`Enter ${cf.field_label.toLowerCase()}...`}
                      className="h-9 text-xs"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Document Terms & Comments */}
          <Card className="shadow-sm border-zinc-200">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">Document Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-zinc-500">Load Terms/Notes Template</Label>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "empty") {
                      setNotesContent("");
                      setNotesPlaceholder("Enter terms and conditions...");
                    } else {
                      const t = noteTemplates.find((x) => x.id === val);
                      if (t) {
                        setNotesContent(t.content);
                        setNotesPlaceholder(t.content);
                      }
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                >
                  <option value="empty">-- Empty Notes / Terms --</option>
                  {noteTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} {t.isDefault ? "(Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-zinc-500">Notes / Comments</Label>
                <textarea
                  value={notesContent}
                  onChange={(e) => setNotesContent(e.target.value)}
                  placeholder={notesPlaceholder}
                  rows={4}
                  className="flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
