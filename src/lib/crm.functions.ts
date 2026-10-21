import { PersonNameSchema, OptionalPersonNameSchema } from "@/lib/name-validation";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasContactInfo } from "@/lib/crm-constants";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type CrmLeadRow = Record<string, JsonValue> & { id: string; created_at: string };

import { APPLICANT_FIELDS, buildApplicantEmailHtml, esc } from "@/lib/lead-share";
export { APPLICANT_FIELDS };


// ---------- session ----------
export const getCrmSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin, role } = await requireCrmUser(context.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      user_id: context.userId,
      role,
      email: (profile as { email?: string } | null)?.email ?? null,
      full_name: (profile as { full_name?: string } | null)?.full_name ?? null,
    };
  });

// ---------- leads ----------
export const listCrmLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    // Nothing is dropped server-side any more — anonymous in-progress funnel
    // rows are returned too, flagged so the UI can hide them behind a toggle.
    const rows = (data ?? []) as CrmLeadRow[];

    const owners = Array.from(
      new Set(rows.map((r) => r.assigned_to as string | null).filter(Boolean) as string[]),
    );
    let ownerMap = new Map<string, string>();
    if (owners.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, email, full_name").in("id", owners);
      ownerMap = new Map(
        ((profs ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>).map((p) => [
          p.id,
          p.full_name || p.email || "Unknown",
        ]),
      );
    }
    // Note counts + latest note timestamp, for the list preview.
    const { data: allNotes } = await supabaseAdmin
      .from("lead_notes")
      .select("lead_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    const noteCount = new Map<string, number>();
    const lastNoteAt = new Map<string, string>();
    for (const n of (allNotes ?? []) as Array<{ lead_id: string; created_at: string }>) {
      noteCount.set(n.lead_id, (noteCount.get(n.lead_id) ?? 0) + 1);
      if (!lastNoteAt.has(n.lead_id)) lastNoteAt.set(n.lead_id, n.created_at);
    }

    return rows.map((r) => ({
      ...r,
      is_anonymous: !hasContactInfo(r as unknown as Record<string, unknown>),
      owner_name: r.assigned_to ? (ownerMap.get(r.assigned_to as string) ?? null) : null,
      note_count: noteCount.get(r.id) ?? 0,
      last_note_at: lastNoteAt.get(r.id) ?? null,
    }));

  });


export const getCrmLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const { data: lead, error } = await supabaseAdmin.from("leads").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("Lead not found");

    const { data: notes } = await supabaseAdmin
      .from("lead_notes")
      .select("id, body, author_id, created_at")
      .eq("lead_id", data.id)
      .order("created_at", { ascending: false });
    const { data: sends } = await supabaseAdmin
      .from("lead_sends")
      .select("id, recipient_email, recipient_name, sent_by, sent_at")
      .eq("lead_id", data.id)
      .order("sent_at", { ascending: false });

    const ids = Array.from(
      new Set([
        ...((notes ?? []) as Array<{ author_id: string }>).map((n) => n.author_id),
        ...((sends ?? []) as Array<{ sent_by: string | null }>).map((s) => s.sent_by).filter(Boolean),
      ] as string[]),
    );
    let names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, email, full_name").in("id", ids);
      names = new Map(
        ((profs ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>).map((p) => [
          p.id,
          p.full_name || p.email || "Unknown",
        ]),
      );
    }

    return {
      lead: lead as CrmLeadRow,
      notes: ((notes ?? []) as Array<{ id: string; body: string; author_id: string; created_at: string }>).map((n) => ({
        ...n,
        author_name: names.get(n.author_id) ?? "Unknown",
      })),
      sends: ((sends ?? []) as Array<{
        id: string;
        recipient_email: string;
        recipient_name: string | null;
        sent_by: string | null;
        sent_at: string;
      }>).map((s) => ({ ...s, sender_name: s.sent_by ? (names.get(s.sent_by) ?? "Unknown") : "Unknown" })),
    };
  });

