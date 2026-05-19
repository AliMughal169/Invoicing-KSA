import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ERP SaaS",
  description: "Multi-tenant ERP for KSA SMBs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
