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
  createCustomer: (b: {
    name: string;
    email?: string;
    vatNumber?: string;
    contactPersonName?: string;
    companyPhone?: string;
    contactPersonPhone?: string;
    contactPersonPhoneSameAsCompany?: boolean;
    address?: string;
    state?: string;
    city?: string;
    country?: string;
  }) =>
    request<any>("/invoicing/customers", { method: "POST", body: JSON.stringify(b) }),
  listProducts: () => request<any[]>("/invoicing/products"),
  createProduct: (b: { name: string; priceSar: number; sku?: string; vatRate?: number }) =>
    request<any>("/invoicing/products", { method: "POST", body: JSON.stringify(b) }),
  listInvoices: () => request<any[]>("/invoicing/invoices"),
  getInvoice: (id: string) => request<any>(`/invoicing/invoices/${id}`),
  createInvoice: (b: {
    customerId: string;
    lines: { description: string; qty: number; unitPrice: number; vatRate?: number }[];
    dueDate?: string;
  }) => request<any>("/invoicing/invoices", { method: "POST", body: JSON.stringify(b) }),
  issueInvoice: (id: string) =>
    request<any>(`/invoicing/invoices/${id}/issue`, { method: "POST" }),
  payInvoice: (id: string) =>
    request<any>(`/invoicing/invoices/${id}/pay`, { method: "POST" }),

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
  vatReport: () => request<any>("/accounting/reports/vat"),
  pnl: () => request<any>("/accounting/reports/pnl"),
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