export const updateCrmLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { id: string; status?: string; assigned_to?: string | null; follow_up_date?: string | null }) => i,
  )
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status) {
      patch.status = data.status;
      if (!["draft", "partial", "new", "submitted"].includes(data.status)) {
        const { data: cur } = await supabaseAdmin
          .from("leads")
          .select("first_contacted_at")
          .eq("id", data.id)
          .maybeSingle();
        if (!(cur as { first_contacted_at?: string | null } | null)?.first_contacted_at) {
          patch.first_contacted_at = new Date().toISOString();
        }
      }
    }
    if (data.assigned_to !== undefined) patch.assigned_to = data.assigned_to;
    if (data.follow_up_date !== undefined) patch.follow_up_date = data.follow_up_date || null;
    const { error } = await supabaseAdmin.from("leads").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    // Phase 3 CRM outcomes: one internal outbox row per lead+outcome. Ad upload stays
    // held until Meta eligibility is documented (ad-policy.ts is fail-closed).
    const { crmOutcomeEvent } = await import("@/lib/crm-outcomes");
    const outcome = data.status ? crmOutcomeEvent(data.status) : null;
    if (outcome) {
      const { META_ELIGIBILITY_VERIFIED } = await import("@/lib/ad-policy");
      await supabaseAdmin.from("ad_conversion_log").upsert({
        event_id: `${outcome}_${data.id}`, lead_id: data.id, event_name: outcome,
        occurred_at: new Date().toISOString(),
        status: META_ELIGIBILITY_VERIFIED ? "pending" : "blocked",
      } as never, { onConflict: "event_id", ignoreDuplicates: true });
    }
    return { ok: true };

  });

/** Bulk-mark a set of leads as contacted (stamps first_contacted_at where missing). */
export const markCrmLeadsContacted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { ids: string[] }) => {
    if (!Array.isArray(i.ids) || !i.ids.length) throw new Error("No leads selected");
    return { ids: i.ids.slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const now = new Date().toISOString();

    const { data: rows } = await supabaseAdmin
      .from("leads")
      .select("id, first_contacted_at")
      .in("id", data.ids);
    const needsStamp = ((rows ?? []) as Array<{ id: string; first_contacted_at: string | null }>)
      .filter((r) => !r.first_contacted_at)
      .map((r) => r.id);

    const { error } = await supabaseAdmin
      .from("leads")
      .update({ status: "contacted", updated_at: now } as never)
      .in("id", data.ids);
    if (error) throw new Error(error.message);

    if (needsStamp.length) {
      await supabaseAdmin
        .from("leads")
        .update({ first_contacted_at: now } as never)
        .in("id", needsStamp);
    }

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "lead.bulk_contacted",
      entity: "leads",
      metadata: { count: data.ids.length } as never,
    } as never);

    return { ok: true, count: data.ids.length };
  });


export const deleteCrmLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);

    // Remove dependent rows first (FKs), then the lead itself.
    await supabaseAdmin.from("lead_notes").delete().eq("lead_id", data.id);
    await supabaseAdmin.from("lead_sends").delete().eq("lead_id", data.id);
    const { error } = await supabaseAdmin.from("leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "lead.delete",
      entity: "leads",
      entity_id: data.id,
    } as never);

    return { ok: true };
  });



export const addCrmNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { lead_id: string; body: string }) => {
    if (!i.body.trim()) throw new Error("Note cannot be empty");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const { error } = await supabaseAdmin
      .from("lead_notes")
      .insert({ lead_id: data.lead_id, author_id: context.userId, body: data.body.trim() } as never);
    if (error) throw new Error(error.message);
    const { refreshLeadNotesSummary } = await import("@/lib/crm-notes-summary.server");
    await refreshLeadNotesSummary(supabaseAdmin as never, data.lead_id);
    return { ok: true };
  });

export const deleteCrmNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin, role } = await requireCrmUser(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("lead_notes")
      .select("lead_id")
      .eq("id", data.id)
      .maybeSingle();
    let q = supabaseAdmin.from("lead_notes").delete().eq("id", data.id);
    if (role === "agent") q = q.eq("author_id", context.userId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    const leadId = (existing as { lead_id?: string } | null)?.lead_id;
    if (leadId) {
      const { refreshLeadNotesSummary } = await import("@/lib/crm-notes-summary.server");
      await refreshLeadNotesSummary(supabaseAdmin as never, leadId);
    }
    return { ok: true };
  });


