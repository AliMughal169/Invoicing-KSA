import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSAR(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
