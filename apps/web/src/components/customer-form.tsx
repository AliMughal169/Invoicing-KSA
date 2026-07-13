"use client";

import { useEffect, useMemo, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CustomerAddress,
  CustomerDocument,
  CustomerFormValues,
  emptyAddress,
  emptyCustomerForm,
  getCurrencyOptions,
  getLanguageOptions,
  getPhoneCodeOptions,
} from "@/lib/customer";

export type CustomerFormSubmit = (values: CustomerFormValues) => Promise<void> | void;

interface CustomerFormProps {
  initialValues?: Partial<CustomerFormValues>;
  submitLabel: string;
  onSubmit: CustomerFormSubmit;
  onCancel?: () => void;
  busy?: boolean;
  showStickButtons?: boolean;
}

function mergeAddress(initial?: Partial<CustomerAddress>) {
  return {
    ...emptyAddress(),
    ...initial,
  };
}

function mergeForm(initial?: Partial<CustomerFormValues>): CustomerFormValues {
  const base = emptyCustomerForm();
  return {
    ...base,
    ...initial,
    shippingAddress: mergeAddress(initial?.shippingAddress),
    billingAddress: mergeAddress(initial?.billingAddress),
    documents: initial?.documents ?? base.documents,
  };
}

function fieldClassName() {
  return "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
}

function addressInputProps(values: CustomerFormValues, key: keyof CustomerAddress) {
  return values.billingAddress[key] ?? "";
}

