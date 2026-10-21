import { OptionalPersonNameSchema } from "@/lib/name-validation";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["superadmin", "admin", "agent", "viewer"] as const;
type Role = typeof ROLES[number];

type LeadExportRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  province: string | null;
  vehicle_type: string | null;
  credit_rating: string | null;
  status: string | null;
  lead_score: number | null;
  created_at: string;
};

type RoleRow = { id: string; user_id: string; role: Role; created_at: string };
type ProfileRow = { id: string; email: string | null; full_name: string | null };

export const getLeadAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)) throw new Error("Invalid lead ID");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "superadmin"]);
    if (roleError || !roles?.length) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assignment, error } = await supabaseAdmin
      .from("lead_distribution_assignments")
      .select("id, lead_delivery_contacts(name, email), distribution_lists(name)")
      .eq("lead_id", data.id)
      .maybeSingle();
    if (error) throw new Error("Unable to load assignment");
    return assignment;
  });

// --- BULK LEAD ACTIONS ---
export const bulkUpdateLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { ids: string[]; status?: string }) => i)
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    if (data.status) {
      const { error } = await supabaseAdmin.from("leads").update({ status: data.status as never }).in("id", data.ids);
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: data.ids.length };
  });

export const bulkDeleteLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { ids: string[] }) => i)
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("leads").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

// --- BACKFILL LEAD NOTIFICATION EMAILS ---
// Sends a notification email for every lead (partial or full) that has never
// had one sent (email_notified_at IS NULL). Idempotent.
export const backfillLeadNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { limit?: number } = {}) => i)
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { notifyLeadSubmission } = await import("@/lib/leads-notify.server");

    const limit = Math.min(Math.max(data?.limit ?? 200, 1), 500);
    const { data: rows, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .is("email_notified_at", null)
      .is("duplicate_of", null)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    const leads = (rows ?? []) as Array<Record<string, unknown>>;

    let sent = 0;
    let failed = 0;
    for (const lead of leads) {
      const id = lead.id as string;
      try {
        await notifyLeadSubmission(
          lead,
          `lead_${id}_backfill`,
          (lead.consent_ip as string) || null,
          (lead.consent_user_agent as string) || null,
          { force: true, skipCapi: true },
        );
        await supabaseAdmin
          .from("leads")
          .update({ email_notified_at: new Date().toISOString() } as never)
          .eq("id", id);
        sent += 1;
      } catch (e) {
        console.error("backfill notify failed", id, e);
        failed += 1;
      }
    }
    return { ok: true, scanned: leads.length, sent, failed };
  });

// --- RESEND SINGLE LEAD NOTIFICATION ---
export const resendLeadNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { notifyLeadSubmission } = await import("@/lib/leads-notify.server");
    const { data: lead, error } = await supabaseAdmin.from("leads").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("Lead not found");
    if (lead.duplicate_of || lead.status === "duplicate") {
      throw new Error("This is a duplicate submission. Resend the original lead instead.");
    }
    await notifyLeadSubmission(
      lead as Record<string, unknown>,
      `lead_${data.id}_resend_${Date.now()}`,
      ((lead as Record<string, unknown>).consent_ip as string) || null,
      ((lead as Record<string, unknown>).consent_user_agent as string) || null,
      { force: true, skipCapi: true },
    );
    await supabaseAdmin.from("leads").update({ email_notified_at: new Date().toISOString() } as never).eq("id", data.id);
    return { ok: true };
  });

// --- NOTIFICATION EMAIL RECIPIENTS ---
export const getNotificationEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "lead_notification_emails").maybeSingle();
    const list = Array.isArray(data?.value) ? (data!.value as string[]) : [];
    return { emails: list };
  });

export const setNotificationEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { emails: string[] }) => i)
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleaned = Array.from(new Set((data.emails || []).map((e) => e.trim().toLowerCase()).filter(Boolean)));
    if (cleaned.length > 10) throw new Error("Maximum 10 email addresses");
    for (const e of cleaned) if (!emailRe.test(e)) throw new Error(`Invalid email: ${e}`);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "lead_notification_emails", value: cleaned as never } as never, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true, emails: cleaned };
  });

// --- ADMIN CREATE LEAD (manual entry) ---
export const createLeadAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    first_name?: string; last_name?: string; email?: string; phone?: string;
    province?: string; vehicle_type?: string; credit_rating?: string;
    source?: string; status?: string; notes?: string;
  }) => ({ ...i, first_name: OptionalPersonNameSchema.parse(i.first_name), last_name: OptionalPersonNameSchema.parse(i.last_name) }))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const row = {
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      email: data.email || null,
      phone: data.phone || null,
      province: data.province || null,
      vehicle_type: data.vehicle_type || null,
      credit_rating: data.credit_rating || null,
      source: data.source || "manual",
      status: (data.status || "new") as never,
      extra: data.notes ? { admin_notes: data.notes } : null,
    };
    const { data: inserted, error } = await supabaseAdmin.from("leads").insert(row as never).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (inserted as { id: string }).id };
  });

