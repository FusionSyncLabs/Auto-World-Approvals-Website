import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Users, TrendingUp, MapPin, Car } from "lucide-react";
import { hasContactInfo } from "@/lib/crm-constants";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{"title": "Admin Overview | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals admin overview area for authorized users."}, {"property": "og:title", "content": "Admin Overview | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals admin overview area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: Overview,
});

function Overview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from("leads")
        .select(
           "id, status, province, vehicle_type, credit_rating, source, created_at, first_name, last_name, email, phone, submitted_at, email_notified_at, duplicate_of",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      // Anonymous in-progress funnel rows are not leads — exclude them so the
      // counts match the Lead Center.
      return (leads ?? []).filter(
        (l) => hasContactInfo(l as Record<string, unknown>) && l.status !== "duplicate",
      );
    },
  });

  const total = data?.length ?? 0;
  const today = data?.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString()).length ?? 0;
  const qualified = data?.filter((l) => ["qualified", "sent_to_dealer", "approved", "sold"].includes(l.status)).length ?? 0;
  const convRate = total ? Math.round((qualified / total) * 100) : 0;

  const groupBy = (key: "province" | "vehicle_type" | "credit_rating" | "source") => {
    const m: Record<string, number> = {};
    data?.forEach((l) => { const k = (l as Record<string, unknown>)[key] as string | null; const kk = k || "Unknown"; m[kk] = (m[kk] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  return (
    <AdminLayout>
      <div className="mb-6"><h1 className="text-2xl font-bold">Overview</h1><p className="text-sm text-muted-foreground">A snapshot of your lead pipeline.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total leads" value={isLoading ? "…" : total} />
        <StatCard icon={TrendingUp} label="New today" value={isLoading ? "…" : today} />
        <StatCard icon={TrendingUp} label="Qualified+" value={isLoading ? "…" : qualified} />
        <StatCard icon={TrendingUp} label="Conversion rate" value={isLoading ? "…" : `${convRate}%`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <BreakdownCard icon={MapPin} title="By province" rows={groupBy("province")} />
        <BreakdownCard icon={Car} title="By vehicle type" rows={groupBy("vehicle_type")} />
        <BreakdownCard icon={TrendingUp} title="By credit rating" rows={groupBy("credit_rating")} />
        <BreakdownCard icon={TrendingUp} title="By source" rows={groupBy("source")} />
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="font-semibold">Recent leads</h2>
          <Link to="/admin/leads" className="text-sm font-semibold text-[var(--electric)] hover:underline">View all →</Link>
        </div>
        <div className="divide-y divide-border">
          {(data ?? []).slice(0, 10).map((l) => (
            <Link key={l.id} to="/admin/leads/$id" params={{ id: l.id }} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-accent">
              <span className="font-medium">{l.first_name ?? ""} {l.last_name ?? "(no name)"}</span>
              <span className="text-muted-foreground">{l.province ?? "—"} · {l.vehicle_type ?? "—"}</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{l.status}</span>
            </Link>
          ))}
          {!isLoading && (data?.length ?? 0) === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No leads yet. Submit an application from the public site to see it here.</p>}
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-[var(--electric)]" />
      </div>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}

function BreakdownCard({ icon: Icon, title, rows }: { icon: typeof MapPin; title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2"><Icon className="h-4 w-4 text-[var(--electric)]" /><h3 className="font-semibold">{title}</h3></div>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="flex items-center justify-between text-sm"><span className="font-medium">{k}</span><span className="text-muted-foreground">{v}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-electric-gradient" style={{ width: `${(v / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
