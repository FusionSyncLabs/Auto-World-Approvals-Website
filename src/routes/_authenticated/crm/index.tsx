import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { deleteCrmLead, listCrmLeads, markCrmLeadsContacted, updateCrmLead } from "@/lib/crm.functions";
import { CRM_STATUSES, PIPELINE_STATUSES, leadChannel, leadName, statusMeta } from "@/lib/crm-constants";
import { scoreBand, scoreChipClass } from "@/lib/lead-score";
import { fuzzyMatch, searchBlob } from "@/lib/fuzzy-search";
import { ScoreEmoji } from "@/components/crm/ScoreEmoji";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadDetailSheet } from "@/components/crm/LeadDetailSheet";
import { SendLeadDialog } from "@/components/crm/SendLeadDialog";
import { DeliveryContactsDialog } from "@/components/crm/DeliveryContactsDialog";
import { DeliveryStatsPanel } from "@/components/crm/DeliveryStatsPanel";
import { LeadsCalendar } from "@/components/crm/LeadsCalendar";

import { Search, LayoutGrid, Rows3, Sparkles, StickyNote, Phone, Mail, Car, Trash2, CheckCheck, Send } from "lucide-react";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/")({
  head: () => ({ meta: [{"title": "Lead CRM \u2014 Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals lead crm area for authorized users."}, {"property": "og:title", "content": "Lead CRM \u2014 Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals lead crm area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: CrmLeadsPage,
});

type Lead = Record<string, unknown> & { id: string; created_at: string };

const UNTOUCHED = ["draft", "partial", "new", "submitted"];
const LOST = ["not_qualified", "duplicate", "archived"];

type Tone = "new" | "contacted" | "working" | "lost";

function leadTone(l: Lead): Tone {
  const s = String(l.status ?? "");
  if (LOST.includes(s)) return "lost";
  if (UNTOUCHED.includes(s)) return "new";
  if (s === "contacted") return "contacted";
  return "working";
}

/** Row shell styling: brand-new leads glow in their score colour, contacted leads fade to grey, worked leads calm down, lost leads fade. */
function rowClasses(l: Lead) {
  const tone = leadTone(l);
  if (tone === "lost") return "border-border bg-muted/30 opacity-60 grayscale";
  if (tone === "working") return "border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/20";
  if (tone === "contacted") return "border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/20";
  const band = scoreBand(Number(l.lead_score ?? 0));
  if (band === "hot") return "border-emerald-300 bg-emerald-50 shadow-emerald-200/50 dark:border-emerald-800 dark:bg-emerald-950/30";
  if (band === "warm") return "border-amber-300 bg-amber-50 shadow-amber-200/50 dark:border-amber-800 dark:bg-amber-950/30";
  if (band === "cold") return "border-orange-300 bg-orange-50 shadow-orange-200/50 dark:border-orange-900 dark:bg-orange-950/30";
  return "border-red-300 bg-red-50 shadow-red-200/50 dark:border-red-900 dark:bg-red-950/30";
}

function accentBar(l: Lead) {
  const tone = leadTone(l);
  if (tone === "lost") return "bg-neutral-400";
  if (tone === "working") return "bg-sky-500";
  if (tone === "contacted") return "bg-neutral-400";
  const band = scoreBand(Number(l.lead_score ?? 0));
  return band === "hot" ? "bg-emerald-500" : band === "warm" ? "bg-amber-500" : band === "cold" ? "bg-orange-500" : "bg-red-500";
}

function CrmLeadsPage() {
  const listFn = useServerFn(listCrmLeads);
  const updateFn = useServerFn(updateCrmLead);
  const deleteFn = useServerFn(deleteCrmLead);
  const markContactedFn = useServerFn(markCrmLeadsContacted);
  const qc = useQueryClient();
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });

  const setStatusMut = useMutation({
    mutationFn: (v: { id: string; status: string }) => updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      toast.success("Stage updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      toast.success("Lead deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markAllMut = useMutation({
    mutationFn: (ids: string[]) => markContactedFn({ data: { ids } }),
    onSuccess: (r: { count?: number }) => {
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      toast.success(`${r?.count ?? 0} lead${r?.count === 1 ? "" : "s"} marked as contacted`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [band, setBand] = useState("all");
  const [showAnon, setShowAnon] = useState(false);
  const [view, setView] = useState<"table" | "board">("table");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sendState, setSendState] = useState<{ id: string; name: string; sent: string[] } | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [pickedDay, setPickedDay] = useState<string | null>(null);


  const anonCount = useMemo(
    () => (leads as Lead[]).filter((l) => (l as { is_anonymous?: boolean }).is_anonymous).length,
    [leads],
  );

  const visible = useMemo(
    () => (showAnon ? (leads as Lead[]) : (leads as Lead[]).filter((l) => !(l as { is_anonymous?: boolean }).is_anonymous)),
    [leads, showAnon],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visible.filter((l) => {
      if (pickedDay) {
        const d = new Date(l.created_at);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (k !== pickedDay) return false;
      }
      if (status === "untouched" ? leadTone(l) !== "new" : status !== "all" && l.status !== status) return false;
      const s = Number(l.lead_score ?? 0);
      if (band === "hot" && s < 75) return false;
      if (band === "warm" && (s < 50 || s >= 75)) return false;
      if (band === "cold" && s >= 50) return false;
      if (!needle) return true;
      return fuzzyMatch(searchBlob(Object.values(l)), needle);
    });
  }, [visible, q, status, band, pickedDay]);

  const stats = useMemo(() => {
    const all = visible.filter((l) => String(l.status ?? "") !== "duplicate");
    const avg = all.length ? Math.round(all.reduce((a, l) => a + Number(l.lead_score ?? 0), 0) / all.length) : 0;
    const today = all.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString()).length;
    const untouched = all.filter((l) => leadTone(l) === "new").length;
    return { total: all.length, avg, today, untouched };
  }, [visible]);


  const markableIds = useMemo(
    () =>
      filtered
        .filter((l) => ["draft", "partial", "new", "submitted"].includes(String(l.status)))
        .map((l) => l.id),
    [filtered],
  );

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black sm:text-3xl">Leads</h1>
          <p className="text-sm text-muted-foreground">Every lead from the website, forms and ad platforms.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setDeliveryOpen(true)}>
            <Send className="h-4 w-4" /> Auto delivery
          </Button>
          <div className="hidden gap-1 rounded-lg border border-border p-1 sm:flex">
            <Button size="sm" variant={view === "table" ? "default" : "ghost"} onClick={() => setView("table")}>
              <Rows3 className="h-4 w-4" /> Rows
            </Button>
            <Button size="sm" variant={view === "board" ? "default" : "ghost"} onClick={() => setView("board")}>
              <LayoutGrid className="h-4 w-4" /> Pipeline
            </Button>
          </div>
        </div>
      </header>

      <DeliveryContactsDialog open={deliveryOpen} onOpenChange={setDeliveryOpen} />

      <DeliveryStatsPanel />



      <div className="max-w-md">
        <LeadsCalendar
          leads={visible.filter((l) => String(l.status ?? "") !== "duplicate")}
          selectedDay={pickedDay}
          onPickDay={setPickedDay}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total leads", value: stats.total },
          { label: "New today", value: stats.today },
          { label: "Needs first contact", value: stats.untouched, hot: true },
          { label: "Avg score", value: stats.avg },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border p-4 ${
              s.hot && s.value > 0 ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" : "border-border bg-card"
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-black">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px_150px]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search any field…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            <SelectItem value="untouched">🔥 Needs first contact</SelectItem>
            {CRM_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={band} onValueChange={setBand}>
          <SelectTrigger><SelectValue placeholder="Rating" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            <SelectItem value="hot">😀 Hot (90+)</SelectItem>
            <SelectItem value="warm">🙂 Warm (50–89)</SelectItem>
            <SelectItem value="cold">🙁 Cold (&lt;50)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {anonCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-2.5">
          <p className="text-sm text-muted-foreground">
            {anonCount} in-progress application{anonCount === 1 ? "" : "s"} with no contact info yet.
          </p>
          <Button size="sm" variant="ghost" onClick={() => setShowAnon((v) => !v)}>
            {showAnon ? "Hide incomplete" : "Show incomplete"}
          </Button>
        </div>
      )}


      {markableIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {markableIds.length} lead{markableIds.length === 1 ? "" : "s"} in this view {markableIds.length === 1 ? "is" : "are"} not marked contacted yet.
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={markAllMut.isPending}
            onClick={() => {
              if (!confirm(`Mark ${markableIds.length} lead(s) as contacted?`)) return;
              markAllMut.mutate(markableIds);
            }}
          >
            <CheckCheck className="h-4 w-4" /> Mark all as contacted
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : view === "board" ? (
        <div className="flex snap-x gap-4 overflow-x-auto pb-4">
          {PIPELINE_STATUSES.map((st) => {
            const items = filtered.filter((l) => l.status === st);
            return (
              <div key={st} className="w-72 shrink-0 snap-start rounded-xl bg-muted/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold">{statusMeta(st).label}</span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((l) => (
                    <LeadRow
                      key={l.id}
                      lead={l}
                      compact
                      onOpen={() => setOpenId(l.id)}
                      onStatus={(s) => setStatusMut.mutate({ id: l.id, status: s })}
                      onDelete={() => deleteMut.mutate(l.id)}
                      busy={setStatusMut.isPending || deleteMut.isPending}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => (
            <LeadRow
              key={l.id}
              lead={l}
              onOpen={() => setOpenId(l.id)}
              onStatus={(s) => setStatusMut.mutate({ id: l.id, status: s })}
              onDelete={() => deleteMut.mutate(l.id)}
              busy={setStatusMut.isPending || deleteMut.isPending}
            />
          ))}
          {!filtered.length && (
            <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              No leads match your filters.
            </p>
          )}
        </div>
      )}

      <LeadDetailSheet
        leadId={openId}
        open={!!openId}
        onOpenChange={(v) => !v && setOpenId(null)}
        onSend={(id, name, sent) => setSendState({ id, name, sent })}
      />
      {sendState && (
        <SendLeadDialog
          leadId={sendState.id}
          leadName={sendState.name}
          alreadySent={sendState.sent}
          open={!!sendState}
          onOpenChange={(v) => !v && setSendState(null)}
        />
      )}
    </div>
  );
}

function LeadRow({
  lead,
  onOpen,
  onStatus,
  onDelete,
  busy,
  compact,
}: {
  lead: Lead;
  onOpen: () => void;
  onStatus: (s: string) => void;
  onDelete: () => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const s = Number(lead.lead_score ?? 0);
  const tone = leadTone(lead);
  const summary = (lead.notes_summary as string) || null;
  const noteCount = Number(lead.note_count ?? 0);

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${rowClasses(lead)} ${
        compact ? "p-3" : "p-4 sm:p-5"
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${accentBar(lead)}`} />

      <div className="grid gap-3 pl-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_auto] lg:items-center lg:gap-5">
        {/* Identity */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-black ${scoreChipClass(s)}`}>
              <ScoreEmoji score={s} /> {s}
            </span>
            <span className="truncate text-base font-extrabold sm:text-lg">{leadName(lead)}</span>
            {tone === "new" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[17px] font-black uppercase tracking-wider text-background">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> New
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" /> {(lead.phone as string) || "—"}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{(lead.email as string) || "—"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5 shrink-0" /> {(lead.vehicle_type as string) || "—"}
            </span>
          </div>
        </div>

        {/* AI note summary */}
        <div className="min-w-0 rounded-xl border border-border/60 bg-background/70 p-3">
          {summary ? (
            <p className="flex gap-2 text-sm leading-snug">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="line-clamp-2">{summary}</span>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm italic text-muted-foreground">
              <StickyNote className="h-3.5 w-3.5 shrink-0" />
              {noteCount ? "Summarising notes…" : "No notes yet — add the first update"}
            </p>
          )}
          <p className="mt-1.5 text-[17px] uppercase tracking-wide text-muted-foreground">
            {noteCount} note{noteCount === 1 ? "" : "s"} · {leadChannel(lead)} · {new Date(lead.created_at).toLocaleDateString()}
            {(lead.first_contact_by as string | null) && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-0.5 font-semibold text-foreground">
                <Send className="h-3 w-3" /> First contact: {lead.first_contact_by as string}
              </span>
            )}
          </p>
        </div>

        {/* Stage control */}
        <div className="flex items-center gap-2 lg:justify-end" onClick={(e) => e.stopPropagation()}>
          <Select value={String(lead.status ?? "new")} onValueChange={onStatus} disabled={busy}>
            <SelectTrigger className="h-10 w-full bg-background font-semibold lg:w-[176px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRM_STATUSES.map((st) => (
                <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            aria-label="Delete lead"
            onClick={() => {
              if (confirm(`Delete ${leadName(lead)}? This permanently removes the lead and its notes.`)) onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