// --- PURGE INCOMPLETE LEADS WITHOUT CONTACT INFO ---
// Removes abandoned funnel sessions: never submitted, no email and no phone.
// dryRun=true just counts them so the UI can confirm before deleting.
export const purgeContactlessLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { dryRun?: boolean; olderThanHours?: number } = {}) => i)
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);

    const hours = Math.max(0, data?.olderThanHours ?? 0);
    const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();

    const base = () =>
      supabaseAdmin
        .from("leads")
        .select("id", { count: "exact", head: !!data?.dryRun })
        .is("submitted_at", null)
        .or("email.is.null,email.eq.")
        .or("phone.is.null,phone.eq.")
        .lte("created_at", cutoff);

    if (data?.dryRun) {
      const { count, error } = await base();
      if (error) throw new Error(error.message);
      return { ok: true, count: count ?? 0, deleted: 0 };
    }

    const { data: rows, error } = await base();
    if (error) throw new Error(error.message);
    const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (!ids.length) return { ok: true, count: 0, deleted: 0 };

    // Clear dependent rows first so FK constraints don't block the delete.
    await supabaseAdmin.from("lead_notes").delete().in("lead_id", ids);
    await supabaseAdmin.from("lead_sends").delete().in("lead_id", ids);
    await supabaseAdmin.from("leads").update({ duplicate_of: null } as never).in("duplicate_of", ids);

    const { error: delErr } = await supabaseAdmin.from("leads").delete().in("id", ids);
    if (delErr) throw new Error(delErr.message);
    return { ok: true, count: ids.length, deleted: ids.length };
  });



// --- EMAIL EXPORT (sends CSV link / table to recipients) ---
export const emailLeadExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { ids: string[]; recipients: string[]; subject?: string }) => i)
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data: leads, error } = await supabaseAdmin
      .from("leads")
      .select("id, first_name, last_name, email, phone, province, vehicle_type, credit_rating, status, lead_score, source, created_at")
      .in("id", data.ids)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (leads ?? []) as LeadExportRow[];
    const headerRow = `<tr style="background:#0a1733;color:#fff;text-align:left">
      <th style="padding:8px">Name</th><th style="padding:8px">Email</th><th style="padding:8px">Phone</th>
      <th style="padding:8px">Province</th><th style="padding:8px">Vehicle</th><th style="padding:8px">Credit</th>
      <th style="padding:8px">Score</th><th style="padding:8px">Status</th><th style="padding:8px">Created</th>
    </tr>`;
    const dataRows = rows.map((l) => `<tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:8px">${escape(`${l.first_name ?? ""} ${l.last_name ?? ""}`.trim())}</td>
      <td style="padding:8px">${escape(l.email ?? "")}</td>
      <td style="padding:8px">${escape(l.phone ?? "")}</td>
      <td style="padding:8px">${escape(l.province ?? "")}</td>
      <td style="padding:8px">${escape(l.vehicle_type ?? "")}</td>
      <td style="padding:8px">${escape(l.credit_rating ?? "")}</td>
      <td style="padding:8px">${l.lead_score ?? ""}</td>
      <td style="padding:8px">${escape(l.status ?? "")}</td>
      <td style="padding:8px">${new Date(l.created_at).toLocaleString()}</td>
    </tr>`).join("");

    const html = `<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto">
      <h2 style="color:#0a1733">Auto World Approvals — Lead Export</h2>
      <p>Attached below are <strong>${rows.length}</strong> leads.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">${headerRow}${dataRows}</table>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">Exported ${new Date().toLocaleString()}</p>
    </div>`;

    const subject = data.subject || `Auto World Approvals — ${rows.length} lead export`;
    const sent = await sendViaResend(data.recipients, subject, html);
    return { ok: true, count: rows.length, sent };
  });

// --- USER / ROLE MANAGEMENT ---
export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data: roles, error } = await supabaseAdmin.from("user_roles").select("id, user_id, role, created_at").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const roleRows = (roles ?? []) as RoleRow[];
    if (!roleRows.length) return [];
    const ids = Array.from(new Set(roleRows.map((r) => r.user_id)));
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, email, full_name").in("id", ids);
    const byId = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
    return roleRows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      role: r.role,
      created_at: r.created_at,
      email: byId.get(r.user_id)?.email ?? "(unknown)",
      full_name: byId.get(r.user_id)?.full_name ?? null,
    }));
  });