export function CustomerForm({ initialValues, submitLabel, onSubmit, onCancel, busy, showStickButtons }: CustomerFormProps) {
  const [values, setValues] = useState<CustomerFormValues>(() => mergeForm(initialValues));
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const currencyOptions = useMemo(() => getCurrencyOptions(), []);
  const phoneCodeOptions = useMemo(() => getPhoneCodeOptions(), []);
  const languageOptions = useMemo(() => getLanguageOptions(), []);

  useEffect(() => {
    setValues(mergeForm(initialValues));
  }, [initialValues]);

  const updateBillingAddress = (key: keyof CustomerAddress, value: string) => {
    setValues((current) => ({
      ...current,
      billingAddress: {
        ...current.billingAddress,
        [key]: value,
      },
    }));
  };

  const updateShippingAddress = (key: keyof CustomerAddress, value: string) => {
    setValues((current) => ({
      ...current,
      shippingAddress: {
        ...current.shippingAddress,
        [key]: value,
      },
    }));
  };

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const res = await api.uploadFile(file);
        return {
          name: file.name,
          url: res.url,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        };
      });
      const uploadedDocs = await Promise.all(uploadPromises);
      setValues((current) => ({
        ...current,
        documents: [...(current.documents || []), ...uploadedDocs],
      }));
    } catch (err: any) {
      alert("Failed to upload document: " + (err.message || err));
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleRemoveFile = (idx: number) => {
    setValues((current) => ({
      ...current,
      documents: current.documents.filter((_, i) => i !== idx),
    }));
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(values);
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Customer profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer type</Label>
              <select
                value={values.customerType}
                onChange={(event) => setValues((current) => ({ ...current, customerType: event.target.value as CustomerFormValues["customerType"] }))}
                className={fieldClassName()}
              >
                <option value="business">Business</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <select
                value={values.currency}
                onChange={(event) => setValues((current) => ({ ...current, currency: event.target.value }))}
                className={fieldClassName()}
              >
                {currencyOptions.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Company name</Label>
              <Input
                value={values.companyName}
                onChange={(event) => setValues((current) => ({ ...current, companyName: event.target.value }))}
                placeholder="Company name or legal entity"
              />
            </div>
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input
                value={values.displayName}
                onChange={(event) => setValues((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="Name shown on invoices and tables"
              />
            </div>
            <div className="space-y-2">
              <Label>VAT number</Label>
              <Input
                value={values.vatNumber}
                onChange={(event) => setValues((current) => ({ ...current, vatNumber: event.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Salutation</Label>
              <select
                value={values.salutation}
                onChange={(event) => setValues((current) => ({ ...current, salutation: event.target.value }))}
                className={fieldClassName()}
              >
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Ms.">Ms.</option>
                <option value="Dr.">Dr.</option>
                <option value="Mx.">Mx.</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>First name</Label>
              <Input
                value={values.firstName}
                onChange={(event) => setValues((current) => ({ ...current, firstName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input
                value={values.lastName}
                onChange={(event) => setValues((current) => ({ ...current, lastName: event.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={values.email}
                onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Customer language</Label>
              <select
                value={values.language}
                onChange={(event) => setValues((current) => ({ ...current, language: event.target.value }))}
                className={fieldClassName()}
              >
                {languageOptions.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Work phone</Label>
              <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                <select
                  value={values.workPhoneCountryCode}
                  onChange={(event) => setValues((current) => ({ ...current, workPhoneCountryCode: event.target.value }))}
                  className={fieldClassName()}
                >
                  {phoneCodeOptions.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={values.workPhone}
                  onChange={(event) => setValues((current) => ({ ...current, workPhone: event.target.value }))}
                  placeholder="Work phone number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Personal phone</Label>
              <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                <select
                  value={values.personalPhoneCountryCode}
                  onChange={(event) => setValues((current) => ({ ...current, personalPhoneCountryCode: event.target.value }))}
                  className={fieldClassName()}
                >
                  {phoneCodeOptions.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={values.personalPhone}
                  onChange={(event) => setValues((current) => ({ ...current, personalPhone: event.target.value }))}
                  placeholder="Personal phone number"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents and remarks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Customer documents</Label>
            <label className="flex cursor-pointer flex-col gap-3 rounded-lg border border-dashed border-input p-4 text-sm text-muted-foreground hover:bg-zinc-55/5">
              <div className="flex items-center gap-2 text-foreground">
                <Upload className="h-4 w-4" />
                {uploadingFiles ? "Uploading documents..." : "Upload documents"}
              </div>
              <span>Attach contracts, IDs, VAT certificates, or other supporting files.</span>
              <input
                type="file"
                multiple
                className="hidden"
                disabled={uploadingFiles}
                onChange={(event) => handleFileChange(event.target.files)}
              />
            </label>
            {values.documents.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
                {values.documents.map((document, idx) => (
                  <div key={`${document.name}-${idx}`} className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground truncate max-w-[250px]">{document.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{document.size ? `${Math.round(document.size / 1024)} KB` : "Attached"}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFile(idx)}
                        className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Remarks</Label>
            <textarea
              value={values.remarks}
              onChange={(event) => setValues((current) => ({ ...current, remarks: event.target.value }))}
              rows={5}
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Special payment terms, service notes, or reminders."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="billing" className="space-y-4">
            <TabsList>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="shipping">Shipping</TabsTrigger>
            </TabsList>
            <TabsContent value="billing" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Street address</Label>
                  <Input
                    value={addressInputProps(values, "line1")}
                    onChange={(event) => updateBillingAddress("line1", event.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address line 2</Label>
                  <Input
                    value={addressInputProps(values, "line2")}
                    onChange={(event) => updateBillingAddress("line2", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={addressInputProps(values, "city")}
                    onChange={(event) => updateBillingAddress("city", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State / Province</Label>
                  <Input
                    value={addressInputProps(values, "state")}
                    onChange={(event) => updateBillingAddress("state", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={addressInputProps(values, "country")}
                    onChange={(event) => updateBillingAddress("country", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postal code</Label>
                  <Input
                    value={addressInputProps(values, "postalCode")}
                    onChange={(event) => updateBillingAddress("postalCode", event.target.value)}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="shipping" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Street address</Label>
                  <Input
                    value={values.shippingAddress.line1}
                    onChange={(event) => updateShippingAddress("line1", event.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address line 2</Label>
                  <Input
                    value={values.shippingAddress.line2}
                    onChange={(event) => updateShippingAddress("line2", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={values.shippingAddress.city}
                    onChange={(event) => updateShippingAddress("city", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State / Province</Label>
                  <Input
                    value={values.shippingAddress.state}
                    onChange={(event) => updateShippingAddress("state", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={values.shippingAddress.country}
                    onChange={(event) => updateShippingAddress("country", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postal code</Label>
                  <Input
                    value={values.shippingAddress.postalCode}
                    onChange={(event) => updateShippingAddress("postalCode", event.target.value)}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className={showStickButtons ? "h-20" : ""}>
        {/* Padding for sticky buttons */}
      </div>

      {showStickButtons ? (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6 md:p-10">
          <div className="max-w-[1400px] mx-auto flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
             <Button type="submit" disabled={busy || uploadingFiles}>
              {busy ? "Saving..." : (uploadingFiles ? "Uploading..." : submitLabel)}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy || uploadingFiles}>
            {busy ? "Saving..." : (uploadingFiles ? "Uploading..." : submitLabel)}
          </Button>
        </div>
      )}
    </form>
  );
}
