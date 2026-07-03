"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, X, Plus, Trash2, Languages, AlertCircle } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { api } from "@/lib/api";
import { formatSAR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageShell } from "@/components/page-shell";

interface BillLineValues {
  productId: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
}

interface BillFormValues {
  vendorId: string;
  billDate: string;
  dueDate: string;
  vendorInvoiceRef: string;
  notes: string;
  lines: BillLineValues[];
}

export default function EditBillPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [billStatus, setBillStatus] = useState("DRAFT");
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null);

  const { register, control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<BillFormValues>({
    defaultValues: {
      vendorId: "",
      billDate: "",
      dueDate: "",
      vendorInvoiceRef: "",
      notes: "",
      lines: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines"
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [vList, pList, bData] = await Promise.all([
          api.listVendors(),
          api.listProducts(),
          api.getBill(id)
        ]);
        setVendors(vList);
        setProducts(pList);
        setBillStatus(bData.status);

        reset({
          vendorId: bData.vendor_id || "",
          billDate: new Date(bData.bill_date).toISOString().slice(0, 10),
          dueDate: bData.due_date ? new Date(bData.due_date).toISOString().slice(0, 10) : "",
          vendorInvoiceRef: bData.vendor_invoice_ref || "",
          notes: bData.notes || "",
          lines: bData.lines.map((l: any) => ({
            productId: l.product_id || "",
            description: l.description || "",
            qty: Number(l.qty) || 1,
            unit: l.unit || "Pcs",
            unitPrice: Number(l.unit_price) || 0,
            vatRate: Number(l.vat_rate) || 15
          }))
        });
      } catch (err) {
        console.error("Failed to load bill details:", err);
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [id, reset]);

  const watchLines = watch("lines") || [];

  // Calculate totals
  const subtotal = watchLines.reduce((sum, line) => {
    const qty = Number(line?.qty) || 0;
    const price = Number(line?.unitPrice) || 0;
    return sum + (qty * price);
  }, 0);

  const vatTotal = watchLines.reduce((sum, line) => {
    const qty = Number(line?.qty) || 0;
    const price = Number(line?.unitPrice) || 0;
    const rate = Number(line?.vatRate) || 0;
    return sum + (qty * price * (rate / 100));
  }, 0);

  const grandTotal = subtotal + vatTotal;

  const handleProductChange = (index: number, prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setValue(`lines.${index}.description`, prod.name_en || "");
      setValue(`lines.${index}.unitPrice`, Number(prod.sales_price) || 0);
      setValue(`lines.${index}.unit`, prod.unit || "Pcs");
    }
  };

  const handleTranslateDescription = async (index: number) => {
    const desc = watchLines[index]?.description;
    if (!desc) return;
    setTranslatingIndex(index);
    try {
      const res = await api.translate(desc);
      if (res?.translatedText) {
        setValue(`lines.${index}.description`, res.translatedText);
      }
    } catch (err) {
      console.error("Description translation error:", err);
    } finally {
      setTranslatingIndex(null);
    }
  };

  const onSubmit = async (values: BillFormValues) => {
    setBusy(true);
    try {
      await api.updateBill(id, values);
      router.push("/purchasing/bills");
    } catch (err: any) {
      alert("Failed to update purchase bill: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="p-8 text-zinc-350">Loading purchase bill edit form...</div>
      </PageShell>
    );
  }

  if (billStatus !== "DRAFT") {
    return (
      <PageShell>
        <div className="max-w-md mx-auto mt-12 p-6 border border-zinc-800 bg-zinc-950/40 rounded-lg text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-zinc-200">Bill Cannot Be Edited</h2>
          <p className="text-sm text-zinc-400">
            This bill has already been approved or settled (Status: <span className="font-bold text-indigo-400">{billStatus}</span>).
            Only draft purchase bills can be modified.
          </p>
          <Button asChild className="mt-2">
            <Link href="/purchasing/bills">Return to Bill Listing</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* TOP BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Link href="/purchasing/bills" className="hover:underline flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Bills
              </Link>
              <span>/</span>
              <span className="text-zinc-200">Edit Bill</span>
            </div>
            <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Edit Supplier Bill</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/purchasing/bills")}
              className="border-zinc-800 text-zinc-200 hover:bg-zinc-800"
            >
              <X className="h-4 w-4 mr-2" /> Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-indigo-600 hover:bg-indigo-700 text-zinc-100"
            >
              <Save className="h-4 w-4 mr-2" /> {busy ? "Saving Changes..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* METADATA BOX */}
        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardContent className="p-6 grid sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-350">Vendor Profile</Label>
              <select
                {...register("vendorId", { required: "Vendor is required" })}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-zinc-900 text-zinc-450">Select Vendor Supplier...</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id} className="bg-zinc-900 text-zinc-200">
                    {v.name_en} ({v.name_ar})
                  </option>
                ))}
              </select>
              {errors.vendorId && <span className="text-xs text-rose-455">{errors.vendorId.message}</span>}
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-350">Bill Date</Label>
              <Input
                type="date"
                {...register("billDate", { required: "Bill Date is required" })}
                className="bg-zinc-950/50 border-zinc-800 text-zinc-100"
              />
              {errors.billDate && <span className="text-xs text-rose-455">{errors.billDate.message}</span>}
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-350">Due Date</Label>
              <Input
                type="date"
                {...register("dueDate", { required: "Due Date is required" })}
                className="bg-zinc-950/50 border-zinc-800 text-zinc-100"
              />
              {errors.dueDate && <span className="text-xs text-rose-455">{errors.dueDate.message}</span>}
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-355">Supplier Invoice Ref #</Label>
              <Input
                {...register("vendorInvoiceRef", { required: "Reference Number is required" })}
                placeholder="e.g. INV-2026-9021"
                className="bg-zinc-950/50 border-zinc-800 text-zinc-100 font-mono"
              />
              {errors.vendorInvoiceRef && <span className="text-xs text-rose-455">{errors.vendorInvoiceRef.message}</span>}
            </div>
          </CardContent>
        </Card>

        {/* SPREADSHEET-STYLE INTERACTIVE GRID */}
        <Card className="bg-zinc-900/30 border-zinc-800 overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900/50">
                  <TableHead className="w-[200px] text-zinc-200 pl-4">Item / Product</TableHead>
                  <TableHead className="text-zinc-200">Description</TableHead>
                  <TableHead className="w-[90px] text-zinc-200 text-right">Qty</TableHead>
                  <TableHead className="w-[90px] text-zinc-200 text-center">Unit</TableHead>
                  <TableHead className="w-[120px] text-zinc-200 text-right">Unit Price</TableHead>
                  <TableHead className="w-[100px] text-zinc-200 text-center">Tax (VAT)</TableHead>
                  <TableHead className="w-[120px] text-zinc-200 text-right">Line Total</TableHead>
                  <TableHead className="w-[50px] text-zinc-200 text-center pr-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const lineQty = watchLines[index]?.qty || 0;
                  const linePrice = watchLines[index]?.unitPrice || 0;
                  const lineTotal = +(lineQty * linePrice * 1.15).toFixed(2);

                  return (
                    <TableRow key={field.id} className="border-zinc-800 hover:bg-transparent">
                      <TableCell className="pl-4 align-top">
                        <select
                          {...register(`lines.${index}.productId` as const)}
                          onChange={(e) => handleProductChange(index, e.target.value)}
                          className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-sm text-zinc-100 focus:outline-none cursor-pointer"
                        >
                          <option value="" className="bg-zinc-900 text-zinc-450">Select Item...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-200">
                              {p.name_en}
                            </option>
                          ))}
                        </select>
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="relative">
                          <textarea
                            {...register(`lines.${index}.description` as const, { required: "Required" })}
                            onBlur={() => handleTranslateDescription(index)}
                            placeholder="Provide details or auto-translate English..."
                            rows={1}
                            className="flex min-h-[36px] w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none placeholder:text-zinc-550 resize-none pr-8"
                          />
                          {translatingIndex === index && (
                            <Languages className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-zinc-450" />
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`lines.${index}.qty` as const, { valueAsNumber: true })}
                          className="bg-zinc-950/50 border-zinc-800 text-zinc-100 text-right h-9"
                        />
                      </TableCell>

                      <TableCell className="align-top">
                        <Input
                          {...register(`lines.${index}.unit` as const)}
                          placeholder="Pcs"
                          className="bg-zinc-950/50 border-zinc-800 text-zinc-100 text-center h-9 font-semibold"
                        />
                      </TableCell>

                      <TableCell className="align-top">
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`lines.${index}.unitPrice` as const, { valueAsNumber: true })}
                          className="bg-zinc-950/50 border-zinc-800 text-zinc-100 text-right h-9"
                        />
                      </TableCell>

                      <TableCell className="align-top text-center pt-3 text-zinc-400 text-sm">
                        15% VAT
                      </TableCell>

                      <TableCell className="align-top text-right pt-3 font-bold text-zinc-100 pr-2">
                        {formatSAR(lineTotal)}
                      </TableCell>

                      <TableCell className="align-top text-center pr-4">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          className="h-9 w-9 text-zinc-455 hover:text-rose-400 hover:bg-zinc-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="p-3 border-t border-zinc-800 bg-zinc-950/20">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ productId: "", description: "", qty: 1, unit: "Pcs", unitPrice: 0, vatRate: 15 })}
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-850"
              >
                <Plus className="h-4 w-4 mr-1.5" /> Add Row Line
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* SIDE-BY-SIDE SUMMARY & FOOTER */}
        <div className="grid md:grid-cols-2 gap-6 items-start">
          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardContent className="p-4 space-y-2">
              <Label className="text-zinc-350">Remarks & Purchase Notes</Label>
              <textarea
                {...register("notes")}
                placeholder="Include custom terms or bank wire instructions..."
                rows={4}
                className="flex w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none placeholder:text-zinc-550 resize-none"
              />
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardContent className="p-6 space-y-3 text-sm text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-400">Subtotal (Excl. VAT):</span>
                <span className="font-semibold text-zinc-100">{formatSAR(subtotal)}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Input Tax (15% VAT):</span>
                <span className="font-semibold text-zinc-100">{formatSAR(vatTotal)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-base font-bold text-zinc-200">Grand Total Payable:</span>
                <span className="text-lg font-black text-indigo-400">{formatSAR(grandTotal)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </PageShell>
  );
}
