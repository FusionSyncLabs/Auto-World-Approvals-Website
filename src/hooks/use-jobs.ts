/**
 * Realtime subscription to the current user's background-job rows.
 *
 * Returns the latest N jobs and re-renders whenever any of them change in
 * the database. Used by the global BackgroundTasksPanel and by individual
 * studios that want to react when a generation finishes.
 */

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type JobRow = {
  id: string;
  kind:
    | "logo_generate"
    | "logo_remix"
    | "logo_upload"
    | "banner_variations"
    | "banner_remix"
    | "ad_generate"
    | "ad_remix";
  label: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  progress: number;
  error: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export function useMyJobs(opts: { limit?: number; notify?: boolean } = {}) {
  const { limit = 25, notify = false } = opts;
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const seenStatus = useRef<Map<string, JobRow["status"]>>(new Map());

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setUserId(data.user?.id ?? null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, kind, label, status, progress, error, result, created_at, started_at, finished_at")
        .eq("user_id", userId as string)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (cancelled) return;
      if (error) {
        console.error("[useMyJobs] load failed", error);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as JobRow[];
      rows.forEach((j) => seenStatus.current.set(j.id, j.status));
      setJobs(rows);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`jobs-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `user_id=eq.${userId}` },
        (payload) => {
          setJobs((current) => {
            const next = [...current];
            const incoming = payload.new as JobRow | undefined;
            const old = payload.old as { id?: string } | undefined;

            if (payload.eventType === "DELETE" && old?.id) {
              return next.filter((j) => j.id !== old.id);
            }
            if (!incoming) return next;

            const idx = next.findIndex((j) => j.id === incoming.id);
            if (idx >= 0) next[idx] = { ...next[idx], ...incoming };
            else next.unshift(incoming);

            if (notify) {
              const prev = seenStatus.current.get(incoming.id);
              if (prev !== incoming.status) {
                if (incoming.status === "succeeded") toast.success(`${incoming.label} ready`);
                else if (incoming.status === "failed") toast.error(`${incoming.label} failed: ${incoming.error ?? "unknown error"}`);
              }
              seenStatus.current.set(incoming.id, incoming.status);
            }
            return next.slice(0, limit);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, limit, notify]);

  return { jobs, loading };
}
