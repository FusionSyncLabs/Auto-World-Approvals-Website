import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { fuzzyMatch, searchBlob } from "@/lib/fuzzy-search";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Download, Search, FileSpreadsheet, Mail, Trash2, MoreHorizontal, ArrowUpDown, ChevronDown, FileDown, Plus, FileText, Car, Send, Settings, X, ListChecks,
} from "lucide-react";
import { SendLeadDialog } from "@/components/crm/SendLeadDialog";
import { bulkUpdateLeads, bulkDeleteLeads, emailLeadExport, createLeadAdmin, backfillLeadNotifications, resendLeadNotification, getNotificationEmails, setNotificationEmails, purgeContactlessLeads } from "@/lib/admin.functions";

import { toast } from "sonner";
import { hasContactInfo } from "@/lib/crm-constants";
import { DeliveryStatsPanel } from "@/components/crm/DeliveryStatsPanel";
import { LeadCountsDialog } from "@/components/crm/LeadCountsDialog";
import { LeadsCalendar } from "@/components/crm/LeadsCalendar";


export const Route = createFileRoute("/_authenticated/admin/leads/")({
  head: () => ({ meta: [{"title": "Leads | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals leads area for authorized users."}, {"property": "og:title", "content": "Leads | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals leads area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: Leads,
});

const STATUSES = ["all", "new", "contacted", "qualified", "sent_to_dealer", "approved", "sold", "not_qualified", "duplicate", "archived"] as const;
const STATUS_OPTIONS = STATUSES.slice(1);
const COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-neutral-100 text-neutral-600",
  qualified: "bg-emerald-100 text-emerald-800",
  sent_to_dealer: "bg-indigo-100 text-indigo-800",
  approved: "bg-green-100 text-green-800",
  sold: "bg-purple-100 text-purple-800",
  not_qualified: "bg-rose-100 text-rose-800",
  duplicate: "bg-zinc-100 text-zinc-800",
  archived: "bg-zinc-100 text-zinc-600",
};

// Type derivation from `source` — distinguishes form origin
type LeadType = "pre_approval" | "vehicle_valuation" | "manual" | "other";
function leadType(source: string | null | undefined): LeadType {
  if (source === "website" || source === "apply") return "pre_approval";
  if (source === "trade_in_form" || source === "sell_trade_in") return "vehicle_valuation";
  if (source === "manual") return "manual";
  return "other";
}
const TYPE_META: Record<LeadType, { label: string; short: string; cls: string; icon: typeof FileText }> = {
  pre_approval:      { label: "Pre-Approval",      short: "Pre-App",  cls: "bg-blue-100 text-blue-800 border-blue-200",       icon: FileText },
  vehicle_valuation: { label: "Vehicle Valuation", short: "Trade-In", cls: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: Car },
  manual:            { label: "Manual Entry",      short: "Manual",   cls: "bg-amber-100 text-amber-800 border-amber-200",     icon: Plus },
  other:             { label: "Other",             short: "Other",    cls: "bg-zinc-100 text-zinc-700 border-zinc-200",        icon: FileText },
};
const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All form types" },
  { value: "pre_approval", label: "Pre-Approval applications" },
  { value: "vehicle_valuation", label: "Vehicle valuations" },
  { value: "manual", label: "Manual entries" },
  { value: "other", label: "Other / unknown" },
];

type SortKey = "created_at" | "lead_score" | "first_name" | "province" | "status";
type SortDir = "asc" | "desc";


function Leads() {
  const qc = useQueryClient();
  const [countsOpen, setCountsOpen] = useState(false);
  const bulkUpdate = useServerFn(bulkUpdateLeads);
  const bulkDelete = useServerFn(bulkDeleteLeads);
  const emailExport = useServerFn(emailLeadExport);
  const createLead = useServerFn(createLeadAdmin);
  const backfillEmails = useServerFn(backfillLeadNotifications);
  const resendOne = useServerFn(resendLeadNotification);
  const getEmails = useServerFn(getNotificationEmails);
  const saveEmails = useServerFn(setNotificationEmails);
  const purgeContactless = useServerFn(purgeContactlessLeads);
  const [purging, setPurging] = useState(false);
  const runPurge = async () => {
    if (purging) return;
    setPurging(true);
    try {
      const preview = await purgeContactless({ data: { dryRun: true } });
      if (!preview.count) { toast.info("No incomplete leads without contact info"); return; }
      if (!confirm(`Permanently delete ${preview.count} incomplete application(s) with no email or phone number? This cannot be undone.`)) return;
      const r = await purgeContactless({ data: {} });
      toast.success(`Purged ${r.deleted} incomplete lead${r.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purge failed");
    } finally {
      setPurging(false);
    }
  };
  const [backfilling, setBackfilling] = useState(false);

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [emailsOpen, setEmailsOpen] = useState(false);
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  const [newNotifyEmail, setNewNotifyEmail] = useState("");
  const [savingEmails, setSavingEmails] = useState(false);
  const runBackfill = async () => {
    if (backfilling) return;
    setBackfilling(true);
    try {
      const r = await backfillEmails({ data: {} });
      toast.success(`Sent ${r.sent} lead email${r.sent === 1 ? "" : "s"}${r.failed ? ` · ${r.failed} failed` : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  };
  const openEmailsDialog = async () => {
    setEmailsOpen(true);
    try {
      const r = await getEmails({});
      setNotifyEmails(r.emails);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load recipients");
    }
  };
  const addNotifyEmail = () => {
    const e = newNotifyEmail.trim().toLowerCase();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("Invalid email"); return; }
    if (notifyEmails.includes(e)) { toast.error("Already added"); return; }
    if (notifyEmails.length >= 10) { toast.error("Maximum 10 emails"); return; }
    setNotifyEmails([...notifyEmails, e]);
    setNewNotifyEmail("");
  };
  const removeNotifyEmail = (e: string) => setNotifyEmails(notifyEmails.filter((x) => x !== e));
  const persistNotifyEmails = async () => {
    setSavingEmails(true);
    try {
      const r = await saveEmails({ data: { emails: notifyEmails } });
      setNotifyEmails(r.emails);
      toast.success("Notification recipients saved");
      setEmailsOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally { setSavingEmails(false); }
  };
  const doResend = async (id: string) => {
    setResendingId(id);
    try {
      await resendOne({ data: { id } });
      toast.success("Notification resent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Resend failed");
    } finally { setResendingId(null); }
  };

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [province, setProvince] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendLead, setSendLead] = useState<{ id: string; name: string } | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [working, setWorking] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [showAnon, setShowAnon] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [newLead, setNewLead] = useState({ first_name: "", last_name: "", email: "", phone: "", province: "", vehicle_type: "", credit_rating: "", notes: "" });



  const { data: allRows, isLoading } = useQuery({
    queryKey: ["admin-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, first_name, last_name, email, phone, city, province, postal_code, vehicle_type, credit_rating, status, lead_score, source, employer_name, trade_in_make, trade_in_model, trade_in_year, created_at, submitted_at, email_notified_at, duplicate_of, duplicate_detected_at, first_contact_by, first_contacted_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Anonymous in-progress funnel rows are kept, but hidden behind a toggle so
  // nothing that is stored is ever completely invisible. Turning the toggle on
  // shows ONLY those incomplete rows, so the list never mixes them with real leads.
  const anonCount = useMemo(
    () => (allRows ?? []).filter((l) => !hasContactInfo(l as Record<string, unknown>)).length,
    [allRows],
  );
  const data = useMemo(
    () =>
      (allRows ?? []).filter((l) =>
        showAnon
          ? !hasContactInfo(l as Record<string, unknown>)
          : hasContactInfo(l as Record<string, unknown>),
      ),
    [allRows, showAnon],
  );

  const countableData = useMemo(() => data.filter((l) => l.status !== "duplicate"), [data]);

  const provinces = useMemo(() => Array.from(new Set((data ?? []).map((l) => l.province).filter(Boolean))) as string[], [data]);

  const counts = useMemo(() => {
    const c = { pre_approval: 0, vehicle_valuation: 0, manual: 0, other: 0 };
    for (const l of countableData) c[leadType(l.source)]++;
    return c;
  }, [countableData]);

  const monthOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    for (const l of countableData) {
      const d = new Date(l.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = map.get(key);
      const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (existing) existing.count++;
      else map.set(key, { key, label, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [countableData]);


  // Month picker is a convenience that fills the date range for a full month.
  // If the user touches the date inputs directly, the month picker resets to
  // "all" so the two controls never fight each other.
  useEffect(() => {
    if (monthFilter === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    const [year, month] = monthFilter.split("-").map(Number);
    const lastDay = new Date(year!, month!, 0).getDate();
    setDateFrom(`${monthFilter}-01`);
    setDateTo(`${monthFilter}-${String(lastDay).padStart(2, "0")}`);
  }, [monthFilter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;
    const arr = (countableData ?? []).filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (province !== "all" && l.province !== province) return false;
      if (typeFilter !== "all" && leadType(l.source) !== typeFilter) return false;
      const ts = new Date(l.created_at).getTime();
      if (ts < fromTs || ts > toTs) return false;
      if (!term) return true;
      const blob = searchBlob([
        l.first_name, l.last_name, l.email, l.phone, l.city, l.province, l.postal_code,
        l.vehicle_type, l.credit_rating, l.status, l.source, l.employer_name,
        l.trade_in_make, l.trade_in_model, l.trade_in_year, l.first_contact_by,
      ]);
      return fuzzyMatch(blob, term);
    });
    arr.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey] ?? "";
      const bv = (b as Record<string, unknown>)[sortKey] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [countableData, search, status, province, typeFilter, dateFrom, dateTo, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paged = useMemo(
    () => filtered.slice(pageStart, pageStart + pageSize),
    [filtered, pageStart, pageSize],
  );
  const goToPage = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));
  const hasActiveFilters = search || status !== "all" || province !== "all" || typeFilter !== "all" || monthFilter !== "all" || dateFrom || dateTo;

  useEffect(() => { setPage(1); }, [search, status, province, typeFilter, monthFilter, dateFrom, dateTo, showAnon]);





  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const allChecked = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  };
  const toggleOne = (id: string) => {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n);
  };

  const exportCsv = () => {
    const rows = filtered.length ? filtered : (data ?? []);
    if (!rows.length) return;
    const headers = ["id","first_name","last_name","email","phone","province","vehicle_type","credit_rating","status","lead_score","source","created_at"];
    const csvRows = rows.map((l) => headers.map((h) => JSON.stringify((l as Record<string, unknown>)[h] ?? "")).join(","));
    const csv = [headers.join(","), ...csvRows].join("\n");
    download(new Blob([csv], { type: "text/csv" }), `leads-${new Date().toISOString().slice(0,10)}.csv`);
  };

  const exportXlsx = () => {
    const rows = filtered.length ? filtered : (data ?? []);
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows.map((l) => ({
      ID: l.id, First: l.first_name, Last: l.last_name, Email: l.email, Phone: l.phone,
      Province: l.province, Vehicle: l.vehicle_type, Credit: l.credit_rating, Status: l.status,
      Score: l.lead_score, Source: l.source, Created: new Date(l.created_at).toLocaleString(),
    })));
    ws["!cols"] = [{ wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const runBulkStatus = async (newStatus: string) => {
    if (!selected.size) return;
    setWorking(true);
    try {
      await bulkUpdate({ data: { ids: Array.from(selected), status: newStatus } });
      toast.success(`Updated ${selected.size} lead(s) to ${newStatus.replace(/_/g, " ")}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally { setWorking(false); }
  };

  const runBulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} lead(s)? This cannot be undone.`)) return;
    setWorking(true);
    try {
      await bulkDelete({ data: { ids: Array.from(selected) } });
      toast.success(`Deleted ${selected.size} lead(s)`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally { setWorking(false); }
  };

  const submitEmailExport = async () => {
    const recipients = emailRecipients.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    const ids = selected.size ? Array.from(selected) : filtered.map((l) => l.id);
    if (!recipients.length) { toast.error("Add at least one recipient"); return; }
    if (!ids.length) { toast.error("No leads to send"); return; }
    setWorking(true);
    try {
      const r = await emailExport({ data: { ids, recipients, subject: emailSubject || undefined } });
      const sentInfo = r.sent as { sent?: boolean; skipped?: boolean };
      if (sentInfo?.sent) toast.success(`Emailed ${r.count} lead(s) to ${recipients.length} recipient(s)`);
      else toast.info("Email provider not configured — add an email setup or RESEND_API_KEY");
      setEmailDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Email failed");
    } finally { setWorking(false); }
  };

  const clearFilters = () => { setSearch(""); setStatus("all"); setProvince("all"); setTypeFilter("all"); setMonthFilter("all"); setDateFrom(""); setDateTo(""); };

  const submitAddLead = async () => {
    if (!newLead.first_name && !newLead.last_name && !newLead.email && !newLead.phone) {
      toast.error("Add at least a name, email, or phone");
      return;
    }
    setWorking(true);
    try {
      await createLead({ data: newLead });
      toast.success("Lead added");
      setAddOpen(false);
      setNewLead({ first_name: "", last_name: "", email: "", phone: "", province: "", vehicle_type: "", credit_rating: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add lead");
    } finally { setWorking(false); }
  };

  return (
    <AdminLayout>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters
              ? `${filtered.length} of ${countableData.length} leads shown`
              : `${countableData.length} unique leads · ${data.length} submissions`}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild title="Manage delivery recipients, admin vs client lists and lead rotation">
            <Link to="/admin/distribution">
              <Send className="h-4 w-4" /> Lead distribution
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={openEmailsDialog} title="Manage email addresses that receive new-lead notifications">
            <Settings className="h-4 w-4" /> Notification recipients
          </Button>
          <Button variant="outline" size="sm" onClick={runBackfill} disabled={backfilling} title="Email every lead that has never been emailed">
            <Mail className="h-4 w-4" /> {backfilling ? "Sending…" : "Email un-notified leads"}
          </Button>
          <Button variant="outline" size="sm" onClick={runPurge} disabled={purging} className="text-destructive" title="Delete abandoned applications that have no email and no phone number">
            <Trash2 className="h-4 w-4" /> {purging ? "Purging…" : "Purge incomplete"}
          </Button>

          <Button variant="outline" size="sm" onClick={() => setCountsOpen(true)} title="Correct how many leads each client is credited with">
            <ListChecks className="h-4 w-4" /> Edit lead counts
          </Button>

          <Button variant="hero" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add lead
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><FileDown className="h-4 w-4" /> Export <ChevronDown className="h-3 w-3" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportCsv}><Download className="h-4 w-4" /> CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEmailSubject(`Auto World Approvals — ${(selected.size || filtered.length)} lead export`); setEmailDialogOpen(true); }}>
                <Mail className="h-4 w-4" /> Email…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-4">
        <DeliveryStatsPanel />
      </div>

      <div className="mb-4 max-w-md">
        <LeadsCalendar
          leads={countableData}
          selectedDay={dateFrom && dateFrom === dateTo ? dateFrom : null}
          onPickDay={(day) => {
            setMonthFilter("all");
            setDateFrom(day ?? "");
            setDateTo(day ?? "");
          }}
        />
      </div>

      {/* Type quick-filter chips */}

      <div className="mb-3 flex flex-wrap gap-2">
        {TYPE_FILTERS.map((t) => {
          const active = typeFilter === t.value;
           const n = t.value === "all" ? countableData.length : counts[t.value as LeadType];
          return (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-[var(--electric)] bg-[var(--electric)]/10 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {t.label} <span className="ml-1 opacity-70">{n}</span>
            </button>
          );
        })}
        {anonCount > 0 && (
          <button
            onClick={() => setShowAnon((v) => !v)}
            className={`rounded-full border border-dashed px-3 py-1 text-xs font-medium transition ${showAnon ? "border-[var(--electric)] bg-[var(--electric)]/10 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
            title="In-progress applications with no contact info yet"
          >
            {showAnon ? "Showing incomplete only" : "Incomplete (no contact info)"} <span className="ml-1 opacity-70">{anonCount}</span>
          </button>
        )}
      </div>


      <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-3 shadow-card sm:grid-cols-2 lg:grid-cols-7">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, city, vehicle, trade-in…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : s.replace(/_/g, " ")}</option>)}
        </Select>
        <Select value={province} onChange={(e) => setProvince(e.target.value)}>
          <option value="all">All provinces</option>
          {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {TYPE_FILTERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value="all">All months</option>
          {monthOptions.map((m) => <option key={m.key} value={m.key}>{m.label} ({m.count})</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} onFocus={() => setMonthFilter("all")} title="From" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} onFocus={() => setMonthFilter("all")} title="To" />
        </div>
        {(search || status !== "all" || province !== "all" || typeFilter !== "all" || monthFilter !== "all" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="lg:col-span-7 lg:justify-self-start" onClick={clearFilters}>Clear filters</Button>
        )}
      </div>


      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--electric)]/30 bg-[var(--electric)]/5 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={working}>Set status <ChevronDown className="h-3 w-3" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Update to…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map((s) => (
                <DropdownMenuItem key={s} onClick={() => runBulkStatus(s)}>{s.replace(/_/g, " ")}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" disabled={working} onClick={() => { setEmailSubject(`Auto World Approvals — ${selected.size} lead export`); setEmailDialogOpen(true); }}>
            <Mail className="h-4 w-4" /> Email selected
          </Button>
          {selected.size === 1 && (() => {
            const id = Array.from(selected)[0]!;
            const lead = data.find((x) => x.id === id);
            return (
              <Button variant="outline" size="sm" onClick={() => setSendLead({ id, name: `${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim() || "this lead" })}>
                <Send className="h-4 w-4" /> Send to contact
              </Button>
            );
          })()}
          <Button variant="outline" size="sm" disabled={working} onClick={runBulkDelete} className="text-destructive">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:block">
        <div className="max-h-[min(70vh,calc(100vh-24rem))] min-h-[240px] overflow-auto overscroll-contain">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground shadow-[0_1px_0_var(--color-border)]">

              <tr>
                <th className="w-10 px-3 py-3"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 rounded border-border" /></th>
                <th className="px-4 py-3">Type</th>
                <Th onClick={() => toggleSort("first_name")} active={sortKey === "first_name"} dir={sortDir}>Name</Th>
                <Th onClick={() => toggleSort("province")} active={sortKey === "province"} dir={sortDir}>Province</Th>
                <th className="px-4 py-3">Vehicle / Trade-in</th>
                <th className="px-4 py-3">Credit</th>
                <Th onClick={() => toggleSort("lead_score")} active={sortKey === "lead_score"} dir={sortDir}>Score</Th>
                <Th onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir}>Status</Th>
                <th className="px-4 py-3">First contact</th>
                <Th onClick={() => toggleSort("created_at")} active={sortKey === "created_at"} dir={sortDir}>Created</Th>
                <th className="w-10 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">No leads match these filters.</td></tr>}
              {paged.map((l) => {
                const t = leadType(l.source);
                const meta = TYPE_META[t];
                const Icon = meta.icon;
                const tradeIn = [l.trade_in_year, l.trade_in_make, l.trade_in_model].filter(Boolean).join(" ");
                const vehicleCell = t === "vehicle_valuation" ? (tradeIn || l.vehicle_type || "—") : (l.vehicle_type || tradeIn || "—");
                return (
                  <tr key={l.id} className={`hover:bg-accent ${selected.has(l.id) ? "bg-[var(--electric)]/5" : ""}`}>
                    <td className="px-3 py-3"><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleOne(l.id)} className="h-4 w-4 rounded border-border" /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[17px] font-medium ${meta.cls}`}>
                        <Icon className="h-3 w-3" /> {meta.short}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to="/admin/leads/$id" params={{ id: l.id }} className="font-medium text-foreground hover:text-[var(--electric)]">{l.first_name ?? ""} {l.last_name ?? "(no name)"}</Link>
                      <div className="text-xs text-muted-foreground">{l.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">{l.province ?? "—"}</td>
                    <td className="px-4 py-3">{vehicleCell}</td>
                    <td className="px-4 py-3">{l.credit_rating ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold">{l.lead_score}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${COLORS[l.status] ?? "bg-secondary"}`}>{l.status}</span></td>
                    <td className="px-4 py-3 text-xs">
                      {l.first_contact_by ? (
                        <div>
                          <div className="font-medium text-foreground">{l.first_contact_by}</div>
                          {l.first_contacted_at && <div className="text-muted-foreground">{new Date(l.first_contacted_at).toLocaleDateString()}</div>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Send this lead to a saved contact"
                        onClick={() => setSendLead({ id: l.id, name: `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "this lead" })}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Resend notification email"
                        disabled={resendingId === l.id}
                        onClick={() => doResend(l.id)}
                      >
                        <Send className={`h-4 w-4 ${resendingId === l.id ? "animate-pulse" : ""}`} />
                      </Button>
                      <Link to="/admin/leads/$id" params={{ id: l.id }}>
                        <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="max-h-[calc(100vh-20rem)] min-h-[240px] space-y-3 overflow-y-auto overscroll-contain pr-1 md:hidden">
        {isLoading && <p className="p-8 text-center text-muted-foreground">Loading…</p>}
        {!isLoading && filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">No leads match these filters.</p>}
        {paged.map((l) => {
          const t = leadType(l.source);
          const meta = TYPE_META[t];
          const Icon = meta.icon;
          return (
            <div key={l.id} className={`rounded-xl border border-border bg-card p-4 shadow-card ${selected.has(l.id) ? "ring-2 ring-[var(--electric)]/40" : ""}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[17px] font-medium ${meta.cls}`}>
                  <Icon className="h-3 w-3" /> {meta.short}
                </span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${COLORS[l.status] ?? "bg-secondary"}`}>{l.status}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <label className="flex flex-1 items-start gap-3 min-w-0">
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleOne(l.id)} className="mt-1 h-4 w-4 shrink-0 rounded border-border" />
                  <div className="min-w-0">
                    <Link to="/admin/leads/$id" params={{ id: l.id }} className="block truncate font-semibold text-foreground">{l.first_name ?? ""} {l.last_name ?? "(no name)"}</Link>
                    <p className="truncate text-xs text-muted-foreground">{l.email ?? "—"} · {l.phone ?? "—"}</p>
                  </div>
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Province:</span> {l.province ?? "—"}</div>
                <div><span className="text-muted-foreground">Vehicle:</span> {l.vehicle_type ?? "—"}</div>
                <div><span className="text-muted-foreground">Credit:</span> {l.credit_rating ?? "—"}</div>
                <div><span className="text-muted-foreground">Score:</span> <span className="font-semibold">{l.lead_score}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">First contact:</span> {l.first_contact_by ?? "—"}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[17px] text-muted-foreground">{new Date(l.created_at).toLocaleString()}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSendLead({ id: l.id, name: `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "this lead" })}
                >
                  <Send className="h-4 w-4" /> Send
                </Button>
              </div>

            </div>
          );
        })}

      </div>

      {/* Pagination */}
      <div className="mt-3 grid grid-cols-1 items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm shadow-card sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-muted-foreground">
          <span className="whitespace-nowrap">Rows per page</span>
          <Select
            value={String(pageSize)}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="h-9"
          >
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
          <span className="truncate">
            {filtered.length === 0 ? "0 results" : `${pageStart + 1}–${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length}`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 justify-self-start sm:justify-self-end">
          <Button variant="outline" size="sm" onClick={() => goToPage(1)} disabled={currentPage <= 1}>First</Button>
          <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>Prev</Button>
          <span className="whitespace-nowrap px-1 text-xs text-muted-foreground">Page {currentPage} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>Next</Button>
          <Button variant="outline" size="sm" onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages}>Last</Button>
        </div>
      </div>


      {/* Email dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email lead export</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Recipients</Label>
              <Input value={emailRecipients} onChange={(e) => setEmailRecipients(e.target.value)} placeholder="ops@dealer.com, sales@dealer.com" />
              <p className="mt-1 text-xs text-muted-foreground">Separate multiple addresses with commas.</p>
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <p className="rounded-md bg-secondary p-2 text-xs text-muted-foreground">
              Sending {selected.size || filtered.length} lead{(selected.size || filtered.length) === 1 ? "" : "s"} as a formatted table.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={submitEmailExport} disabled={working}>{working ? "Sending…" : "Send"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add lead dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add lead manually</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>First name</Label><NameInput value={newLead.first_name} onChange={(e) => setNewLead({ ...newLead, first_name: e.target.value })} /></div>
            <div><Label>Last name</Label><NameInput value={newLead.last_name} onChange={(e) => setNewLead({ ...newLead, last_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} /></div>
            <div><Label>Province</Label><Input value={newLead.province} onChange={(e) => setNewLead({ ...newLead, province: e.target.value.toUpperCase().slice(0, 2) })} placeholder="BC" /></div>
            <div><Label>Vehicle type</Label><Input value={newLead.vehicle_type} onChange={(e) => setNewLead({ ...newLead, vehicle_type: e.target.value })} placeholder="SUV, Truck…" /></div>
            <div><Label>Credit rating</Label><Input value={newLead.credit_rating} onChange={(e) => setNewLead({ ...newLead, credit_rating: e.target.value })} placeholder="Good / Fair / Poor" /></div>
            <div className="sm:col-span-2"><Label>Notes</Label><Input value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} placeholder="Phone-in inquiry, walk-in, etc." /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={submitAddLead} disabled={working}>{working ? "Adding…" : "Add lead"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification recipients dialog */}
      <Dialog open={emailsOpen} onOpenChange={setEmailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Notification recipients</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Every new lead (partial or full) will be emailed to these addresses. You can add up to 10.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                value={newNotifyEmail}
                onChange={(e) => setNewNotifyEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNotifyEmail(); } }}
                placeholder="ops@dealer.com"
                disabled={notifyEmails.length >= 10}
              />
              <Button variant="outline" onClick={addNotifyEmail} disabled={notifyEmails.length >= 10}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {notifyEmails.length === 0 && (
                <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  No recipients yet. Add at least one to receive new-lead alerts.
                </p>
              )}
              {notifyEmails.map((e) => (
                <div key={e} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                  <span className="truncate">{e}</span>
                  <button
                    type="button"
                    onClick={() => removeNotifyEmail(e)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{notifyEmails.length} / 10 recipients</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailsOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={persistNotifyEmails} disabled={savingEmails}>
              {savingEmails ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadCountsDialog open={countsOpen} onOpenChange={setCountsOpen} />

      {sendLead && (
        <SendLeadDialog
          leadId={sendLead.id}
          leadName={sendLead.name}
          open={!!sendLead}
          onOpenChange={(v) => { if (!v) setSendLead(null); }}
          alreadySent={[]}
        />
      )}
    </AdminLayout>


  );
}

function Th({ children, onClick, active, dir }: { children: React.ReactNode; onClick: () => void; active: boolean; dir: SortDir }) {
  return (
    <th className="px-4 py-3">
      <button onClick={onClick} className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
        {children} <ArrowUpDown className={`h-3 w-3 ${active ? "text-[var(--electric)]" : "opacity-50"}`} />
        {active && <span className="text-[17px]">{dir}</span>}
      </button>
    </th>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-10 rounded-md border border-input bg-background px-3 text-sm ${props.className ?? ""}`} />;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
