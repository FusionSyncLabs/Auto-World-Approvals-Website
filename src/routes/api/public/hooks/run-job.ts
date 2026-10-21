/**
 * Background-job worker hook.
 *
 * Fired by the `notify_job_worker` Postgres trigger on every `jobs` insert.
 * The trigger sends `{ id, token }` where `token` is the row's
 * `trigger_token` (random uuid). We verify token + status, mark the job as
 * running, dispatch by `kind`, and write either `result` or `error` back.
 *
 * This URL is under `/api/public/*` so it bypasses Lovable's published-site
 * auth. The trigger_token guard is the only thing protecting it from being
 * triggered by anyone who knows the URL + a row id — but rows are only
 * created by signed-in admins via `enqueueJob`, and tokens are unguessable
 * UUIDs that we never expose to clients.
 */

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/run-job")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { id?: string; token?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        if (!body.id || !body.token) {
          return new Response("Missing id/token", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Atomic claim: only move queued → running if token matches.
        const { data: claimed, error: claimErr } = await supabaseAdmin
          .from("jobs")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", body.id)
          .eq("trigger_token", body.token)
          .eq("status", "queued")
          .select("id, kind, input, user_id")
          .maybeSingle();

        if (claimErr) {
          console.error("[run-job] claim error", claimErr);
          return new Response("Claim failed", { status: 500 });
        }
        if (!claimed) {
          // Either bad token, wrong id, or already claimed — treat as no-op
          return new Response("Not queued", { status: 200 });
        }

        try {
          const h = await import("@/lib/job-handlers.server");
          const input = { ...(claimed.input as Record<string, unknown>), userId: claimed.user_id as string };
          let result: unknown;
          switch (claimed.kind as string) {
            case "logo_generate":
              result = await h.handleLogoGenerate(input as never, claimed.id as string, supabaseAdmin);
              break;
            case "logo_remix":
              result = await h.handleLogoRemix(input as never, claimed.id as string, supabaseAdmin);
              break;
            case "banner_variations":
              result = await h.handleBannerVariations(input as never, claimed.id as string, supabaseAdmin);
              break;
            case "banner_remix":
              result = await h.handleBannerRemix(input as never, claimed.id as string, supabaseAdmin);
              break;
            case "ad_generate":
              result = await h.handleAdGenerate(input as never, claimed.id as string, supabaseAdmin);
              break;
            case "ad_remix":
              result = await h.handleAdRemix(input as never, claimed.id as string, supabaseAdmin);
              break;
            case "happy_client_generate":
              result = await h.handleHappyClientGenerate(input as never, claimed.id as string, supabaseAdmin);
              break;
            case "happy_client_regenerate":
              result = await h.handleHappyClientRegenerate(input as never, claimed.id as string, supabaseAdmin);
              break;
            case "blog_generate":
              result = await h.handleBlogGenerate(input as never, claimed.id as string, supabaseAdmin);
              break;
            case "blog_rewrite":
              result = await h.handleBlogRewrite(input as never, claimed.id as string, supabaseAdmin);
              break;
            case "blog_image":
              result = await h.handleBlogImage(input as never, claimed.id as string, supabaseAdmin);
              break;
            default:
              throw new Error(`Unknown job kind: ${claimed.kind}`);
          }

          await supabaseAdmin
            .from("jobs")
            .update({
              status: "succeeded",
              result: result as never,
              progress: 100,
              finished_at: new Date().toISOString(),
            })
            .eq("id", body.id);

          return new Response("ok");
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[run-job] failed", body.id, message);
          await supabaseAdmin
            .from("jobs")
            .update({
              status: "failed",
              error: message.slice(0, 1000),
              finished_at: new Date().toISOString(),
            })
            .eq("id", body.id);
          return new Response("error", { status: 200 });
        }
      },
    },
  },
});