export const inviteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string; role: Role }) => {
    if (!i.email.includes("@")) throw new Error("Invalid email");
    if (!ROLES.includes(i.role)) throw new Error("Invalid role");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { requireSuperadmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireSuperadmin(context.userId);

    // find existing user
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email.toLowerCase()).maybeSingle();

    let userId = profile?.id as string | undefined;
    if (!userId) {
      // invite via admin api
      const { data: inv, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
      if (invErr) throw new Error(invErr.message);
      userId = inv.user?.id;
    }
    if (!userId) throw new Error("Could not resolve user");

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role as never });
    if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);
    return { ok: true, user_id: userId };
  });

export const removeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { requireSuperadmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireSuperadmin(context.userId);
    const { error } = await supabaseAdmin.from("user_roles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Create a login for a CRM portal user (agent) or another staff role, with a password you set.
 *  `email` may be a real email address OR a plain username (no @). Usernames get a
 *  synthetic internal address so Supabase Auth is happy; sign-in resolves it back. */
export const createPortalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string; password: string; full_name?: string; role: Role }) => {
    const id = i.email.trim();
    if (id.includes("@")) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) throw new Error("Invalid email");
    } else if (!/^[a-z0-9._-]{3,40}$/i.test(id)) {
      throw new Error("Username must be 3-40 characters (letters, numbers, . _ -)");
    }
    OptionalPersonNameSchema.parse(i.full_name);
    if (i.password.length < 8) throw new Error("Password must be at least 8 characters");
    if (!ROLES.includes(i.role)) throw new Error("Invalid role");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { requireSuperadmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireSuperadmin(context.userId);
    const identifier = data.email.trim().toLowerCase();
    const isEmail = identifier.includes("@");
    const username = isEmail ? null : identifier;
    const email = isEmail ? identifier : `${identifier}@users.autoworldapprovals.com`;

    if (username) {
      const { data: taken } = await supabaseAdmin.from("profiles").select("id").ilike("username", username).maybeSingle();
      if (taken) throw new Error("That username is already taken");
    }

    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
    let userId = existing?.id as string | undefined;

    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name?.trim() || null },
      });
      if (error) throw new Error(error.message);
      userId = created.user?.id;
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: data.password });
      if (error) throw new Error(error.message);
    }
    if (!userId) throw new Error("Could not create user");

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email, username, full_name: data.full_name?.trim() || null } as never, { onConflict: "id" });


    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role as never });
    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) throw new Error(roleErr.message);

    return { ok: true, user_id: userId };
  });

/** Set a new password for an existing staff/portal user. */
export const setPortalUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string; password: string }) => {
    if (i.password.length < 8) throw new Error("Password must be at least 8 characters");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { requireSuperadmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireSuperadmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });



// --- helpers ---
function escape(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

async function sendViaResend(to: string[], subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to.length) return { skipped: true };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: settings } = await supabaseAdmin.from("app_settings").select("key, value").eq("key", "from_email").maybeSingle();
  const from = (settings?.value as string | undefined) || "Auto World Approvals <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Email failed: ${res.status}`);
  return { sent: true };
}

// --- FUNNEL REPORT ---
// Starts, completed applications and contactable leads by source and province.
// Test rows (preview traffic) are excluded so the numbers match real reports.
export const getFunnelReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { days?: number }) => i)
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "superadmin"]);
    if (roleError || !roles?.length) throw new Error("Forbidden");

    const days = typeof data.days === "number" && data.days > 0 ? Math.min(data.days, 365) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: leads, error } = await supabaseAdmin
      .from("leads")
      .select("id, source, province, submitted_at, first_name, phone, email, is_test, created_at")
      .gte("created_at", since)
      .neq("status", "duplicate");
    if (error) throw new Error(error.message);

    const { hasContactInfo } = await import("@/lib/crm-constants");
    const rows = (leads ?? []).filter((l) => !l.is_test);

    const tally = (list: typeof rows) => ({
      starts: list.length,
      completed: list.filter((l) => !!l.submitted_at).length,
      contactable: list.filter((l) => hasContactInfo(l as Record<string, unknown>)).length,
    });

    const group = (key: "source" | "province") => {
      const m = new Map<string, typeof rows>();
      for (const l of rows) {
        const k = (l[key] as string | null) || "Unknown";
        m.set(k, [...(m.get(k) ?? []), l]);
      }
      return [...m.entries()]
        .map(([k, list]) => ({ key: k, ...tally(list) }))
        .sort((a, b) => b.starts - a.starts);
    };

    return { days, totals: tally(rows), bySource: group("source"), byProvince: group("province") };
  });