// ---------- contacts library ----------
export const listCrmContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const { data, error } = await supabaseAdmin
      .from("crm_contacts")
      .select("id, name, email, company, created_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; name: string; email: string; company: string | null; created_at: string }>;
  });

export const saveCrmContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string; name: string; email: string; company?: string }) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email.trim())) throw new Error("Invalid email address");
    PersonNameSchema.parse(i.name);
    return i;
  })
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const row = {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      company: data.company?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("crm_contacts").update(row as never).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("crm_contacts")
      .insert({ ...row, created_by: context.userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (ins as { id: string }).id };
  });

export const deleteCrmContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const { error } = await supabaseAdmin.from("crm_contacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- send a lead (applicant info only) ----------
export const sendLeadToRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { lead_id: string; recipients: string[]; message?: string }) => {
    const cleaned = Array.from(new Set((i.recipients || []).map((e) => e.trim().toLowerCase()).filter(Boolean)));
    if (!cleaned.length) throw new Error("Add at least one recipient");
    if (cleaned.length > 10) throw new Error("Maximum 10 recipients at a time");
    for (const e of cleaned) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error(`Invalid email: ${e}`);
    return { ...i, recipients: cleaned };
  })
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const { data: lead, error } = await supabaseAdmin.from("leads").select("*").eq("id", data.lead_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("Lead not found");
    const l = lead as Record<string, unknown>;
    if (l.duplicate_of || l.status === "duplicate") {
      throw new Error("This is a duplicate submission. Send the original lead instead.");
    }

    const name = `${esc(l.first_name ?? "")} ${esc(l.last_name ?? "")}`.trim() || "Applicant";
    const { getLeadEmailAssignment } = await import("./lead-assignment.server");
    const { leadEmailTitle } = await import("./lead-email-status");
    const assignment = await getLeadEmailAssignment(data.lead_id);
    const html = buildApplicantEmailHtml(l, { message: data.message, ...assignment });


    const key = process.env["RESEND_API_KEY"];
    if (!key) throw new Error("Email service is not configured");
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "from_email")
      .maybeSingle();
    const from = ((settings as { value?: string } | null)?.value as string) || "Auto World Approvals <onboarding@resend.dev>";

    const subject = `${leadEmailTitle(l)} — ${name}`;
    let responseStatus = 500;
    let sent = false;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: data.recipients, subject, html }),
      });
      responseStatus = res.status;
      sent = res.ok;
    } catch { /* Persist only a fixed error, never a provider body or exception. */ }
    await supabaseAdmin.from("notification_log").insert(data.recipients.map((recipient) => ({
      lead_id: data.lead_id, kind: "manual_share", recipient, subject,
      status: sent ? "sent" : "failed", error: sent ? null : `Email provider HTTP ${responseStatus}`,
    })));
    if (!sent) throw new Error("Email delivery failed. Please try again.");

    await supabaseAdmin.from("lead_sends").insert(
      data.recipients.map((r) => ({ lead_id: data.lead_id, recipient_email: r, sent_by: context.userId })) as never,
    );
    return { ok: true, sent: data.recipients.length };
  });

// ---------- performance ----------
export const crmPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id, status, lead_score, source, attribution_channel, utm_source, utm_campaign, utm_medium, extra, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<Record<string, JsonValue>>;
  });

// ---------- automatic lead delivery ----------
export type DeliveryContact = {
  id: string;
  name: string | null;
  email: string;
  /** 'admin' = full internal lead copy, 'client' = applicant info only. */
  kind: "admin" | "client";
  is_active: boolean;
  is_first_contact: boolean;
  created_at: string;
  delivered_count: number;
  last_delivered_at: string | null;
};

