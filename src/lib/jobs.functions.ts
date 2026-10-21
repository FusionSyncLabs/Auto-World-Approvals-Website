/**
 * Background-job client API.
 *
 * `enqueueJob` inserts a row in `public.jobs`; a database trigger then
 * fires `pg_net.http_post` to the run-job worker, so the AI work runs
 * decoupled from the original request and survives navigation / logout.
 *
 * `listMyJobs` and `cancelJob` power the global Background Tasks panel.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const JOB_KINDS = [
  "logo_generate",
  "logo_remix",
  "logo_upload",
  "banner_variations",
  "banner_remix",
  "ad_generate",
  "ad_remix",
  "happy_client_generate",
  "happy_client_regenerate",
  "blog_generate",
  "blog_rewrite",
  "blog_image",
] as const;

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["superadmin", "admin"])
    .limit(1);
  if (error) throw new Error("Role check failed");
  if (!data?.length) throw new Error("Forbidden");
  return supabaseAdmin;
}

export const enqueueJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      kind: z.enum(JOB_KINDS),
      label: z.string().min(1).max(160),
      input: z.record(z.string(), z.unknown()).default({}),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("jobs")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        label: data.label,
        input: data.input as never,
      })
      .select("id, trigger_token")
      .single();
    if (error) throw new Error(error.message);
    return { jobId: row.id as string };
  });

export const listMyJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      limit: z.number().int().min(1).max(100).default(25),
    }).partial().parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const limit = data.limit ?? 25;
    const { data: rows, error } = await supabaseAdmin
      .from("jobs")
      .select("id, kind, label, status, progress, error, result, created_at, started_at, finished_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const cancelJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .in("status", ["queued", "running"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
