import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { crmPerformance } from "@/lib/crm.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/crm/performance")({
  head: () => ({ meta: [{"title": "CRM Performance \u2014 Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals crm performance area for authorized users."}, {"property": "og:title", "content": "CRM Performance \u2014 Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals crm performance area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: PerformancePage,
});

type Row = Record<string, unknown>;

function group(rows: Row[], key: (r: Row) => string) {
  const map = new Map<string, { count: number; score: number; won: number }>();
  for (const r of rows) {
    const k = key(r) || "Direct";
    const cur = map.get(k) ?? { count: 0, score: 0, won: 0 };
    cur.count += 1;
    cur.score += Number(r.lead_score ?? 0);
    if (["approved", "sold"].includes(String(r.status))) cur.won += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .map(([label, v]) => ({ label, count: v.count, avg: Math.round(v.score / v.count), won: v.won }))
    .sort((a, b) => b.count - a.count);
}

function PerformancePage() {
  const fn = useServerFn(crmPerformance);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["crm-performance"], queryFn: () => fn() });

  const byChannel = useMemo(
    () => group(rows as Row[], (r) => String(r.attribution_channel ?? r.utm_source ?? r.source ?? "Direct")),
    [rows],
  );
  const byCampaign = useMemo(
    () =>
      group(
        (rows as Row[]).filter((r) => r.utm_campaign || (r.extra as Record<string, unknown>)?.campaign_name),
        (r) => String(r.utm_campaign ?? (r.extra as Record<string, unknown>)?.campaign_name ?? "—"),
      ),
    [rows],
  );

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">Performance</h1>
        <p className="text-sm text-muted-foreground">Where your leads come from and how they score.</p>
      </div>
      <Table title="By channel" rows={byChannel} />
      <Table title="By campaign" rows={byCampaign} />
    </div>
  );
}

function Table({ title, rows }: { title: string; rows: Array<{ label: string; count: number; avg: number; won: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="rounded-xl border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {!rows.length && <p className="p-4 text-sm text-muted-foreground">No data yet.</p>}
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{r.label}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-[var(--electric)]" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              <span className="block text-base font-black text-foreground">{r.count}</span>
              avg {r.avg} · won {r.won}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
