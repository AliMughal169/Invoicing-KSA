"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UploadCloud, Save, X, DollarSign, Percent } from "lucide-react";
import { useForm } from "react-hook-form";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";

interface ProductFormValues {
  nameEn: string;
  nameAr: string;
  sku: string;
  barcode: string;
  unit: string;
  costPrice: number;
  salesPrice: number;
  taxCategory: string;
  hsCode: string;
  trackInventory: boolean;
  qtyOnHand: number;
  reorderLevel: number;
  warehouseLocation: string;
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<ProductFormValues>({
    defaultValues: {
      nameEn: "",
      nameAr: "",
      sku: "",
      barcode: "",
      unit: "Pcs",
      costPrice: 0,
      salesPrice: 0,
      taxCategory: "STANDARD",
      hsCode: "",
      trackInventory: false,
      qtyOnHand: 0,
      reorderLevel: 0,
      warehouseLocation: "",
    },
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getProduct(id);
        reset({
          nameEn: data.name_en || "",
          nameAr: data.name_ar || "",
          sku: data.sku || "",
          barcode: data.barcode || "",
          unit: data.unit || "Pcs",
          costPrice: Number(data.cost_price) || 0,
          salesPrice: Number(data.sales_price) || 0,
          taxCategory: data.tax_category || "STANDARD",
          hsCode: data.hs_code || "",
          trackInventory: data.track_inventory || false,
          qtyOnHand: Number(data.qty_on_hand) || 0,
          reorderLevel: Number(data.reorder_level) || 0,
          warehouseLocation: data.warehouse_location || "",
        });
      } catch (err) {
        console.error("Failed to load product details:", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, reset]);

  const watchCostPrice = watch("costPrice") || 0;
  const watchSalesPrice = watch("salesPrice") || 0;
  const watchTrackInventory = watch("trackInventory") || false;

  const estimatedMargin = useMemoMargin(watchCostPrice, watchSalesPrice);

  const onSubmit = async (values: ProductFormValues) => {
    setBusy(true);
    try {
      await api.updateProduct(id, values);
      router.push("/invoicing/products");
    } catch (err: any) {
      alert("Failed to save product changes: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="p-8 text-zinc-300">Loading product details...</div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-5xl mx-auto pb-12">
        {/* TOP BAR / HEADER BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Link href="/invoicing/products" className="hover:underline flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Products
              </Link>
              <span>/</span>
              <span className="text-zinc-200">Edit Product</span>
            </div>
            <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Edit Product</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/invoicing/products")}
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

        <div className="grid gap-6">
          {/* SECTION 1: Product Identity */}
          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Product Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6 items-start">
                {/* Drag and Drop Image Layout */}
                <div className="border border-dashed border-zinc-800 bg-zinc-950/20 rounded-lg p-6 text-center hover:bg-zinc-950/40 transition cursor-pointer flex flex-col items-center justify-center min-h-[180px] group">
                  <UploadCloud className="h-10 w-10 text-zinc-455 group-hover:text-indigo-400 transition mb-3" />
                  <p className="text-sm font-semibold text-zinc-300">Drag & Drop Image</p>
                  <p className="text-xs text-zinc-550 mt-1">PNG, JPG up to 5MB</p>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-350">Product Name (English)</Label>
                      <Input
                        {...register("nameEn", { required: "English Name is required" })}
                        placeholder="e.g. Stainless Steel Rebar"
                        className="bg-zinc-950/50 border-zinc-800 text-zinc-100"
                      />
                      {errors.nameEn && <span className="text-xs text-rose-455">{errors.nameEn.message}</span>}
                    </div>
                    <div className="space-y-2 text-right">
                      <Label className="text-zinc-350">اسم المنتج (العربية)</Label>
                      <Input
                        {...register("nameAr", { required: "Arabic Name is required" })}
                        placeholder="مثال: حديد تسليح مقاوم للصدأ"
                        className="bg-zinc-950/50 border-zinc-800 text-zinc-100 text-right dir-rtl"
                      />
                      {errors.nameAr && <span className="text-xs text-rose-455">{errors.nameAr.message}</span>}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-350">SKU (Stock Keeping Unit)</Label>
                      <Input
                        {...register("sku", { required: "SKU code is required" })}
                        placeholder="e.g. STL-REB-12MM"
                        className="bg-zinc-950/50 border-zinc-800 text-zinc-100 font-mono"
                      />
                      {errors.sku && <span className="text-xs text-rose-455">{errors.sku.message}</span>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-350">Barcode / EAN</Label>
                      <Input
                        {...register("barcode")}
                        placeholder="e.g. 6281234567890"
                        className="bg-zinc-950/50 border-zinc-800 text-zinc-100 font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-350">Unit of Measurement</Label>
                      <select
                        {...register("unit")}
                        className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none cursor-pointer"
                      >
                        <option value="Pcs" className="bg-zinc-900">Pcs (Pieces)</option>
                        <option value="Kg" className="bg-zinc-900">Kg (Kilograms)</option>
                        <option value="Tons" className="bg-zinc-900">Tons</option>
                        <option value="Meters" className="bg-zinc-900">Meters</option>
                        <option value="Boxes" className="bg-zinc-900">Boxes</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 2: Financials & Tax Configuration */}
          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Financials & Tax Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-3 gap-6 items-end">
                <div className="space-y-2">
                  <Label className="text-zinc-350 flex items-center gap-1">
                    Cost Price <span className="text-xs text-zinc-500">(SAR)</span>
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-zinc-555" />
                    <Input
                      type="number"
                      step="0.01"
                      {...register("costPrice", { valueAsNumber: true })}
                      className="pl-9 bg-zinc-950/50 border-zinc-800 text-zinc-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-350 flex items-center gap-1">
                    Sales Price <span className="text-xs text-zinc-500">(SAR)</span>
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-zinc-555" />
                    <Input
                      type="number"
                      step="0.01"
                      {...register("salesPrice", { valueAsNumber: true, required: "Sales Price is required" })}
                      className="pl-9 bg-zinc-950/50 border-zinc-800 text-zinc-100"
                    />
                  </div>
                  {errors.salesPrice && <span className="text-xs text-rose-455">{errors.salesPrice.message}</span>}
                </div>

                {/* Estimated Margin indicator */}
                <div className="p-3 border border-zinc-800 bg-zinc-950/40 rounded-lg flex items-center justify-between h-10">
                  <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                    <Percent className="h-3.5 w-3.5" /> Margin (Est.)
                  </span>
                  <span className={`text-sm font-black ${estimatedMargin >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                    {estimatedMargin}%
                  </span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-355">HS Code (Customs Tariff)</Label>
                  <Input
                    {...register("hsCode")}
                    placeholder="e.g. 7214.20.00"
                    className="bg-zinc-950/50 border-zinc-800 text-zinc-100 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-355">ZATCA Tax Category</Label>
                  <select
                    {...register("taxCategory")}
                    className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none cursor-pointer"
                  >
                    <option value="STANDARD" className="bg-zinc-900">Standard Rate (15% Standard VAT)</option>
                    <option value="EXEMPT" className="bg-zinc-900">Exempt (0% VAT - Exempted Goods)</option>
                    <option value="ZERO" className="bg-zinc-900">Zero-Rated (0% VAT - Exported/Special)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 3: Inventory & Logistics Control */}
          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Inventory & Logistics Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-800 bg-zinc-950/20">
                <div className="space-y-0.5">
                  <Label className="text-zinc-200 font-bold text-sm">Track Stock levels for this Item</Label>
                  <p className="text-xs text-zinc-400">Enable real-time inventory ledger audits and alert indicators</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("trackInventory")}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-100 after:border-zinc-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 font-bold"></div>
                </label>
              </div>

              {watchTrackInventory && (
                <div className="grid sm:grid-cols-3 gap-4 p-4 border border-zinc-800 bg-zinc-950/30 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <Label className="text-zinc-350">Opening Stock Quantity</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register("qtyOnHand", { valueAsNumber: true })}
                      className="bg-zinc-950/50 border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-350">Low Stock Alert Level</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register("reorderLevel", { valueAsNumber: true })}
                      className="bg-zinc-950/50 border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-350">Warehouse Bin / Storage Location</Label>
                    <Input
                      {...register("warehouseLocation")}
                      placeholder="e.g. Zone A / Rack 4 / Bin B"
                      className="bg-zinc-950/50 border-zinc-800 text-zinc-100"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </PageShell>
  );
}

function useMemoMargin(cost: number, sales: number) {
  if (!sales || sales <= 0) return 0;
  return Math.round(((sales - cost) / sales) * 100);
}
