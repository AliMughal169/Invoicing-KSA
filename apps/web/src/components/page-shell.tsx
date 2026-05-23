import { cn } from "@/lib/utils";

export function PageHeader({
  title, description, actions, className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="p-6 md:p-10 max-w-[1400px] mx-auto">{children}</div>;
}
