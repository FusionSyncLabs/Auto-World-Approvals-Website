import { createFileRoute } from "@tanstack/react-router";

/**
 * Safety net: any draft/partial lead that has usable contact details but was
 * never auto-delivered (server hiccup, provider failure, or captured before
 * auto-delivery existed) gets delivered here. Runs on a schedule.
 *
 * Delivery itself is deduped through lead_sends, and mid-funnel leads keep
 * their draft/partial status so applicants can still resume.
 */
async function sweep() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { autoDeliverPartialLead, autoDeliverLead } = await import("@/lib/lead-delivery.server");

  // Give the live funnel a few minutes before treating a lead as "stuck".
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .in("status", ["draft", "partial", "new", "submitted", "contacted"])
    .eq("is_test", false)
    .not("first_name", "is", null)
    .lt("last_activity_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[sweep-undelivered-leads] query failed", error);
    return { swept: 0, delivered: 0, error: error.message };
  }

  let delivered = 0;
  for (const lead of (leads ?? []) as Array<Record<string, unknown>>) {
    try {
      if (lead.submitted_at && lead.consent_policy_version === "intake-2026-10-v2") {
        const { notifyLeadSubmission } = await import("@/lib/leads-notify.server");
        await notifyLeadSubmission(lead, `lead_${lead.id}`, null, null, { force: true, skipCapi: true });
      }
      const res = lead.submitted_at ? await autoDeliverLead(lead) : await autoDeliverPartialLead(lead);
      if (res.delivered > 0) {
        delivered += 1;
        console.log("[sweep-undelivered-leads] delivered", lead.id);
      }
    } catch (e) {
      console.error("[sweep-undelivered-leads] delivery threw", lead.id, e);
    }
  }

  return { swept: (leads ?? []).length, delivered };
}

export const Route = createFileRoute("/api/public/hooks/sweep-undelivered-leads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const result = await sweep();
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
