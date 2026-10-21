import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, Undo2 } from "lucide-react";
import { listContactDeliveries, setDeliveryCounted, type DeliveryRange } from "@/lib/distribution.functions";

export function DeliveryCountDialog({
  contactId,
  contactLabel,
  range,
  rangeLabel,
  onOpenChange,
}: {
  contactId: string | null;
  contactLabel: string;
  range: DeliveryRange;
  rangeLabel: string;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listContactDeliveries);
  const setCountedFn = useServerFn(setDeliveryCounted);

  const { data, isLoading } = useQuery({
    queryKey: ["contact-deliveries", contactId, range],
    queryFn: () => listFn({ data: { contact_id: contactId!, range } }),
    enabled: !!contactId,
  });

  const toggleMut = useMutation({
    mutationFn: (v: { send_id: string; counted: boolean }) => setCountedFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-deliveries"] });
      qc.invalidateQueries({ queryKey: ["distribution"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update the count"),
  });

  const deliveries = data?.deliveries ?? [];

  return (
    <Dialog open={!!contactId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit lead count — {contactLabel}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {rangeLabel} · {data ? `${data.counted} of ${deliveries.length} deliveries counted` : "Loading…"}. Exclude any
          fake or invalid lead and it stops counting toward this recipient's total.
        </p>

        <div className="mt-2 space-y-2">
          {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          {!isLoading && deliveries.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No leads delivered to this recipient in this period.
            </p>
          )}
          {deliveries.map((d) => (
            <div
              key={d.id}
              className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${
                d.excluded_from_count ? "border-dashed border-border bg-muted/50 opacity-70" : "border-border bg-background"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {d.lead_name}
                  {d.excluded_from_count && (
                    <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[17px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Not counted
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[d.lead_phone, d.lead_email, [d.lead_city, d.lead_province].filter(Boolean).join(", ")]
                    .filter(Boolean)
                    .join(" · ") || "No contact details"}
                </p>
                <p className="text-[17px] text-muted-foreground">{new Date(d.sent_at).toLocaleString()}</p>
              </div>
              <Button
                size="sm"
                variant={d.excluded_from_count ? "outline" : "ghost"}
                disabled={toggleMut.isPending}
                onClick={() => toggleMut.mutate({ send_id: d.id, counted: d.excluded_from_count })}
              >
                {d.excluded_from_count ? (
                  <>
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Count it
                  </>
                ) : (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Don't count
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
