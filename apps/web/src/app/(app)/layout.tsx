"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, FileText, BookOpen, LogOut, Building2, Package, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { session } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/crm/contacts", label: "Contacts", icon: Users },
  { href: "/crm/pipeline", label: "Pipeline", icon: TrendingUp },
  { href: "/invoicing/invoices", label: "Invoices", icon: FileText },
  { href: "/invoicing/customers", label: "Customers", icon: Building2 },
  { href: "/invoicing/products", label: "Products", icon: Package },
  { href: "/accounting/journal", label: "Accounting", icon: BookOpen },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tenant, setTenant] = useState<{ name: string; slug: string } | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const t = session.token();
    if (!t) {
      router.replace("/login");
      return;
    }
    setTenant(session.tenant());
    setUser(session.user());
  }, [router]);

  function logout() {
    session.clear();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="px-6 py-5 border-b">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Workspace</p>
          <p className="mt-1 text-base font-semibold truncate">{tenant?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{tenant?.slug}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4 space-y-3">
          <div>
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
