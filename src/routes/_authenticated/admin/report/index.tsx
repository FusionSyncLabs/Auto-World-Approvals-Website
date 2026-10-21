import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { getFunnelReport } from "@/lib/admin.functions";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/report/")({
  head: () => ({ meta: [{"title": "Funnel Report \u2014 Admin | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals funnel report area for authorized users."}, {"property": "og:title", "content": "Funnel Report \u2014 Admin | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals funnel report area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: FunnelReport,
});

interface ReportRow {
  key: string;
  starts: number;
  completed: number;
  contactable: number;
}

interface Report {
  days: number;
  totals: { starts: number; completed: number; contactable: number };
  bySource: ReportRow[];
  byProvince: ReportRow[];
}

function pct(part: number, whole: number) {
  return whole ? `${Math.round((part / whole) * 100)}%` : "—";
}

function BreakdownTable({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card">
      <div className="border-b border-border p-5"><h2 className="font-semibold">{title}</h2></div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-5 py-3 font-medium">Name</th>
            <th className="px-5 py-3 font-medium text-right">Starts</th>
            <th className="px-5 py-3 font-medium text-right">Completed</th>
            <th className="px-5 py-3 font-medium text-right">Finish rate</th>
            <th className="px-5 py-3 font-medium text-right">Contactable</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="px-5 py-3 font-medium">{r.key}</td>
              <td className="px-5 py-3 text-right">{r.starts}</td>
              <td className="px-5 py-3 text-right">{r.completed}</td>
              <td className="px-5 py-3 text-right">{pct(r.completed, r.starts)}</td>
              <td className="px-5 py-3 text-right">{r.contactable}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No data in this period.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FunnelReport() {
  const { data, isLoading, error } = useQuery<Report>({
    queryKey: ["funnel-report"],
    queryFn: () => getFunnelReport({ data: {} }) as Promise<Report>,
  });

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-[var(--electric)]" />
        <div>
          <h1 className="text-2xl font-bold">Funnel report</h1>
          <p className="text-sm text-muted-foreground">
            Application starts, completed applications and contactable leads — last {data?.days ?? 30} days. Test applications excluded.
          </p>
        </div>
      </div>

      {error instanceof Error && <p className="text-sm text-destructive">{error.message}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Starts</p>
          <p className="mt-1 text-3xl font-bold">{isLoading ? "…" : data?.totals.starts ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Completed applications</p>
          <p className="mt-1 text-3xl font-bold">{isLoading ? "…" : data?.totals.completed ?? 0}</p>
          <p className="mt-1 text-sm text-muted-foreground">{data ? pct(data.totals.completed, data.totals.starts) : ""} of starts</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Contactable leads</p>
          <p className="mt-1 text-3xl font-bold">{isLoading ? "…" : data?.totals.contactable ?? 0}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <BreakdownTable title="By source" rows={data?.bySource ?? []} />
        <BreakdownTable title="By province" rows={data?.byProvince ?? []} />
      </div>
    </AdminLayout>
  );
}
