/**
 * Global Background Tasks panel: a bell-icon dropdown in the admin shell
 * header showing the user's running and recently-finished AI jobs. Updates
 * live via Supabase Realtime; finished jobs raise a toast.
 */

import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { Bell, Loader2, CheckCircle2, XCircle, X, Clock, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyJobs, type JobRow } from "@/hooks/use-jobs";
import { toast } from "sonner";

const KIND_LINK: Record<JobRow["kind"], { to: string; label: string }> = {
  logo_generate: { to: "/admin/logos", label: "Logo Studio" },
  logo_remix: { to: "/admin/logos", label: "Logo Studio" },
  logo_upload: { to: "/admin/logos", label: "Logo Studio" },
  banner_variations: { to: "/admin/banners", label: "Banner Studio" },
  banner_remix: { to: "/admin/banners", label: "Banner Studio" },
  ad_generate: { to: "/admin/ad-studio", label: "Ad Studio" },
  ad_remix: { to: "/admin/ad-studio", label: "Ad Studio" },
};

function StatusIcon({ status }: { status: JobRow["status"] }) {
  switch (status) {
    case "queued":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-[var(--electric)]" />;
    case "succeeded":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "cancelled":
      return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

export function BackgroundTasksPanel() {
  const [open, setOpen] = useState(false);
  const { jobs } = useMyJobs({ limit: 20, notify: true });
  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const recent = jobs.filter((j) => j.status !== "queued" && j.status !== "running").slice(0, 10);

  async function onCancel(id: string) {
    try {
      toast("Task cancelled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="relative"
        aria-label="Background tasks"
      >
        <Bell className="h-4 w-4" />
        {active.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--electric)] px-1 text-[17px] font-bold text-white">
            {active.length}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[360px] max-w-[95vw] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Background tasks</p>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="-mr-2 h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {jobs.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No tasks yet. Generations you start in the studios will appear here and keep running even if you change pages or log off.
                </p>
              )}

              {active.length > 0 && (
                <div className="px-2 pt-2">
                  <p className="px-2 pb-1 text-[17px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Running
                  </p>
                  {active.map((j) => (
                    <JobItem key={j.id} job={j} onCancel={() => onCancel(j.id)} />
                  ))}
                </div>
              )}

              {recent.length > 0 && (
                <div className="px-2 pt-2 pb-2">
                  <p className="px-2 pb-1 text-[17px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent
                  </p>
                  {recent.map((j) => (
                    <JobItem key={j.id} job={j} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function JobItem({ job, onCancel }: { job: JobRow; onCancel?: () => void }) {
  const link = KIND_LINK[job.kind];
  return (
    <div className="group flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-accent">
      <div className="mt-0.5 shrink-0">
        <StatusIcon status={job.status} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{job.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {job.status === "queued" && "Waiting for worker…"}
          {job.status === "running" && "Working…"}
          {job.status === "succeeded" && (
            <Link to={link.to} className="underline-offset-2 hover:underline">
              Open {link.label} →
            </Link>
          )}
          {job.status === "failed" && (job.error ?? "Failed")}
          {job.status === "cancelled" && "Cancelled"}
        </p>
      </div>
      {onCancel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
