import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "secondary" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  issued: { label: "Issued", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  void: { label: "Void", variant: "destructive" },
  new: { label: "New", variant: "secondary" },
  qualified: { label: "Qualified", variant: "default" },
  proposal: { label: "Proposal", variant: "warning" },
  won: { label: "Won", variant: "success" },
  lost: { label: "Lost", variant: "destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
