"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Save, Send, Check } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatSAR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";

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

export default function NewQuotationPage() {
  const router = useRouter();

  // Master lists
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cfDefinitions, setCfDefinitions] = useState<any[]>([]);

  // State fields
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [validityTerms, setValidityTerms] = useState("30 Days");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");

  // Lines
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");

  // Custom fields
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [noteTemplates, setNoteTemplates] = useState<any[]>([]);
  const [notesContent, setNotesContent] = useState("");
  const [notesPlaceholder, setNotesPlaceholder] = useState("Enter terms and conditions...");

  const customerRef = useRef<HTMLDivElement>(null);
  const productRef = useRef<HTMLTableCellElement>(null);

  // Load configuration
  useEffect(() => {
    api.listCustomers().then(setCustomers).catch((err) => console.error("Error loading customers", err));
    api.listProducts().then(setProducts).catch((err) => console.error("Error loading products", err));
    api.listCustomFields("quotation").then(setCfDefinitions).catch((err) => console.error("Error loading custom fields", err));
    api.listNoteTemplates().then((tpls) => {
      setNoteTemplates(tpls || []);
      const def = tpls?.find((t: any) => t.isDefault);
      if (def) {
        setNotesContent(def.content);
        setNotesPlaceholder(def.content);
      }
    }).catch((err) => console.error("Error loading note templates", err));
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerRef.current && !customerRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (productRef.current && !productRef.current.contains(event.target as Node)) {
        setActiveLineIdx(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.name?.toLowerCase().includes(q) || 
      c.vat_number?.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  // Filtered products for search
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p => 
      p.name?.toLowerCase().includes(q) || 
      p.sku?.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  // Line computations helper
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

  // Financial Summary Breakdown
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
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  const updateLineField = (idx: number, field: keyof LineItem, val: any) => {
    const next = [...lines];
    next[idx] = { ...next[idx], [field]: val };
    setLines(next);
  };

  const selectProductSuggestion = (idx: number, prod: any) => {
    const next = [...lines];
    next[idx] = {
      ...next[idx],
      productId: prod.id,
      description: prod.name,
      unitPrice: Number(prod.price_sar) || 0,
      unit: "Pcs",
    };
    setLines(next);
    setActiveLineIdx(null);
    setProductSearch("");
  };

  const handleSave = async (status: "draft" | "sent") => {
    if (!selectedCustomerId) {
      alert("Please select a customer.");
      return;
    }

    setSaving(true);
    try {
      const finalLines = computedLines.map((l) => ({
        productId: l.productId || undefined,
        description: `${l.description}${l.unit !== "Pcs" ? ` (Unit: ${l.unit})` : ""}`,
        qty: Number(l.qty) || 1,
        unitPrice: Number(l.taxable / (l.qty || 1)),
        vatRate: Number(l.vatRate),
      }));

      const payload = {
        customerId: selectedCustomerId,
        issueDate,
        dueDate: expiryDate, // Expiry date mapped to dueDate in database
        isTaxQuote: true,
        lines: finalLines,
        customFields: {
          ...customFields,
          validity_terms: validityTerms,
          payment_terms: paymentTerms,
          total_discount: financialSummary.totalDiscount,
          notes_content: notesContent,
        },
      };

      const q = await api.createQuotation(payload);

      if (status === "sent") {
        await api.updateQuotation(q.id, { status: "sent" });
      }

      router.push("/invoicing/quotations");
    } catch (err: any) {
      alert("Failed to save quotation: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/invoicing/quotations" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Quotations
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">New Quotation</span>
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">New Quotation</h1>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/invoicing/quotations">Cancel</Link>
          </Button>
          <Button variant="secondary" size="sm" disabled={saving} onClick={() => handleSave("draft")}>
            <Save className="h-4 w-4 mr-1.5" /> Save as Draft
          </Button>
          <Button size="sm" disabled={saving} onClick={() => handleSave("sent")}>
            <Send className="h-4 w-4 mr-1.5" /> Save & Send
          </Button>
        </div>
      </div>

      <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
        {/* Quotation Metadata Block */}
        <Card className="shadow-sm border-zinc-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-zinc-800">Quotation Information</CardTitle>
            <CardDescription>Issue details, customer selection, and validity rules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Customer Selector */}
              <div className="space-y-2 relative" ref={customerRef}>
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Customer <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    placeholder={selectedCustomer ? selectedCustomer.name : "Search/select customer..."}
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                  />
                  {showCustomerDropdown && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-zinc-200 rounded-md shadow-lg z-20 max-h-56 overflow-y-auto mt-1">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground text-center">No customers found</div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-zinc-50 text-xs flex justify-between items-center text-zinc-900"
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setCustomerSearch("");
                              setShowCustomerDropdown(false);
                            }}
                          >
                            <div>
                              <div className="font-semibold">{c.name}</div>
                              {c.company_name_ar && <div className="text-[10px] text-zinc-500">{c.company_name_ar}</div>}
                            </div>
                            {selectedCustomerId === c.id && <Check className="h-4 w-4 text-emerald-500" />}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {selectedCustomer && (
                  <p className="text-[10px] text-zinc-500 font-semibold mt-1">
                    VAT No: {selectedCustomer.vat_number || "—"} | CR No: {selectedCustomer.cr_number || "—"}
                  </p>
                )}
              </div>

              {/* Quotation Date */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Quotation Date</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Expiry Date</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>

              {/* Validity Terms */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Validity Period</Label>
                <select
                  value={validityTerms}
                  onChange={(e) => setValidityTerms(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="15 Days">15 Days</option>
                  <option value="30 Days">30 Days</option>
                  <option value="45 Days">45 Days</option>
                  <option value="60 Days">60 Days</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items Spreadsheet Grid */}
        <Card className="shadow-sm border-zinc-200 overflow-visible">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-zinc-800">Line Items</CardTitle>
            <CardDescription>Line items breakdown, unit measurements, discounts, and VAT rates</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 overflow-visible">
            <div className="overflow-x-auto overflow-visible pb-32">
              <table className="w-full text-sm border-collapse min-w-[900px] overflow-visible">
                <thead>
                  <tr className="bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider border-b">
                    <th className="text-left p-3 w-[30%]">Product / Description</th>
                    <th className="text-right p-3 w-[10%]">Qty</th>
                    <th className="text-center p-3 w-[10%]">Unit</th>
                    <th className="text-right p-3 w-[15%]">Unit Price (SAR)</th>
                    <th className="text-center p-3 w-[15%]">Discount</th>
                    <th className="text-center p-3 w-[10%]">Tax Rate</th>
                    <th className="text-right p-3 w-[15%]">Total (SAR)</th>
                    <th className="p-3 w-[5%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 overflow-visible">
                  {lines.map((l, i) => (
                    <tr key={i} className="hover:bg-zinc-50/50 transition-colors overflow-visible">
                      {/* Product Autocomplete & Description */}
                      <td className="p-3 relative overflow-visible" ref={activeLineIdx === i ? productRef : undefined}>
                        <Input
                          placeholder="Type product name/service..."
                          value={activeLineIdx === i ? productSearch : l.description}
                          onChange={(e) => {
                            setProductSearch(e.target.value);
                            updateLineField(i, "description", e.target.value);
                            setActiveLineIdx(i);
                          }}
                          onFocus={() => {
                            setActiveLineIdx(i);
                            setProductSearch(l.description || "");
                          }}
                        />
                        {activeLineIdx === i && (
                          <div className="absolute top-full left-3 right-3 bg-white border border-zinc-200 rounded-md shadow-lg z-20 max-h-48 overflow-y-auto mt-1">
                            {filteredProducts.length === 0 ? (
                              <div className="p-2 text-xs text-muted-foreground text-center">No products found</div>
                            ) : (
                              filteredProducts.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => selectProductSuggestion(i, p)}
                                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 text-xs flex justify-between text-zinc-900"
                                >
                                  <span className="font-semibold">{p.name}</span>
                                  <span className="text-zinc-500 font-medium">{formatSAR(p.price_sar)}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="p-3">
                        <Input
                          type="number"
                          min={0.01}
                          step="any"
                          className="text-right"
                          value={l.qty}
                          onChange={(e) => updateLineField(i, "qty", parseFloat(e.target.value) || 0)}
                        />
                      </td>

                      {/* Unit */}
                      <td className="p-3">
                        <Input
                          type="text"
                          className="text-center"
                          value={l.unit}
                          onChange={(e) => updateLineField(i, "unit", e.target.value)}
                        />
                      </td>

                      {/* Unit Price */}
                      <td className="p-3">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="text-right"
                          value={l.unitPrice}
                          onChange={(e) => updateLineField(i, "unitPrice", parseFloat(e.target.value) || 0)}
                        />
                      </td>

                      {/* Discount Toggle & Value */}
                      <td className="p-3">
                        <div className="flex gap-1 items-center">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            className="text-right w-[60%]"
                            value={l.discountValue}
                            onChange={(e) => updateLineField(i, "discountValue", parseFloat(e.target.value) || 0)}
                          />
                          <button
                            type="button"
                            className={`w-[40%] text-[10px] font-bold h-10 border rounded-md transition-colors ${
                              l.discountType === "percent"
                                ? "bg-zinc-800 text-white"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                            }`}
                            onClick={() => updateLineField(i, "discountType", l.discountType === "percent" ? "amount" : "percent")}
                          >
                            {l.discountType === "percent" ? "%" : "SAR"}
                          </button>
                        </div>
                      </td>

                      {/* Tax Rate (VAT) */}
                      <td className="p-3">
                        <select
                          value={l.vatRate}
                          onChange={(e) => updateLineField(i, "vatRate", parseInt(e.target.value) || 0)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value={15}>15% VAT</option>
                          <option value={0}>0% VAT</option>
                        </select>
                      </td>

                      {/* Total */}
                      <td className="p-3 text-right font-bold text-zinc-950">
                        {formatSAR(computedLines[i].total)}
                      </td>

                      {/* Trash action */}
                      <td className="p-3 text-center">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeLineItem(i)}
                          disabled={lines.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-zinc-400 hover:text-rose-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t">
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Line Item
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer & Totals side-by-side block */}
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Block: Custom Fields & Validity Details */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="shadow-sm border-zinc-200">
              <CardHeader>
                <CardTitle className="text-base font-bold text-zinc-800">Additional Information & Customs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Dynamic Custom Fields Renderer */}
                {cfDefinitions.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {cfDefinitions.map((cf) => (
                      <div key={cf.id} className="space-y-1">
                        <Label className="text-xs font-bold text-zinc-500">
                          {cf.field_label} {cf.is_required && <span className="text-rose-500">*</span>}
                        </Label>
                        {cf.field_type === "boolean" ? (
                          <div className="flex items-center gap-2 mt-2">
                            <input 
                              type="checkbox"
                              checked={!!customFields[cf.field_key]}
                              onChange={(e) => setCustomFields({ ...customFields, [cf.field_key]: e.target.checked })}
                              className="h-4 w-4 rounded border-input"
                            />
                            <span className="text-xs font-medium text-zinc-700">Yes</span>
                          </div>
                        ) : cf.field_type === "number" ? (
                          <Input 
                            type="number"
                            value={customFields[cf.field_key] ?? ""}
                            onChange={(e) => setCustomFields({ ...customFields, [cf.field_key]: parseFloat(e.target.value) || 0 })}
                            required={cf.is_required}
                          />
                        ) : cf.field_type === "date" ? (
                          <Input 
                            type="date"
                            value={customFields[cf.field_key] ?? ""}
                            onChange={(e) => setCustomFields({ ...customFields, [cf.field_key]: e.target.value })}
                            required={cf.is_required}
                          />
                        ) : (
                          <Input 
                            type="text"
                            value={customFields[cf.field_key] ?? ""}
                            onChange={(e) => setCustomFields({ ...customFields, [cf.field_key]: e.target.value })}
                            required={cf.is_required}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Validity terms and Payment terms details */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-zinc-500">Payment Terms</Label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>

                {/* Note templates selector & content */}
                <div className="space-y-3 pt-2">
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
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={noteTemplates.find((x) => x.content === notesContent)?.id || "empty"}
                    >
                      <option value="empty">Blank / Empty Layout</option>
                      {noteTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} {t.isDefault ? "(Default)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-zinc-500">Notes / Terms & Conditions (Comment)</Label>
                    <textarea
                      value={notesContent}
                      onChange={(e) => setNotesContent(e.target.value)}
                      placeholder={notesPlaceholder}
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Block: Totals Financial Summary */}
          <div className="lg:col-span-5">
            <Card className="shadow-sm border-zinc-200 bg-zinc-50/50">
              <CardHeader>
                <CardTitle className="text-base font-bold text-zinc-800">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500 font-medium">Subtotal (Excl. VAT)</span>
                    <span className="font-semibold text-zinc-700">{formatSAR(financialSummary.subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-emerald-600 font-medium">
                    <span>Total Discount</span>
                    <span>-{formatSAR(financialSummary.totalDiscount)}</span>
                  </div>
                  <div className="flex justify-between py-1 font-medium border-t border-dashed pt-2">
                    <span className="text-zinc-500">Total Taxable Amount</span>
                    <span className="text-zinc-700">{formatSAR(financialSummary.totalTaxableAmount)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-zinc-500 font-medium">
                    <span>Total VAT (15%)</span>
                    <span className="text-zinc-700">{formatSAR(financialSummary.totalVat)}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg font-black pt-4 border-t-2 border-zinc-200 text-zinc-800">
                    <span>Total Due / الإجمالي</span>
                    <span className="text-xl text-zinc-950">{formatSAR(financialSummary.totalDue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