export const listDeliverySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);

    const [{ data: contacts, error }, { data: setting }, { data: sends }] = await Promise.all([
      supabaseAdmin
        .from("lead_delivery_contacts")
        .select("id, name, email, kind, is_active, is_first_contact, created_at")
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("app_settings").select("value").eq("key", "auto_deliver_leads").maybeSingle(),
      supabaseAdmin
        .from("lead_sends")
        .select("lead_id, recipient_email, recipient_name, sent_at, leads!inner(duplicate_of)")
        .eq("recipient_name", "Auto delivery")
        .order("sent_at", { ascending: false })
        .limit(10000),
    ]);
    if (error) throw new Error(error.message);

    const uniqueSends = new Map<string, { recipient_email: string; sent_at: string }>();
    for (const s of (sends ?? []) as Array<{
      lead_id: string;
      recipient_email: string;
      sent_at: string;
      leads: { duplicate_of: string | null } | null;
    }>) {
      const email = (s.recipient_email || "").toLowerCase();
      const canonicalId = s.leads?.duplicate_of ?? s.lead_id;
      const key = `${canonicalId}|${email}`;
      if (!uniqueSends.has(key)) uniqueSends.set(key, { recipient_email: email, sent_at: s.sent_at });
    }
    const counts = new Map<string, number>();
    const last = new Map<string, string>();
    for (const s of uniqueSends.values()) {
      const key = (s.recipient_email || "").toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!last.has(key)) last.set(key, s.sent_at);
    }

    const rows = (contacts ?? []) as Array<Omit<DeliveryContact, "delivered_count" | "last_delivered_at">>;
    return {
      enabled: (setting as { value?: unknown } | null)?.value === true,
      total_delivered: uniqueSends.size,
      contacts: rows.map((c) => ({
        ...c,
        delivered_count: counts.get((c.email || "").toLowerCase()) ?? 0,
        last_delivered_at: last.get((c.email || "").toLowerCase()) ?? null,
      })) as DeliveryContact[],
    };
  });

/**
 * Set (or clear) the first-contact record on a lead. Also used to flip a lead
 * back to "uncontacted" without losing anything else.
 */
export const setLeadContactState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; contacted: boolean; first_contact_by?: string | null }) => i)
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.contacted) {
      const { data: cur } = await supabaseAdmin
        .from("leads")
        .select("status, first_contacted_at")
        .eq("id", data.id)
        .maybeSingle();
      const c = cur as { status?: string; first_contacted_at?: string | null } | null;
      if (["draft", "partial", "new", "submitted"].includes(String(c?.status ?? ""))) patch.status = "contacted";
      if (!c?.first_contacted_at) patch.first_contacted_at = new Date().toISOString();
      if (data.first_contact_by !== undefined) {
        patch.first_contact_by = data.first_contact_by || null;
        patch.first_contact_source = data.first_contact_by ? "manual" : null;
      }
    } else {
      patch.status = "new";
      patch.first_contacted_at = null;
      patch.first_contact_by = null;
      patch.first_contact_source = null;
    }

    const { error } = await supabaseAdmin.from("leads").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: data.contacted ? "lead.first_contact_set" : "lead.uncontacted",
      entity: "leads",
      entity_id: data.id,
      metadata: { first_contact_by: data.first_contact_by ?? null } as never,
    } as never);

    return { ok: true };
  });

