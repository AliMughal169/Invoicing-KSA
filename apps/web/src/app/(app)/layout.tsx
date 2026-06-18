"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, FileText, BookOpen, LogOut, Building2, Package, TrendingUp, Globe, ClipboardList, CalendarDays, Receipt, Truck, Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { session } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { AiChatDrawer } from "@/components/ai-chat-drawer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [tenant, setTenant] = useState<{ name: string; slug: string } | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const tk = session.token();
    if (!tk) { router.replace("/login"); return; }
    setTenant(session.tenant());
    setUser(session.user());
  }, [router]);

  const NAV = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/crm/contacts", label: t("contacts"), icon: Users },
    { href: "/crm/pipeline", label: t("pipeline"), icon: TrendingUp },
    { href: "/invoicing/invoices", label: t("invoices"), icon: FileText },
    { href: "/invoicing/customers", label: t("customers"), icon: Building2 },
    { href: "/invoicing/products", label: t("products"), icon: Package },
    { href: "/purchasing/vendors", label: "Vendors", icon: Truck },
    { href: "/purchasing/bills", label: "Bills", icon: Receipt },
    { href: "/tasks", label: "Tasks", icon: ClipboardList },
    { href: "/due-dates", label: "Due Dates", icon: CalendarDays },
    { href: "/accounting/journal", label: t("accounting"), icon: BookOpen },
    { href: "/accounting/trial-balance", label: "Trial Balance", icon: Scale },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="px-6 py-5 border-b">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("workspace")}</p>
          <p className="mt-1 text-base font-semibold truncate">{tenant?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{tenant?.slug}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4 space-y-3">
          <div className="flex items-center gap-2 rounded-md border p-1 text-xs">
            <Globe className="h-3.5 w-3.5 text-muted-foreground ms-1" />
            <button onClick={() => setLocale("en")}
              className={cn("flex-1 py-1 rounded-sm transition-colors",
                locale === "en" ? "bg-secondary text-foreground" : "text-muted-foreground")}>
              EN
            </button>
            <button onClick={() => setLocale("ar")}
              className={cn("flex-1 py-1 rounded-sm transition-colors",
                locale === "ar" ? "bg-secondary text-foreground" : "text-muted-foreground")}>
              ع
            </button>
          </div>
          <div>
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => { session.clear(); router.push("/login"); }}>
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
      <AiChatDrawer />
    </div>
  );
}
