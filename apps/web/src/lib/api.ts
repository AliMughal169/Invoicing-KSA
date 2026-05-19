import type { AuthResponse } from "@erp/shared-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function request<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;

  const res = await fetch(`${API_URL}/api${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  signup: (body: {
    email: string;
    password: string;
    name: string;
    companyName: string;
  }) =>
    request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: (token: string) =>
    request<{ user: any; tenant: any }>("/auth/me", { token }),
};

export const session = {
  save(auth: AuthResponse) {
    if (typeof window === "undefined") return;
    localStorage.setItem("erp.token", auth.token);
    localStorage.setItem("erp.user", JSON.stringify(auth.user));
    localStorage.setItem("erp.tenant", JSON.stringify(auth.tenant));
  },
  token(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("erp.token");
  },
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("erp.token");
    localStorage.removeItem("erp.user");
    localStorage.removeItem("erp.tenant");
  },
};