export const addDeliveryContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string; name?: string; kind?: "admin" | "client" }) => {
    const email = (i.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
    return {
      email,
      name: OptionalPersonNameSchema.parse(i.name) || null,
      kind: i.kind === "admin" ? "admin" : "client",
    };
  })
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    // Unassigned contacts (no list) stay unique per email + kind; list members
    // are handled by the distribution screen, where one email may span lists.
    const { data: dupe } = await supabaseAdmin
      .from("lead_delivery_contacts")
      .select("id")
      .ilike("email", data.email)
      .eq("kind", data.kind)
      .is("list_id", null)
      .maybeSingle();
    if (dupe) {
      const { error } = await supabaseAdmin
        .from("lead_delivery_contacts")
        .update({ name: data.name, is_active: true } as never)
        .eq("id", (dupe as { id: string }).id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabaseAdmin
      .from("lead_delivery_contacts")
      .insert({ email: data.email, name: data.name, kind: data.kind, is_active: true, created_by: context.userId } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const updateDeliveryContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; is_active?: boolean; is_first_contact?: boolean }) => {
    if (i.is_active === undefined && i.is_first_contact === undefined) throw new Error("No change supplied");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    if (data.is_first_contact) {
      const { data: target, error: targetError } = await supabaseAdmin
        .from("lead_delivery_contacts")
        .select("list_id, kind")
        .eq("id", data.id)
        .single();
      if (targetError) throw new Error(targetError.message);
      const row = target as { list_id: string | null; kind: string } | null;
      if (!row?.list_id || row.kind !== "client") {
        throw new Error("Only a paying client inside a distribution list can be first contact");
      }
    }
    const patch: Record<string, boolean> = {};
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    if (data.is_first_contact !== undefined) patch.is_first_contact = data.is_first_contact;
    const { error } = await supabaseAdmin.from("lead_delivery_contacts").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.is_first_contact) {
      const { data: contact } = await supabaseAdmin
        .from("lead_delivery_contacts")
        .select("email, name")
        .eq("id", data.id)
        .maybeSingle();
      if (contact) {
        const label = contact.name ? `${contact.name} (${contact.email})` : contact.email;
        const { data: delivered } = await supabaseAdmin
          .from("lead_sends")
          .select("lead_id")
          .ilike("recipient_email", contact.email)
          .eq("recipient_name", "Auto delivery")
          .limit(20000);
        const ids = Array.from(new Set((delivered ?? []).map((row) => row.lead_id)));
        if (ids.length) {
          const now = new Date().toISOString();
          await supabaseAdmin
            .from("leads")
            .update({
              status: "contacted",
              first_contacted_at: now,
              first_contact_by: label,
              first_contact_source: "auto_delivery",
              updated_at: now,
            } as never)
            .in("id", ids)
            .is("duplicate_of", null)
            .in("status", ["draft", "partial", "new", "submitted"]);
        }
      }
    }
    return { ok: true };
  });

export const deleteDeliveryContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const { error } = await supabaseAdmin.from("lead_delivery_contacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAutoDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { enabled: boolean }) => ({ enabled: !!i.enabled }))
  .handler(async ({ data, context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "auto_deliver_leads", value: data.enabled, updated_by: context.userId } as never, {
        onConflict: "key",
      });
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });

// ---------- delivery counts per recipient / period ----------
export type LeadSendRow = {
  id: string;
  lead_id: string;
  canonical_lead_id: string;
  recipient_email: string;
  recipient_name: string | null;
  sent_at: string;
  kind: "admin" | "client" | "unknown";
  auto: boolean;
};

/**
 * Every lead delivery we've ever recorded (auto + manual sends), used by the
 * delivery scoreboard to count how many leads each recipient received per month.
 */
export const listLeadSends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireCrmUser } = await import("@/lib/crm-auth.server");
    const { supabaseAdmin } = await requireCrmUser(context.userId);

    const [{ data: sends, error }, { data: contacts }] = await Promise.all([
      supabaseAdmin
        .from("lead_sends")
        .select("id, lead_id, recipient_email, recipient_name, sent_at, leads!inner(duplicate_of)")
        .order("sent_at", { ascending: false })
        .limit(20000),
      supabaseAdmin.from("lead_delivery_contacts").select("email, name, kind"),
    ]);
    if (error) throw new Error(error.message);

    const meta = new Map<string, { name: string | null; kind: "admin" | "client" }>();
    for (const c of (contacts ?? []) as Array<{ email: string; name: string | null; kind: string }>) {
      meta.set((c.email || "").toLowerCase(), { name: c.name, kind: c.kind === "admin" ? "admin" : "client" });
    }

    return ((sends ?? []) as Array<{
      id: string;
      lead_id: string;
      recipient_email: string;
      recipient_name: string | null;
      sent_at: string;
      leads: { duplicate_of: string | null } | null;
    }>).map((s) => {
      const key = (s.recipient_email || "").toLowerCase();
      const m = meta.get(key);
      return {
        id: s.id,
        lead_id: s.lead_id,
        canonical_lead_id: s.leads?.duplicate_of ?? s.lead_id,
        recipient_email: key,
        recipient_name: m?.name ?? (s.recipient_name === "Auto delivery" ? null : s.recipient_name),
        sent_at: s.sent_at,
        kind: m?.kind ?? "unknown",
        auto: s.recipient_name === "Auto delivery",
      } satisfies LeadSendRow;
    });
  });
