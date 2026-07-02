"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, ShieldAlert, Upload, Image as ImageIcon, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page-shell";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [settings, setSettings] = useState<any>({
    company_name_en: "",
    company_name_ar: "",
    cr_number: "",
    vat_number: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    company_logo_url: "",
    letterhead_url: "",
  });

  const [cfDefinitions, setCfDefinitions] = useState<any[]>([]);
  const [newCf, setNewCf] = useState({
    entityType: "invoice",
    fieldKey: "",
    fieldLabel: "",
    fieldType: "text",
    isRequired: false,
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  async function reloadSettings() {
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err: any) {
      console.error("Failed to load settings:", err);
    }
  }

  async function reloadCustomFields() {
    try {
      const fields = await api.listCustomFields();
      setCfDefinitions(fields);
    } catch (err: any) {
      console.error("Failed to load custom fields:", err);
    }
  }

  useEffect(() => {
    reloadSettings();
    reloadCustomFields();
  }, []);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.updateSettings({
        companyNameEn: settings.company_name_en,
        companyNameAr: settings.company_name_ar,
        crNumber: settings.cr_number,
        vatNumber: settings.vat_number,
        addressLine1: settings.address_line1,
        addressLine2: settings.address_line2,
        city: settings.city,
        state: settings.state,
        country: settings.country,
        postalCode: settings.postal_code,
      });
      setMessage({ text: "Company profile updated successfully!", type: "success" });
      reloadSettings();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to update profile", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, fieldName: "company_logo_url" | "letterhead_url") {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage(null);
    try {
      const res = await api.uploadFile(file);
      const updated = {
        [fieldName === "company_logo_url" ? "companyLogoUrl" : "letterheadUrl"]: res.url,
      };
      await api.updateSettings(updated);
      setMessage({ text: `${fieldName === "company_logo_url" ? "Logo" : "Letterhead"} uploaded successfully!`, type: "success" });
      reloadSettings();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to upload image", type: "error" });
    }
  }

  async function handleCfSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newCf.fieldKey || !newCf.fieldLabel) return;
    setMessage(null);
    try {
      await api.createCustomField(newCf);
      setMessage({ text: "Custom field definition created successfully!", type: "success" });
      setNewCf({
        entityType: "invoice",
        fieldKey: "",
        fieldLabel: "",
        fieldType: "text",
        isRequired: false,
      });
      reloadCustomFields();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to create custom field", type: "error" });
    }
  }

  async function handleCfDelete(id: string) {
    if (confirm("Are you sure you want to delete this custom field? This will stop it from displaying on new forms.")) {
      setMessage(null);
      try {
        await api.deleteCustomField(id);
        setMessage({ text: "Custom field deleted successfully!", type: "success" });
        reloadCustomFields();
      } catch (err: any) {
        setMessage({ text: err.message || "Failed to delete custom field", type: "error" });
      }
    }
  }

  return (
    <PageShell>
      <PageHeader title="Settings" description="Manage company profile, print templates, and dynamic custom fields" />

      {message && (
        <div className={`p-4 rounded-md mb-6 flex items-center gap-3 border ${message.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {message.type === "success" ? <CheckCircle className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="profile">Company Profile</TabsTrigger>
          <TabsTrigger value="print">Print & Layout</TabsTrigger>
          <TabsTrigger value="fields">Custom Fields</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Company Profile</CardTitle>
              <CardDescription>Configure business details used for ZATCA-compliant invoicing headers and XML files.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name (English)</Label>
                    <Input 
                      value={settings.company_name_en || ""} 
                      onChange={(e) => setSettings({ ...settings, company_name_en: e.target.value })} 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name (Arabic)</Label>
                    <Input 
                      value={settings.company_name_ar || ""} 
                      onChange={(e) => setSettings({ ...settings, company_name_ar: e.target.value })} 
                      required
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CR Number (Commercial Registration)</Label>
                    <Input 
                      value={settings.cr_number || ""} 
                      onChange={(e) => setSettings({ ...settings, cr_number: e.target.value })} 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>VAT Registration Number</Label>
                    <Input 
                      value={settings.vat_number || ""} 
                      onChange={(e) => setSettings({ ...settings, vat_number: e.target.value })} 
                      required
                      pattern="\d{15}"
                      title="ZATCA requires a 15-digit VAT number starting and ending with 3"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Registered Address (ZATCA compliant)</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Street Name</Label>
                        <Input 
                          value={settings.address_line1 || ""} 
                          onChange={(e) => setSettings({ ...settings, address_line1: e.target.value })} 
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Building / Additional No</Label>
                        <Input 
                          value={settings.address_line2 || ""} 
                          onChange={(e) => setSettings({ ...settings, address_line2: e.target.value })} 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input 
                          value={settings.city || ""} 
                          onChange={(e) => setSettings({ ...settings, city: e.target.value })} 
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State / Region</Label>
                        <Input 
                          value={settings.state || ""} 
                          onChange={(e) => setSettings({ ...settings, state: e.target.value })} 
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Input 
                          value={settings.country || ""} 
                          onChange={(e) => setSettings({ ...settings, country: e.target.value })} 
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Postal Code</Label>
                        <Input 
                          value={settings.postal_code || ""} 
                          onChange={(e) => setSettings({ ...settings, postal_code: e.target.value })} 
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="print">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Logo</CardTitle>
                <CardDescription>Appears in print headers and PDF views.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20">
                  {settings.company_logo_url ? (
                    <img 
                      src={settings.company_logo_url} 
                      alt="Logo preview" 
                      className="max-h-24 object-contain mb-4 rounded border p-2 bg-white" 
                    />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                  )}
                  <Label className="cursor-pointer">
                    <div className="flex items-center gap-2 bg-secondary text-foreground hover:bg-secondary/80 px-4 py-2 rounded-md font-medium text-sm transition-colors">
                      <Upload className="h-4 w-4" /> Upload logo
                    </div>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg" 
                      onChange={(e) => handleFileUpload(e, "company_logo_url")} 
                      className="hidden" 
                    />
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Letterhead & Print Layout</CardTitle>
                <CardDescription>Upload A4 background watermark and adjust default print margins and toggles.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20">
                  {settings.letterhead_url ? (
                    <div className="text-center mb-4">
                      <div className="text-xs text-muted-foreground mb-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-1 px-3 rounded inline-block font-medium">Active background set</div>
                      <img 
                        src={settings.letterhead_url} 
                        alt="Letterhead preview" 
                        className="max-h-32 border object-contain bg-white rounded shadow-sm mb-3 mx-auto" 
                      />
                      <div>
                        <Button 
                          type="button" 
                          variant="destructive" 
                          size="sm" 
                          onClick={async () => {
                            if (confirm("Are you sure you want to delete the letterhead watermark image? This will reset all margins to 0.")) {
                              await api.deleteLetterhead();
                              reloadSettings();
                              setMessage({ text: "Letterhead deleted and print margins reset.", type: "success" });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete Letterhead
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                  )}
                  <Label className="cursor-pointer">
                    <div className="flex items-center gap-2 bg-secondary text-foreground hover:bg-secondary/80 px-4 py-2 rounded-md font-medium text-sm transition-colors">
                      <Upload className="h-4 w-4" /> Upload letterhead
                    </div>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg" 
                      onChange={(e) => handleFileUpload(e, "letterhead_url")} 
                      className="hidden" 
                    />
                  </Label>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Print Layout Tuning</h4>
                  
                  <div className="flex items-center gap-2">
                    <input 
                      id="print-on-lh"
                      type="checkbox"
                      checked={!!settings.print_on_letterhead}
                      onChange={(e) => setSettings({ ...settings, print_on_letterhead: e.target.checked })}
                      className="h-4 w-4 rounded border border-input"
                    />
                    <Label htmlFor="print-on-lh" className="cursor-pointer text-sm">Print on Letterhead by Default</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Top Margin (mm)</Label>
                      <Input 
                        type="number"
                        min={0}
                        max={100}
                        value={settings.top_margin ?? 0}
                        onChange={(e) => setSettings({ ...settings, top_margin: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bottom Margin (mm)</Label>
                      <Input 
                        type="number"
                        min={0}
                        max={100}
                        value={settings.bottom_margin ?? 0}
                        onChange={(e) => setSettings({ ...settings, bottom_margin: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <Button 
                    type="button" 
                    className="w-full"
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await api.updateSettings({
                          printOnLetterhead: !!settings.print_on_letterhead,
                          topMargin: Number(settings.top_margin),
                          bottomMargin: Number(settings.bottom_margin),
                        });
                        setMessage({ text: "Print layout settings updated successfully!", type: "success" });
                        reloadSettings();
                      } catch (err: any) {
                        setMessage({ text: err.message || "Failed to update layout settings", type: "error" });
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                  >
                    Save Layout Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fields">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Create Custom Field</CardTitle>
                <CardDescription>Define field properties to dynamically render inside Customer, Invoice, or Quotation forms.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCfSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Entity Type</Label>
                    <select
                      value={newCf.entityType}
                      onChange={(e) => setNewCf({ ...newCf, entityType: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      required
                    >
                      <option value="customer">Customer</option>
                      <option value="invoice">Invoice</option>
                      <option value="quotation">Quotation</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Field Key (alphanumeric & underscores)</Label>
                    <Input 
                      placeholder="e.g. gross_weight"
                      value={newCf.fieldKey}
                      onChange={(e) => setNewCf({ ...newCf, fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Field Label</Label>
                    <Input 
                      placeholder="e.g. Gross Weight (kg)"
                      value={newCf.fieldLabel}
                      onChange={(e) => setNewCf({ ...newCf, fieldLabel: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Field Input Type</Label>
                    <select
                      value={newCf.fieldType}
                      onChange={(e) => setNewCf({ ...newCf, fieldType: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      required
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Checkbox (Yes/No)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input 
                      id="required-cf"
                      type="checkbox"
                      checked={newCf.isRequired}
                      onChange={(e) => setNewCf({ ...newCf, isRequired: e.target.checked })}
                      className="h-4 w-4 rounded border border-input"
                    />
                    <Label htmlFor="required-cf" className="cursor-pointer text-sm">Required field</Label>
                  </div>

                  <Button type="submit" className="w-full mt-4">
                    <Plus className="h-4 w-4" /> Add Custom Field
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Active Custom Fields</CardTitle>
                <CardDescription>Custom fields currently displaying on document creation workflows.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Field Key</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cfDefinitions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">No custom fields defined yet</TableCell>
                      </TableRow>
                    )}
                    {cfDefinitions.map((cf) => (
                      <TableRow key={cf.id}>
                        <TableCell className="capitalize font-medium">{cf.entity_type}</TableCell>
                        <TableCell>{cf.field_label}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{cf.field_key}</TableCell>
                        <TableCell className="capitalize">{cf.field_type}</TableCell>
                        <TableCell>{cf.is_required ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => handleCfDelete(cf.id)} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
