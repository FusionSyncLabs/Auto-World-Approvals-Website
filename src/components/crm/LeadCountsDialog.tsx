import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listDistribution, type DeliveryRange } from "@/lib/distribution.functions";
import { DeliveryCountDialog } from "@/components/crm/DeliveryCountDialog";

const RANGES: Array<{ value: DeliveryRange; label: string }> = [
  { value: "this_month", label: "This month" },
  { value: "last_7", label: "Last 7 days" },
  { value: "last_30", label: "Last 30 days" },
  { value: "this_year", label: "This year" },
  { value: "all", label: "All time" },
];

export function LeadCountsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [range, setRange] = useState<DeliveryRange>("this_month");
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);
  const listFn = useServerFn(listDistribution);

  const { data, isLoading } = useQuery({
    queryKey: ["distribution", range],
    queryFn: () => listFn({ data: { range } }),
    enabled: open,
  });

  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? "";
  const members = (data?.members ?? []).filter((m) => m.kind === "client");
  const lists = data?.lists ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit client lead counts</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Pick a client to review the leads they received and uncount any that were sent by mistake or turned out to be
            fake.
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  range === r.value
                    ? "border-[var(--electric)] bg-[var(--electric)]/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            {!isLoading && members.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No client recipients yet. Add them on the Lead distribution page.
              </p>
            )}
            {members.map((m) => {
              const list = lists.find((l) => l.id === m.list_id);
              const label = m.name || m.email;
              return (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.email, list ? list.name : "No list", m.is_active ? null : "Paused"].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditing({ id: m.id, label })}>
                    {m.delivered_count} {m.delivered_count === 1 ? "lead" : "leads"} · Edit
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <DeliveryCountDialog
        contactId={editing?.id ?? null}
        contactLabel={editing?.label ?? ""}
        range={range}
        rangeLabel={rangeLabel}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
      />
    </>
  );
}
