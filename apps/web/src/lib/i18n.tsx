"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type Locale = "en" | "ar";

type Dict = Record<string, string>;
const en: Dict = {
  workspace: "Workspace", dashboard: "Dashboard", contacts: "Contacts",
  pipeline: "Pipeline", invoices: "Invoices", quotations: "Quotations", customers: "Customers",
  products: "Products", accounting: "Accounting", logout: "Logout",
  newInvoice: "New invoice", recentInvoices: "Recent invoices", newQuotation: "New quotation",
  revenue: "Revenue", outstanding: "Outstanding", pipelineValue: "Pipeline value",
  vatDue: "VAT due", outputVatYtd: "Output VAT (YTD)", invoicesIssued: "Invoices issued",
  openOpportunities: "Open opportunities", aiAssistant: "AI assistant",
  askAnything: "Ask anything about your workspace…", send: "Send",
  language: "Language", english: "English", arabic: "العربية",
  status: "Status", number: "Number", customer: "Customer", date: "Date",
  total: "Total", actions: "Actions", create: "Create", cancel: "Cancel",
  issue: "Issue", markPaid: "Mark paid", viewPdf: "View PDF",
  settings: "Settings", companyProfile: "Company Profile", printSettings: "Print & Layout", customFields: "Custom Fields",
};
const ar: Dict = {
  workspace: "مساحة العمل", dashboard: "لوحة التحكم", contacts: "جهات الاتصال",
  pipeline: "خط الفرص", invoices: "الفواتير", quotations: "عروض الأسعار", customers: "العملاء",
  products: "المنتجات", accounting: "المحاسبة", logout: "تسجيل الخروج",
  newInvoice: "فاتورة جديدة", recentInvoices: "الفواتير الأخيرة", newQuotation: "عرض سعر جديد",
  revenue: "الإيرادات", outstanding: "المستحق", pipelineValue: "قيمة الفرص",
  vatDue: "ضريبة القيمة المضافة", outputVatYtd: "ضريبة المخرجات (السنة)", invoicesIssued: "فواتير مُصدرة",
  openOpportunities: "فرص مفتوحة", aiAssistant: "المساعد الذكي",
  askAnything: "اسأل أي شيء عن مساحة عملك…", send: "إرسال",
  language: "اللغة", english: "English", arabic: "العربية",
  status: "الحالة", number: "الرقم", customer: "العميل", date: "التاريخ",
  total: "الإجمالي", actions: "إجراءات", create: "إنشاء", cancel: "إلغاء",
  issue: "إصدار", markPaid: "تم الدفع", viewPdf: "عرض PDF",
  settings: "الإعدادات", companyProfile: "ملف الشركة", printSettings: "الطباعة والتصميم", customFields: "الحقول المخصصة",
};

const DICT: Record<Locale, Dict> = { en, ar };

interface I18nCtx { locale: Locale; t: (k: string) => string; setLocale: (l: Locale) => void; }
const Ctx = createContext<I18nCtx>({ locale: "en", t: (k) => k, setLocale: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  useEffect(() => {
    const saved = (typeof window !== "undefined" ? localStorage.getItem("erp.locale") : null) as Locale | null;
    if (saved === "ar" || saved === "en") setLocaleState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
  }, [locale]);
  function setLocale(l: Locale) {
    setLocaleState(l);
    if (typeof window !== "undefined") localStorage.setItem("erp.locale", l);
  }
  const t = (k: string) => DICT[locale][k] ?? k;
  return <Ctx.Provider value={{ locale, t, setLocale }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
