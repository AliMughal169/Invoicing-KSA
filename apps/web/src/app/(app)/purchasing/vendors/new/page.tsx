"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, X, Languages } from "lucide-react";
import { useForm } from "react-hook-form";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";

interface VendorFormValues {
  nameEn: string;
  nameAr: string;
  vatNumber: string;
  crNumber: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
}

export default function NewVendorPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [translating, setTranslating] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<VendorFormValues>({
    defaultValues: {
      nameEn: "",
      nameAr: "",
      vatNumber: "",
      crNumber: "",
      email: "",
      phone: "",
      address: "",
      paymentTerms: "Net 30",
    },
  });

  const watchNameEn = watch("nameEn");

  const handleTranslateName = async () => {
    if (!watchNameEn) return;
    setTranslating(true);
    try {
      const res = await api.translate(watchNameEn);
      if (res?.translatedText) {
        setValue("nameAr", res.translatedText);
      }
    } catch (err) {
      console.error("Auto-translation error:", err);
    } finally {
      setTranslating(false);
    }
  };

  const onSubmit = async (values: VendorFormValues) => {
    setBusy(true);
    try {
      await api.createVendor(values);
      router.push("/purchasing/vendors");
    } catch (err: any) {
      alert("Failed to save vendor details: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl mx-auto pb-12">
        {/* TOP BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Link href="/purchasing/vendors" className="hover:underline flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Vendors
              </Link>
              <span>/</span>
              <span className="text-zinc-200">New Vendor</span>
            </div>
            <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Register New Vendor</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/purchasing/vendors")}
              className="border-zinc-800 text-zinc-200 hover:bg-zinc-800"
            >
              <X className="h-4 w-4 mr-2" /> Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-indigo-600 hover:bg-indigo-700 text-zinc-100"
            >
              <Save className="h-4 w-4 mr-2" /> {busy ? "Registering..." : "Save Vendor"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Card 1: Vendor Profile & Localization */}
          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Vendor Identity & Translation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-350">Vendor Name (English)</Label>
                  <div className="relative">
                    <Input
                      {...register("nameEn", { required: "English Name is required" })}
                      onBlur={handleTranslateName}
                      placeholder="e.g. Ali Mughal Trading Est."
                      className="bg-zinc-950/50 border-zinc-800 text-zinc-100 pr-10"
                    />
                    {translating && (
                      <div className="absolute right-3 top-3 h-4 w-4 animate-spin text-zinc-400">
                        <Languages className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  {errors.nameEn && <span className="text-xs text-rose-455">{errors.nameEn.message}</span>}
                </div>
                <div className="space-y-2 text-right">
                  <Label className="text-zinc-350">اسم المورد (العربية)</Label>
                  <Input
                    {...register("nameAr", { required: "Arabic Name is required" })}
                    placeholder="مثال: مؤسسة علي مغال التجارية"
                    className="bg-zinc-950/50 border-zinc-800 text-zinc-100 text-right dir-rtl"
                  />
                  {errors.nameAr && <span className="text-xs text-rose-455">{errors.nameAr.message}</span>}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-350">15-Digit VAT Registration Number</Label>
                  <Input
                    {...register("vatNumber", {
                      required: "VAT Number is required",
                      pattern: {
                        value: /^3[0-9]{14}$/,
                        message: "KSA VAT Number must start with 3 and be exactly 15 digits"
                      }
                    })}
                    placeholder="e.g. 312345678901234"
                    className="bg-zinc-950/50 border-zinc-800 text-zinc-100 font-mono"
                  />
                  {errors.vatNumber && <span className="text-xs text-rose-455">{errors.vatNumber.message}</span>}
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-355">CR Number (Commercial Registration)</Label>
                  <Input
                    {...register("crNumber")}
                    placeholder="e.g. 1010123456"
                    className="bg-zinc-950/50 border-zinc-800 text-zinc-100 font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Contact & Billing Configuration */}
          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Contact & Terms Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-350">Email Address</Label>
                  <Input
                    type="email"
                    {...register("email")}
                    placeholder="billing@supplier.com"
                    className="bg-zinc-950/50 border-zinc-800 text-zinc-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-355">Phone Number</Label>
                  <Input
                    {...register("phone")}
                    placeholder="+966 50 123 4567"
                    className="bg-zinc-950/50 border-zinc-800 text-zinc-100 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-355">Payment Terms / Net Tiers</Label>
                  <select
                    {...register("paymentTerms")}
                    className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none cursor-pointer"
                  >
                    <option value="Due on Receipt" className="bg-zinc-900">Due on Receipt</option>
                    <option value="Net 15" className="bg-zinc-900">Net 15 Days</option>
                    <option value="Net 30" className="bg-zinc-900">Net 30 Days</option>
                    <option value="Net 45" className="bg-zinc-900">Net 45 Days</option>
                    <option value="Net 60" className="bg-zinc-900">Net 60 Days</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-350">Billing Address / Physical HQ</Label>
                <Input
                  {...register("address")}
                  placeholder="e.g. Olaya District, King Fahd Road, Riyadh, Saudi Arabia"
                  className="bg-zinc-950/50 border-zinc-800 text-zinc-100"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </PageShell>
  );
}
