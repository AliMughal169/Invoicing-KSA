import { Country } from "country-state-city";

export type CustomerAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
};

export type CustomerDocument = {
  name: string;
  size?: number;
  type?: string;
  lastModified?: number;
};

export type CustomerFormValues = {
  customerType: "business" | "individual";
  salutation: string;
  firstName: string;
  lastName: string;
  companyName: string;
  displayName: string;
  currency: string;
  email: string;
  workPhoneCountryCode: string;
  workPhone: string;
  personalPhoneCountryCode: string;
  personalPhone: string;
  language: string;
  vatNumber: string;
  remarks: string;
  documents: CustomerDocument[];
  shippingAddress: CustomerAddress;
  billingAddress: CustomerAddress;
};

export function emptyAddress(): CustomerAddress {
  return {
    line1: "",
    line2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
  };
}

export function emptyCustomerForm(): CustomerFormValues {
  return {
    customerType: "business",
    salutation: "Mr.",
    firstName: "",
    lastName: "",
    companyName: "",
    displayName: "",
    currency: "SAR",
    email: "",
    workPhoneCountryCode: defaultPhoneCode(),
    workPhone: "",
    personalPhoneCountryCode: defaultPhoneCode(),
    personalPhone: "",
    language: "English",
    vatNumber: "",
    remarks: "",
    documents: [],
    shippingAddress: emptyAddress(),
    billingAddress: emptyAddress(),
  };
}

export function buildCustomerDisplayName(customer: any) {
  const displayName = customer?.display_name ?? customer?.displayName ?? customer?.name ?? customer?.company_name ?? customer?.companyName;
  if (displayName) return displayName;
  const parts = [customer?.salutation, customer?.first_name, customer?.last_name].filter(Boolean);
  return parts.join(" ") || "—";
}

export function buildCustomerContactName(customer: any) {
  const parts = [customer?.salutation, customer?.first_name, customer?.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return customer?.contact_person_name ?? customer?.contactPersonName ?? "—";
}

export function formatCustomerAddress(address: unknown, fallbackCity?: string, fallbackCountry?: string) {
  const normalized = typeof address === "string" ? safeParseJson(address) ?? { line1: address } : address as Partial<CustomerAddress> | null | undefined;
  const parts = [
    normalized?.line1,
    normalized?.line2,
    [normalized?.city ?? fallbackCity, normalized?.state].filter(Boolean).join(", "),
    normalized?.country ?? fallbackCountry,
    normalized?.postalCode,
  ].filter(Boolean);
  return parts.length ? parts.join(" • ") : "—";
}

export function customerLocationLabel(customer: any) {
  const billing = safeParseJson(customer?.billing_address_json ?? customer?.billing_address);
  const city = billing?.city ?? customer?.city;
  const country = billing?.country ?? customer?.country;
  const label = [city, country].filter(Boolean).join(", ");
  return label || "—";
}

export function customerPhoneLabel(customer: any) {
  const code = customer?.work_phone_country_code ?? customer?.company_phone_country_code;
  const phone = customer?.work_phone ?? customer?.company_phone;
  if (!phone) return "—";
  return `${code ? `+${code} ` : ""}${phone}`.trim();
}

export function parseCustomerDocuments(value: unknown): CustomerDocument[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as CustomerDocument[];
  if (typeof value === "string") {
    const parsed = safeParseJson(value);
    return Array.isArray(parsed) ? parsed as CustomerDocument[] : [];
  }
  return [];
}

export function getCurrencyOptions() {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  const supported = typeof intl.supportedValuesOf === "function"
    ? intl.supportedValuesOf("currency")
    : ["SAR", "USD", "EUR", "GBP", "AED"];
  return Array.from(new Set(supported)).map((code) => ({
    code,
    label: code,
  }));
}

export function getLanguageOptions() {
  return [
    "English",
    "Arabic",
    "Urdu",
    "Hindi",
    "French",
    "Spanish",
    "Turkish",
  ];
}

export function getPhoneCodeOptions() {
  const seen = new Set<string>();
  return Country.getAllCountries()
    .map((country) => ({
      code: country.phonecode,
      label: `${country.name} (+${country.phonecode})`,
    }))
    .filter((item) => {
      if (!item.code) return false;
      const key = String(item.code);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.code) - Number(b.code));
}

export function defaultPhoneCode() {
  return getPhoneCodeOptions().find((item) => item.code === "966")?.code ?? getPhoneCodeOptions()[0]?.code ?? "966";
}

export function customerFormToApi(values: CustomerFormValues) {
  const primaryContact = [values.salutation, values.firstName, values.lastName].filter(Boolean).join(" ").trim();
  const displayName = values.displayName || values.companyName || primaryContact || "Customer";
  return {
    name: displayName,
    companyName: values.companyName || undefined,
    customerType: values.customerType,
    salutation: values.salutation || undefined,
    firstName: values.firstName || undefined,
    lastName: values.lastName || undefined,
    displayName: values.displayName || undefined,
    currency: values.currency,
    email: values.email || undefined,
    vatNumber: values.vatNumber || undefined,
    contactPersonName: primaryContact || undefined,
    companyPhone: values.workPhone || undefined,
    contactPersonPhone: values.personalPhone || undefined,
    contactPersonPhoneSameAsCompany: false,
    workPhoneCountryCode: values.workPhoneCountryCode || undefined,
    personalPhoneCountryCode: values.personalPhoneCountryCode || undefined,
    workPhone: values.workPhone || undefined,
    personalPhone: values.personalPhone || undefined,
    language: values.language || undefined,
    documents: values.documents.length ? values.documents : undefined,
    remarks: values.remarks || undefined,
    shippingAddress: values.shippingAddress,
    billingAddress: values.billingAddress,
    address: values.billingAddress.line1 || undefined,
    state: values.billingAddress.state || undefined,
    city: values.billingAddress.city || undefined,
    country: values.billingAddress.country || undefined,
  };
}

export function customerRecordToFormValues(customer: any): CustomerFormValues {
  const billing = safeParseJson<Partial<CustomerAddress>>(customer?.billing_address_json) ?? {
    line1: customer?.address ?? "",
    line2: "",
    city: customer?.city ?? "",
    state: customer?.state ?? "",
    country: customer?.country ?? "",
    postalCode: "",
  };
  const shipping = safeParseJson<Partial<CustomerAddress>>(customer?.shipping_address_json) ?? emptyAddress();

  return {
    customerType: customer?.customer_type ?? "business",
    salutation: customer?.salutation ?? "Mr.",
    firstName: customer?.first_name ?? "",
    lastName: customer?.last_name ?? "",
    companyName: customer?.company_name ?? "",
    displayName: customer?.display_name ?? customer?.name ?? "",
    currency: customer?.currency ?? "SAR",
    email: customer?.email ?? "",
    workPhoneCountryCode: customer?.work_phone_country_code ?? defaultPhoneCode(),
    workPhone: customer?.work_phone ?? customer?.company_phone ?? "",
    personalPhoneCountryCode: customer?.personal_phone_country_code ?? defaultPhoneCode(),
    personalPhone: customer?.personal_phone ?? customer?.contact_person_phone ?? "",
    language: customer?.language ?? "English",
    vatNumber: customer?.vat_number ?? "",
    remarks: customer?.remarks ?? "",
    documents: parseCustomerDocuments(customer?.documents_json),
    shippingAddress: { ...emptyAddress(), ...shipping },
    billingAddress: { ...emptyAddress(), ...billing },
  };
}

export function safeParseJson<T = any>(value: unknown): T | null {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
