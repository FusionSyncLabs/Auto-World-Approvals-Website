import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLeadSends, type LeadSendRow } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, ShieldCheck, Users, ArrowUpDown, BarChart3 } from "lucide-react";

type Grain = "month" | "week" | "quarter" | "year" | "all";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Bucket key for a date at the given grain. */
function periodKey(iso: string, grain: Grain) {
  const d = new Date(iso);
  if (grain === "all") return "all";
  if (grain === "year") return String(d.getFullYear());
  if (grain === "quarter") return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  if (grain === "week") {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    s.setDate(s.getDate() - s.getDay());
    return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function periodLabel(key: string, grain: Grain) {
  if (grain === "all") return "All time";
  if (grain === "year" || grain === "quarter") return key;
  if (grain === "week") {
    const d = new Date(`${key}T00:00:00`);
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

type Sort = "count" | "name";

export function DeliveryStatsPanel() {
  const fn = useServerFn(listLeadSends);
  const { data: sends = [], isLoading } = useQuery({
    queryKey: ["lead-sends"],
    queryFn: () => fn(),
    refetchInterval: 120_000,
  });

  const [grain, setGrain] = useState<Grain>("month");
  const [period, setPeriod] = useState<string>(() => periodKey(new Date().toISOString(), "month"));
  const [sort, setSort] = useState<Sort>("count");

  // A person delivered more than once to the same recipient (retry, resend,
  // or a repeated form submission) is still one delivery.
  const rows = useMemo(() => {
    const seen = new Map<string, LeadSendRow>();
    for (const s of [...(sends as LeadSendRow[])].sort((a, b) => (a.sent_at < b.sent_at ? -1 : 1))) {
      const key = `${s.canonical_lead_id}|${s.recipient_email.trim().toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, s);
    }
    return Array.from(seen.values());
  }, [sends]);

  const periods = useMemo(() => {
    const set = new Set<string>();
    for (const s of rows) set.add(periodKey(s.sent_at, grain));
    const list = Array.from(set).sort((a, b) => (a < b ? 1 : -1));
    const current = periodKey(new Date().toISOString(), grain);
    if (grain !== "all" && !list.includes(current)) list.unshift(current);
    return grain === "all" ? ["all"] : list;
  }, [rows, grain]);

  const activePeriod = periods.includes(period) ? period : (periods[0] ?? "all");

  const stats = useMemo(() => {
    const inPeriod = rows.filter((s) => periodKey(s.sent_at, grain) === activePeriod);
    const map = new Map<
      string,
      { email: string; name: string | null; kind: LeadSendRow["kind"]; count: number; leads: Set<string>; last: string }
    >();
    for (const s of inPeriod) {
      const cur = map.get(s.recipient_email) ?? {
        email: s.recipient_email,
        name: s.recipient_name,
        kind: s.kind,
        count: 0,
        leads: new Set<string>(),
        last: s.sent_at,
      };
      cur.count += 1;
      cur.leads.add(s.canonical_lead_id);
      if (s.sent_at > cur.last) cur.last = s.sent_at;
      if (!cur.name && s.recipient_name) cur.name = s.recipient_name;
      map.set(s.recipient_email, cur);
    }
    const list = Array.from(map.values()).map((v) => ({ ...v, unique: v.leads.size }));
    list.sort((a, b) => (sort === "count" ? b.count - a.count : (a.name || a.email).localeCompare(b.name || b.email)));
    return {
      list,
      total: inPeriod.length,
      uniqueLeads: new Set(inPeriod.map((s) => s.canonical_lead_id)).size,
      recipients: list.length,
    };
  }, [rows, grain, activePeriod, sort]);

  const exportCsv = () => {
    const header = "Recipient,Email,Type,Deliveries,Unique leads,Last delivery\n";
    const body = stats.list
      .map((r) =>
        [r.name ?? "", r.email, r.kind, r.count, r.unique, new Date(r.last).toLocaleString()]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lead-deliveries-${activePeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const max = Math.max(1, ...stats.list.map((r) => r.count));

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[var(--electric)]" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold">Leads delivered per recipient</h2>
            <p className="truncate text-xs text-muted-foreground">
              {periodLabel(activePeriod, grain)} · {stats.total} deliveries · {stats.uniqueLeads} leads ·{" "}
              {stats.recipients} recipients
            </p>
          </div>
        </div>

        <Select
          value={grain}
          onValueChange={(v) => {
            const g = v as Grain;
            setGrain(g);
            setPeriod(periodKey(new Date().toISOString(), g));
          }}
        >
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Monthly</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="quarter">Quarterly</SelectItem>
            <SelectItem value="year">Yearly</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        {grain !== "all" && (
          <Select value={activePeriod} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {periods.map((p) => (
                <SelectItem key={p} value={p}>
                  {periodLabel(p, grain)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button size="sm" variant="outline" onClick={() => setSort(sort === "count" ? "name" : "count")}>
          <ArrowUpDown className="h-4 w-4" /> {sort === "count" ? "Most leads" : "Name"}
        </Button>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!stats.list.length}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !stats.list.length ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No leads were delivered in this period.</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
          {stats.list.map((r) => (
            <li key={r.email} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {r.kind === "admin" ? (
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <p className="truncate text-sm font-semibold">{r.name || r.email}</p>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[17px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {r.kind === "admin" ? "Admin" : r.kind === "client" ? "Client" : "Past"}
                  </span>
                </div>
                {r.name && <p className="truncate text-xs text-muted-foreground">{r.email}</p>}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--electric)]"
                    style={{ width: `${(r.count / max) * 100}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <span className="block text-lg font-black tabular-nums text-foreground">{r.count}</span>
                {r.unique} unique · last {new Date(r.last).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
