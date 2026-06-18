"use client";

import { useEffect, useMemo, useState } from "react";
import { Country, State, City } from "country-state-city";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";

type CustomerForm = {
  name: string;
  email: string;
  vatNumber: string;
  contactPersonName: string;
  companyPhone: string;
  contactPersonPhone: string;
  contactPersonPhoneSameAsCompany: boolean;
  address: string;
  state: string;
  city: string;
  country: string;
};

const EMPTY_FORM: CustomerForm = {
  name: "",
  email: "",
  vatNumber: "",
  contactPersonName: "",
  companyPhone: "",
  contactPersonPhone: "",
  contactPersonPhoneSameAsCompany: true,
  address: "",
  state: "",
  city: "",
  country: "",
};

export default function CustomersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [stateCode, setStateCode] = useState("");

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(() => (countryCode ? State.getStatesOfCountry(countryCode) : []), [countryCode]);
  const cities = useMemo(() => (countryCode && stateCode ? City.getCitiesOfState(countryCode, stateCode) : []), [countryCode, stateCode]);

  async function reload() {
    setRows(await api.listCustomers());
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (form.contactPersonPhoneSameAsCompany) {
      setForm((prev) => ({ ...prev, contactPersonPhone: prev.companyPhone }));
    }
  }, [form.companyPhone, form.contactPersonPhoneSameAsCompany]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.createCustomer(form);
    setForm(EMPTY_FORM);
    setCountryCode("");
    setStateCode("");
    setOpen(false);
    reload();
  }

  function handleCountryChange(code: string) {
    setCountryCode(code);
    setStateCode("");
    const country = countries.find((item) => item.isoCode === code);
    setForm((prev) => ({ ...prev, country: country?.name ?? "", state: "", city: "" }));
  }

  function handleStateChange(code: string) {
    setStateCode(code);
    const state = states.find((item) => item.isoCode === code);
    setForm((prev) => ({ ...prev, state: state?.name ?? "", city: "" }));
  }

  function handleCityChange(cityName: string) {
    setForm((prev) => ({ ...prev, city: cityName }));
  }

  function handleCompanyPhoneChange(value: string) {
    setForm((prev) => ({
      ...prev,
      companyPhone: value,
      contactPersonPhone: prev.contactPersonPhoneSameAsCompany ? value : prev.contactPersonPhone,
    }));
  }

  const locationLabel = (row: any) => [row.city, row.country].filter(Boolean).join(", ") || "—";

  return (
    <PageShell>
      <PageHeader
        title="Customers"
        description="Billing customers with contact and location details"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4" /> New customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New customer</DialogTitle>
              </DialogHeader>
              <form onSubmit={create} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="name">Company name</Label>
                    <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPersonName">Contact person name</Label>
                    <Input
                      id="contactPersonName"
                      value={form.contactPersonName}
                      onChange={(e) => setForm({ ...form, contactPersonName: e.target.value })}
                      placeholder="e.g. Ahmed Ali"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Company phone</Label>
                    <Input
                      id="companyPhone"
                      value={form.companyPhone}
                      onChange={(e) => handleCompanyPhoneChange(e.target.value)}
                      placeholder="e.g. +966 50 000 0000"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2 rounded-lg border px-3 py-2">
                    <input
                      id="samePhone"
                      type="checkbox"
                      checked={form.contactPersonPhoneSameAsCompany}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          contactPersonPhoneSameAsCompany: e.target.checked,
                          contactPersonPhone: e.target.checked ? prev.companyPhone : prev.contactPersonPhone,
                        }))
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="samePhone" className="text-sm font-normal">
                      Contact person phone is the same as company number
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPersonPhone">Contact person phone</Label>
                    <Input
                      id="contactPersonPhone"
                      value={form.contactPersonPhone}
                      onChange={(e) => setForm({ ...form, contactPersonPhone: e.target.value })}
                      disabled={form.contactPersonPhoneSameAsCompany}
                      placeholder="e.g. +966 55 000 0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">VAT number</Label>
                    <Input id="vatNumber" value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <select
                      value={countryCode}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select country</option>
                      {countries.map((country) => (
                        <option key={country.isoCode} value={country.isoCode}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <select
                      value={stateCode}
                      onChange={(e) => handleStateChange(e.target.value)}
                      disabled={!countryCode}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">{countryCode ? "Select state" : "Select country first"}</option>
                      {states.map((state) => (
                        <option key={state.isoCode} value={state.isoCode}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>City</Label>
                    <select
                      value={form.city}
                      onChange={(e) => handleCityChange(e.target.value)}
                      disabled={!countryCode || !stateCode}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">{stateCode ? "Select city" : "Select state first"}</option>
                      {cities.map((city) => (
                        <option key={city.name} value={city.name}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact person</TableHead>
                  <TableHead>Contact number</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>VAT #</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No customers yet
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.contact_person_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.company_phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{locationLabel(c)}</TableCell>
                    <TableCell className="text-muted-foreground">{c.vat_number ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 p-4 lg:hidden">
            {rows.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">No customers yet</p>
            ) : (
              rows.map((c) => (
                <div key={c.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="space-y-2">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.contact_person_name ?? "—"}</p>
                    <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                      <p><span className="font-medium text-foreground">Contact:</span> {c.company_phone ?? "—"}</p>
                      <p><span className="font-medium text-foreground">Location:</span> {locationLabel(c)}</p>
                      <p><span className="font-medium text-foreground">VAT:</span> {c.vat_number ?? "—"}</p>
                      <p><span className="font-medium text-foreground">Added:</span> {formatDate(c.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}