"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Save, ShieldAlert, Check } from "lucide-react";
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

export default function NewProformaPage() {
  const router = useRouter();

  // Master lists
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cfDefinitions, setCfDefinitions] = useState<any[]>([]);

  // State fields
  const [isSimplified, setIsSimplified] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplyDate, setSupplyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [bankDetails, setBankDetails] = useState("Saudi National Bank (SNB)");

  // Lines
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");

  // Custom fields
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const customerRef = useRef<HTMLDivElement>(null);
  const productRef = useRef<HTMLTableCellElement>(null);

  // Load configuration
  useEffect(() => {
    api.listCustomers().then(setCustomers).catch((err) => console.error("Error loading customers", err));
    api.listProducts().then(setProducts).catch((err) => console.error("Error loading products", err));
    api.listCustomFields("invoice").then(setCfDefinitions).catch((err) => console.error("Error loading custom fields", err));
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

  const handleSave = async () => {
    if (!isSimplified && !selectedCustomerId) {
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
        customerId: selectedCustomerId || undefined,
        issueDate,
        dueDate: new Date(new Date(issueDate).setDate(new Date(issueDate).getDate() + 30)).toISOString().slice(0, 10),
        isTaxInvoice: true,
        lines: finalLines,
        customFields: {
          ...customFields,
          invoice_type: isSimplified ? "simplified" : "standard",
          supply_date: supplyDate,
          payment_terms: paymentTerms,
          bank_details: bankDetails,
          total_discount: financialSummary.totalDiscount,
        },
      };

      await api.createProformaInvoice(payload);
      router.push("/invoicing/invoices");
    } catch (err: any) {
      alert("Failed to save proforma invoice: " + (err.message || err));
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
            <Link href="/invoicing/invoices" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Invoices
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">New Proforma</span>
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">New Proforma Invoice</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Invoice Type Toggle */}
          <div className="flex bg-zinc-100 p-1 rounded-lg border mr-2">
            <button 
              type="button" 
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${!isSimplified ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
              onClick={() => {
                setIsSimplified(false);
                setSelectedCustomerId("");
              }}
            >
              Standard (B2B)
            </button>
            <button 
              type="button" 
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${isSimplified ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
              onClick={() => {
                setIsSimplified(true);
                setSelectedCustomerId("");
              }}
            >
              Simplified (B2C)
            </button>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href="/invoicing/invoices">Cancel</Link>
          </Button>
          <Button size="sm" disabled={saving} onClick={handleSave}>
            <Save className="h-4 w-4 mr-1.5" /> Save Proforma
          </Button>
        </div>
      </div>

      <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
        {/* Invoice Metadata Block */}
        <Card className="shadow-sm border-zinc-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-zinc-800">Proforma Details</CardTitle>
            <CardDescription>Issue details, customer selection, and supply context</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Customer Selector */}
              <div className="space-y-2 relative" ref={customerRef}>
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Customer {!isSimplified && <span className="text-rose-500">*</span>}
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
                            className="w-full text-left px-3 py-2 hover:bg-zinc-50 text-xs flex justify-between items-center"
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setCustomerSearch("");
                              setShowCustomerDropdown(false);
                            }}
                          >
                            <div>
                              <div className="font-semibold text-zinc-800">{c.name}</div>
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

              {/* Invoice Date */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Proforma Date</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>

              {/* Supply Date */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Supply Date</Label>
                <Input type="date" value={supplyDate} onChange={(e) => setSupplyDate(e.target.value)} />
              </div>

              {/* Payment Terms */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Payment Terms</Label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-zinc-800 focus:outline-none"
                >
                  <option value="Cash on Delivery">Cash on Delivery</option>
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 30">Net 30 Days</option>
                  <option value="Net 60">Net 60 Days</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lines Excel Table Block */}
        <Card className="shadow-sm border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-zinc-850">Spreadsheet Line Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-visible">
            <div className="overflow-x-auto overflow-visible pb-32">
              <table className="w-full text-sm border-collapse min-w-[900px] overflow-visible">
                <thead>
                  <tr className="bg-zinc-50 border-y text-zinc-650 text-xs font-bold uppercase tracking-wider">
                    <th className="p-3 text-left w-10">#</th>
                    <th className="p-3 text-left w-[40%]">Product / Description</th>
                    <th className="p-3 text-right w-24">Qty</th>
                    <th className="p-3 text-center w-28">Unit</th>
                    <th className="p-3 text-right w-36">Unit Price</th>
                    <th className="p-3 text-center w-28">Discount</th>
                    <th className="p-3 text-right w-32">VAT 15%</th>
                    <th className="p-3 text-right w-36">Line Total</th>
                    <th className="p-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((item, i) => (
                    <tr key={i} className="hover:bg-zinc-50/50">
                      <td className="p-3 text-center font-semibold text-zinc-400">{i + 1}</td>
                      <td className="p-3 relative overflow-visible" ref={activeLineIdx === i ? productRef : undefined}>
                        <Input
                          placeholder="Type or select product..."
                          value={activeLineIdx === i ? productSearch : item.description}
                          onChange={(e) => {
                            updateLineField(i, "description", e.target.value);
                            setProductSearch(e.target.value);
                            setActiveLineIdx(i);
                          }}
                          onFocus={() => {
                            setActiveLineIdx(i);
                            setProductSearch(item.description || "");
                          }}
                          className="h-9"
                        />
                        {activeLineIdx === i && (
                          <div className="absolute left-3 right-3 bg-white border border-zinc-200 rounded-md shadow-lg z-20 max-h-48 overflow-y-auto mt-1">
                            {filteredProducts.length === 0 ? (
                              <div className="p-3 text-xs text-muted-foreground text-center">No products found</div>
                            ) : (
                              filteredProducts.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 text-xs flex justify-between items-center"
                                  onClick={() => selectProductSuggestion(i, p)}
                                >
                                  <div>
                                    <span className="font-semibold text-zinc-900">{p.name}</span>
                                    {p.sku && <span className="text-[10px] text-zinc-400 ml-2 font-mono">({p.sku})</span>}
                                  </div>
                                  <span className="font-bold text-zinc-700">{formatSAR(p.price_sar)}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => updateLineField(i, "qty", parseFloat(e.target.value) || 0)}
                          className="text-right h-9"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={item.unit}
                          onChange={(e) => updateLineField(i, "unit", e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-zinc-800"
                        >
                          <option value="Pcs">Pcs (عدد)</option>
                          <option value="Kg">Kg (كيلو)</option>
                          <option value="Ton">Ton (طن)</option>
                          <option value="Mtr">Mtr (متر)</option>
                          <option value="Box">Box (علبة)</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) => updateLineField(i, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="text-right h-9 font-mono"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1.5 items-center">
                          <Input
                            type="number"
                            min={0}
                            value={item.discountValue}
                            onChange={(e) => updateLineField(i, "discountValue", parseFloat(e.target.value) || 0)}
                            className="text-right h-9 w-16"
                          />
                          <select
                            value={item.discountType}
                            onChange={(e) => updateLineField(i, "discountType", e.target.value)}
                            className="flex h-9 rounded-md border border-input px-1 text-xs"
                          >
                            <option value="percent">%</option>
                            <option value="amount">SAR</option>
                          </select>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono text-zinc-500">
                        {formatSAR(computedLines[i].vat)}
                      </td>
                      <td className="p-3 text-right font-bold text-zinc-950">
                        {formatSAR(computedLines[i].total)}
                      </td>
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
          <div className="lg:col-span-7 space-y-6">
            <Card className="shadow-sm border-zinc-200">
              <CardHeader>
                <CardTitle className="text-base font-bold text-zinc-800">Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-zinc-500">Deposit Bank Details</Label>
                  <select
                    value={bankDetails}
                    onChange={(e) => setBankDetails(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="Saudi National Bank (SNB)">Saudi National Bank (SNB) - Main Corporate A/C</option>
                    <option value="Al Rajhi Bank">Al Rajhi Bank - Corporate SAR A/C</option>
                    <option value="Riyad Bank">Riyad Bank - VAT Settlement A/C</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>

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
