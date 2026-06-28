import type { AuthResponse } from "@erp/shared-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function request<T>(
  path: string,
  init?: RequestInit & { token?: string | null; auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  const token = init?.token ?? (init?.auth !== false ? getToken() : null);
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data as T;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("erp.token");
}

export const api = {
  // Auth
  signup: (body: { email: string; password: string; name: string; companyName: string }) =>
    request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(body), auth: false }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body), auth: false }),
  me: (token?: string) => request<{ user: any; tenant: any }>("/auth/me", { token }),

  // Stats
  statsOverview: () => request<any>("/stats/overview"),

  // CRM
  listContacts: () => request<any[]>("/crm/contacts"),
  createContact: (b: { name: string; email?: string; phone?: string; companyId?: string }) =>
    request<any>("/crm/contacts", { method: "POST", body: JSON.stringify(b) }),
  deleteContact: (id: string) =>
    request<any>(`/crm/contacts/${id}`, { method: "DELETE" }),
  listOpportunities: () => request<any[]>("/crm/opportunities"),
  createOpportunity: (b: { name: string; amount: number; stage?: string; contactId?: string }) =>
    request<any>("/crm/opportunities", { method: "POST", body: JSON.stringify(b) }),
  updateOppStage: (id: string, stage: string) =>
    request<any>(`/crm/opportunities/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }),

  // Invoicing
  listCustomers: () => request<any[]>("/invoicing/customers"),
  getCustomer: (id: string) => request<any>(`/invoicing/customers/${id}`),
  createCustomer: (b: {
    name: string;
    companyName?: string;
    customerType?: string;
    salutation?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    currency?: string;
    email?: string;
    vatNumber?: string;
    contactPersonName?: string;
    companyPhone?: string;
    contactPersonPhone?: string;
    contactPersonPhoneSameAsCompany?: boolean;
    workPhoneCountryCode?: string;
    personalPhoneCountryCode?: string;
    workPhone?: string;
    personalPhone?: string;
    language?: string;
    documents?: { name: string; size?: number; type?: string; lastModified?: number }[];
    remarks?: string;
    shippingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    billingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    address?: string;
    state?: string;
    city?: string;
    country?: string;
  }) =>
    request<any>("/invoicing/customers", { method: "POST", body: JSON.stringify(b) }),
  updateCustomer: (id: string, b: {
    name?: string;
    companyName?: string;
    customerType?: string;
    salutation?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    currency?: string;
    email?: string;
    vatNumber?: string;
    contactPersonName?: string;
    companyPhone?: string;
    contactPersonPhone?: string;
    contactPersonPhoneSameAsCompany?: boolean;
    workPhoneCountryCode?: string;
    personalPhoneCountryCode?: string;
    workPhone?: string;
    personalPhone?: string;
    language?: string;
    documents?: { name: string; size?: number; type?: string; lastModified?: number }[];
    remarks?: string;
    shippingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    billingAddress?: { line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string };
    address?: string;
    state?: string;
    city?: string;
    country?: string;
  }) => request<any>(`/invoicing/customers/${id}`, { method: "POST", body: JSON.stringify(b) }),
  deleteCustomer: (id: string) => request<any>(`/invoicing/customers/${id}/delete`, { method: "POST" }),
  listCustomerComments: (id: string) => request<any[]>(`/invoicing/customers/${id}/comments`),
  addCustomerComment: (id: string, body: string) =>
    request<any>(`/invoicing/customers/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  customerStatement: (id: string) => request<any[]>(`/invoicing/customers/${id}/statement`),
  listProducts: () => request<any[]>("/invoicing/products"),
  createProduct: (b: { name: string; priceSar: number; sku?: string; vatRate?: number }) =>
    request<any>("/invoicing/products", { method: "POST", body: JSON.stringify(b) }),
  listInvoices: () => request<any[]>("/invoicing/invoices"),
  getInvoice: (id: string) => request<any>(`/invoicing/invoices/${id}`),
  createInvoice: (b: {
    customerId: string;
    lines: { description: string; qty: number; unitPrice: number; vatRate?: number }[];
    dueDate?: string;
    isTaxInvoice?: boolean;
  }) => request<any>("/invoicing/invoices", { method: "POST", body: JSON.stringify(b) }),
  issueInvoice: (id: string) =>
    request<any>(`/invoicing/invoices/${id}/issue`, { method: "POST" }),
  payInvoice: (id: string) =>
    request<any>(`/invoicing/invoices/${id}/pay`, { method: "POST" }),

  // Quotations
  listQuotations: () => request<any[]>("/invoicing/quotations"),
  getQuotation: (id: string) => request<any>(`/invoicing/quotations/${id}`),
  createQuotation: (b: {
    customerId: string;
    lines: { description: string; qty: number; unitPrice: number; vatRate?: number }[];
    dueDate?: string;
    isTaxQuote?: boolean;
  }) => request<any>("/invoicing/quotations", { method: "POST", body: JSON.stringify(b) }),
  updateQuotation: (id: string, b: {
    customerId?: string;
    lines?: { description: string; qty: number; unitPrice: number; vatRate?: number }[];
    dueDate?: string;
    isTaxQuote?: boolean;
    status?: string;
  }) => request<any>(`/invoicing/quotations/${id}`, { method: "POST", body: JSON.stringify(b) }),
  deleteQuotation: (id: string) =>
    request<any>(`/invoicing/quotations/${id}/delete`, { method: "POST" }),
  convertQuotationToInvoice: (id: string) =>
    request<any>(`/invoicing/quotations/${id}/convert`, { method: "POST" }),

  // Tasks & Due Date Tracking
  listTasks: () => request<any[]>("/tasks"),
  getTask: (id: string) => request<any>(`/tasks/${id}`),
  createTask: (b: {
    title: string;
    description?: string;
    dueDate: string;
    priority?: string;
    relatedType?: string;
    relatedId?: string;
  }) => request<any>("/tasks", { method: "POST", body: JSON.stringify(b) }),
  updateTask: (id: string, b: { title?: string; description?: string; dueDate?: string; priority?: string }) =>
    request<any>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  completeTask: (id: string) =>
    request<any>(`/tasks/${id}/complete`, { method: "PATCH" }),
  deleteTask: (id: string) =>
    request<any>(`/tasks/${id}`, { method: "DELETE" }),
  getOverdueeTasks: () => request<any[]>("/tasks/overdue"),
  getUpcomingTasks: () => request<any[]>("/tasks/upcoming"),
  getTaskDashboardSummary: () => request<any>("/tasks/dashboard-summary"),
  getInvoiceDueDates: () => request<any>("/tasks/invoice-due-dates"),

  // Accounting
  listJournal: () => request<any[]>("/accounting/journal"),
  getJournalEntry: (id: string) => request<any>(`/accounting/journal/${id}`),
  createManualJE: (b: {
    date?: string; memo: string;
    lines: { accountId: string; debit?: number; credit?: number }[];
  }) => request<any>("/accounting/journal", { method: "POST", body: JSON.stringify(b) }),
  listAccounts: () => request<any[]>("/accounting/accounts"),
  createAccount: (b: { code: string; name: string; type: string }) =>
    request<any>("/accounting/accounts", { method: "POST", body: JSON.stringify(b) }),
  vatReport: () => request<any>("/accounting/reports/vat"),
  pnl: () => request<any>("/accounting/reports/pnl"),
  trialBalance: (q?: { from?: string; to?: string }) => {
    const p = new URLSearchParams();
    if (q?.from) p.set("from", q.from); if (q?.to) p.set("to", q.to);
    const qs = p.toString(); return request<any>(`/accounting/reports/trial-balance${qs ? "?" + qs : ""}`);
  },
  generalLedger: (accountId: string, q?: { from?: string; to?: string }) => {
    const p = new URLSearchParams();
    if (q?.from) p.set("from", q.from); if (q?.to) p.set("to", q.to);
    const qs = p.toString(); return request<any>(`/accounting/ledger/${accountId}${qs ? "?" + qs : ""}`);
  },

  // Purchasing (vendors + bills)
  listVendors: () => request<any[]>("/purchasing/vendors"),
  createVendor: (b: {
    name: string; vatNumber?: string; email?: string; phone?: string;
    address?: string; city?: string; country?: string;
  }) => request<any>("/purchasing/vendors", { method: "POST", body: JSON.stringify(b) }),
  listBills: () => request<any[]>("/purchasing/bills"),
  getBill: (id: string) => request<any>(`/purchasing/bills/${id}`),
  createBill: (b: {
    vendorId: string; billDate?: string; dueDate?: string;
    reference?: string; notes?: string;
    lines: { description: string; qty: number; unitPrice: number; vatRate?: number; expenseAccountId?: string }[];
  }) => request<any>("/purchasing/bills", { method: "POST", body: JSON.stringify(b) }),
  postBill: (id: string) =>
    request<any>(`/purchasing/bills/${id}/post`, { method: "POST" }),
  payBill: (id: string) =>
    request<any>(`/purchasing/bills/${id}/pay`, { method: "POST" }),
};

export const session = {
  save(auth: AuthResponse) {
    if (typeof window === "undefined") return;
    localStorage.setItem("erp.token", auth.token);
    localStorage.setItem("erp.user", JSON.stringify(auth.user));
    localStorage.setItem("erp.tenant", JSON.stringify(auth.tenant));
  },
  token: getToken,
  user(): { id: string; name: string; email: string } | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("erp.user");
    return raw ? JSON.parse(raw) : null;
  },
  tenant(): { id: string; name: string; slug: string; schema: string } | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("erp.tenant");
    return raw ? JSON.parse(raw) : null;
  },
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("erp.token");
    localStorage.removeItem("erp.user");
    localStorage.removeItem("erp.tenant");
  },
};
