import { OptionalPersonNameSchema } from "@/lib/name-validation";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DistributionList = {
  id: string;
  name: string;
  description: string | null;
  provinces: string[];
  cities: string[];
  mode: "round_robin" | "all";
  marks_contacted: boolean;
  is_active: boolean;
  priority: number;
  last_assigned_contact_id: string | null;
  next_contact_id: string | null;
  created_at: string;
};

export type DistributionMember = {
  id: string;
  name: string | null;
  email: string;
  kind: "admin" | "client";
  is_active: boolean;
  is_first_contact: boolean;
  list_id: string | null;
  rotation_order: number;
  created_at: string;
  delivered_count: number;
};

async function requireDistributionAdmin(userId: string) {
  const { requireCrmUser } = await import("@/lib/crm-auth.server");
  const { supabaseAdmin, role } = await requireCrmUser(userId);
  if (role !== "admin" && role !== "superadmin") throw new Error("Forbidden: admins only");
  return supabaseAdmin;
}

export type DeliveryRange = "this_month" | "last_30" | "last_7" | "this_year" | "all";

/** Start of the window for delivered counts (null = all time). */
function rangeStart(range: DeliveryRange): string | null {
  const now = new Date();
  if (range === "all") return null;
  if (range === "this_month") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  if (range === "this_year") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  const days = range === "last_7" ? 7 : 30;
  return new Date(now.getTime() - days * 86400000).toISOString();
}

export const listDistribution = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i?: { range?: DeliveryRange }) => ({ range: (i?.range ?? "this_month") as DeliveryRange }))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    const since = rangeStart(data.range);

    let sendsQuery = supabaseAdmin
      .from("lead_sends")
      .select("recipient_email")
      .eq("recipient_name", "Auto delivery")
      .eq("excluded_from_count", false)
      .limit(20000);
    if (since) sendsQuery = sendsQuery.gte("sent_at", since);


    const [{ data: lists, error }, { data: contacts }, { data: sends }] = await Promise.all([
      supabaseAdmin
        .from("distribution_lists")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("lead_delivery_contacts")
        .select("id, name, email, kind, is_active, is_first_contact, list_id, rotation_order, created_at")
        .order("rotation_order", { ascending: true })
        .order("created_at", { ascending: true }),
      sendsQuery,
    ]);

    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const s of (sends ?? []) as Array<{ recipient_email: string }>) {
      const k = (s.recipient_email || "").toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    return {
      lists: (lists ?? []) as unknown as DistributionList[],
      members: ((contacts ?? []) as unknown as Omit<DistributionMember, "delivered_count">[]).map((c) => ({
        ...c,
        delivered_count: counts.get((c.email || "").toLowerCase()) ?? 0,
      })) as DistributionMember[],
    };
  });

export const upsertDistributionList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      name: string;
      description?: string | null;
      provinces?: string[];
      cities?: string[];
      mode?: "round_robin" | "all";
      marks_contacted?: boolean;
      is_active?: boolean;
      priority?: number;
    }) => {
      const name = (i.name || "").trim();
      if (!name) throw new Error("Give the distribution list a name");
      const clean = (arr?: string[]) =>
        Array.from(new Set((arr ?? []).map((v) => v.trim()).filter(Boolean))).slice(0, 100);
      return {
        id: i.id,
        name: name.slice(0, 120),
        description: (i.description || "").trim().slice(0, 400) || null,
        provinces: clean(i.provinces),
        cities: clean(i.cities),
        // Automatic distribution always assigns one paying client per lead.
        mode: "round_robin" as const,
        marks_contacted: i.marks_contacted !== false,
        is_active: i.is_active !== false,
        priority: Number.isFinite(i.priority) ? Number(i.priority) : 0,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    const row = { ...data, created_by: context.userId };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("distribution_lists")
        .update(row as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await supabaseAdmin
      .from("distribution_lists")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (created as { id: string }).id };
  });

export const deleteDistributionList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    const { error } = await supabaseAdmin.from("distribution_lists").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Move a delivery contact into (or out of) a distribution list. */
export const assignContactToList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { contact_id: string; list_id: string | null; rotation_order?: number }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    const patch: Record<string, unknown> = { list_id: data.list_id };
    if (data.rotation_order !== undefined) patch.rotation_order = data.rotation_order;
    const { error } = await supabaseAdmin
      .from("lead_delivery_contacts")
      .update(patch as never)
      .eq("id", data.contact_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reorder the rotation inside a list. */
export const setRotationOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { ids: string[] }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    for (let i = 0; i < data.ids.length; i++) {
      await supabaseAdmin
        .from("lead_delivery_contacts")
        .update({ rotation_order: i } as never)
        .eq("id", data.ids[i]!);
    }
    return { ok: true };
  });

/** Add a brand new recipient straight into a list. */
export const addListContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string; name?: string; list_id: string | null; kind?: "admin" | "client" }) => {
    const email = (i.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
    return {
      email,
      name: OptionalPersonNameSchema.parse(i.name) || null,
      list_id: i.list_id ?? null,
      kind: i.kind === "admin" ? ("admin" as const) : ("client" as const),
    };
  })
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    // The same email may belong to several lists (one person covering multiple
    // areas), but never twice inside the same list.
    let existing = supabaseAdmin
      .from("lead_delivery_contacts")
      .select("id")
      .ilike("email", data.email)
      .eq("kind", data.kind);
    existing = data.list_id ? existing.eq("list_id", data.list_id) : existing.is("list_id", null);
    const { data: dupe } = await existing.maybeSingle();
    if (dupe) {
      const { error } = await supabaseAdmin
        .from("lead_delivery_contacts")
        .update({ name: data.name, is_active: true } as never)
        .eq("id", (dupe as { id: string }).id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabaseAdmin.from("lead_delivery_contacts").insert({
      email: data.email,
      name: data.name,
      kind: data.kind,
      list_id: data.list_id,
      is_active: true,
      created_by: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const setListContactActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; is_active: boolean }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("lead_delivery_contacts")
      .update({ is_active: data.is_active } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove a delivery recipient entirely. */
export const deleteListContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    const { error } = await supabaseAdmin.from("lead_delivery_contacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Designate (or clear) a recipient as the first point of contact.
 * Only one recipient can hold this at a time, so setting a new one
 * atomically clears whoever held it before instead of colliding with
 * the uniqueness rule.
 */
export const setFirstContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; is_first_contact: boolean }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    if (data.is_first_contact) {
      // First point of contact only exists inside a distribution list — it is
      // the recipient the rotation currently hands the lead to. Admin and
      // unassigned recipients receive every lead, so "first" is meaningless
      // for them and would silently mark leads contacted.
      const { data: target, error: targetError } = await supabaseAdmin
        .from("lead_delivery_contacts")
        .select("list_id, kind")
        .eq("id", data.id)
        .single();
      if (targetError) throw new Error(targetError.message);
      const t = target as { list_id: string | null; kind: string } | null;
      if (!t?.list_id || t.kind === "admin") {
        throw new Error(
          "First point of contact can only be set on a recipient inside a distribution list. Create a list and move this recipient into it first.",
        );
      }
      const { error: clearError } = await supabaseAdmin
        .from("lead_delivery_contacts")
        .update({ is_first_contact: false } as never)
        .eq("is_first_contact", true)
        .neq("id", data.id);
      if (clearError) throw new Error(clearError.message);
    }

    const { error } = await supabaseAdmin
      .from("lead_delivery_contacts")
      .update({ is_first_contact: data.is_first_contact } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/**
 * Pin who the next lead in this list should go to. Passing null clears the
 * pin and lets the normal rotation continue. The pin is consumed once, then
 * alternating resumes from that recipient.
 */
export const setNextContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { list_id: string; contact_id: string | null }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    if (data.contact_id) {
      const { data: c, error: cErr } = await supabaseAdmin
        .from("lead_delivery_contacts")
        .select("list_id, is_active, kind")
        .eq("id", data.contact_id)
        .single();
      if (cErr) throw new Error(cErr.message);
      const row = c as { list_id: string | null; is_active: boolean; kind: string } | null;
      if (!row || row.list_id !== data.list_id) throw new Error("That recipient is not in this list");
      if (row.kind !== "client") throw new Error("Only a paying client can receive the next lead");
      if (!row.is_active) throw new Error("That recipient is paused — turn them back on first");
    }
    const { error } = await supabaseAdmin
      .from("distribution_lists")
      .update({ next_contact_id: data.contact_id } as never)
      .eq("id", data.list_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ContactDelivery = {
  id: string;
  lead_id: string;
  sent_at: string;
  excluded_from_count: boolean;
  exclusion_reason: string | null;
  lead_name: string;
  lead_email: string | null;
  lead_phone: string | null;
  lead_city: string | null;
  lead_province: string | null;
};

/** Deliveries sent to one recipient in the selected window, for count auditing. */
export const listContactDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { contact_id: string; range?: DeliveryRange }) => ({
    contact_id: i.contact_id,
    range: (i.range ?? "this_month") as DeliveryRange,
  }))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    const { data: contact, error: cErr } = await supabaseAdmin
      .from("lead_delivery_contacts")
      .select("email, name")
      .eq("id", data.contact_id)
      .single();
    if (cErr) throw new Error(cErr.message);
    const email = ((contact as { email: string }).email || "").toLowerCase();

    const since = rangeStart(data.range);
    let q = supabaseAdmin
      .from("lead_sends")
      .select("id, lead_id, sent_at, excluded_from_count, exclusion_reason")
      .eq("recipient_name", "Auto delivery")
      .ilike("recipient_email", email)
      .order("sent_at", { ascending: false })
      .limit(500);
    if (since) q = q.gte("sent_at", since);
    const { data: sends, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (sends ?? []) as Array<{
      id: string; lead_id: string; sent_at: string; excluded_from_count: boolean; exclusion_reason: string | null;
    }>;
    const leadIds = Array.from(new Set(rows.map((r) => r.lead_id)));
    const leadMap = new Map<string, Record<string, string | null>>();
    if (leadIds.length) {
      const { data: leads } = await supabaseAdmin
        .from("leads")
        .select("id, first_name, last_name, email, phone, city, province")
        .in("id", leadIds);
      for (const l of (leads ?? []) as Array<Record<string, string | null>>) leadMap.set(l.id as string, l);
    }

    const deliveries: ContactDelivery[] = rows.map((r) => {
      const l = leadMap.get(r.lead_id) ?? {};
      return {
        id: r.id,
        lead_id: r.lead_id,
        sent_at: r.sent_at,
        excluded_from_count: !!r.excluded_from_count,
        exclusion_reason: r.exclusion_reason,
        lead_name: `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "Unnamed lead",
        lead_email: l.email ?? null,
        lead_phone: l.phone ?? null,
        lead_city: l.city ?? null,
        lead_province: l.province ?? null,
      };
    });

    return {
      contact: { id: data.contact_id, email, name: (contact as { name: string | null }).name },
      deliveries,
      counted: deliveries.filter((d) => !d.excluded_from_count).length,
    };
  });

/** Include or exclude a single delivery from the recipient's lead count. */
export const setDeliveryCounted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { send_id: string; counted: boolean; reason?: string | null }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("lead_sends")
      .update({
        excluded_from_count: !data.counted,
        exclusion_reason: data.counted ? null : ((data.reason || "").trim().slice(0, 200) || "Marked as a fake lead"),
      } as never)
      .eq("id", data.send_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Flat list of every saved lead delivery contact, for one-off sends. */
export const listDeliveryContactsFlat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireDistributionAdmin(context.userId);
    const [{ data: contacts, error }, { data: lists }] = await Promise.all([
      supabaseAdmin
        .from("lead_delivery_contacts")
        .select("id, name, email, kind, is_active, list_id")
        .order("name", { ascending: true }),
      supabaseAdmin.from("distribution_lists").select("id, name"),
    ]);
    if (error) throw new Error(error.message);
    const listName = new Map((lists ?? []).map((l) => [l.id as string, l.name as string]));
    return (contacts ?? []).map((c) => ({
      id: c.id as string,
      name: (c.name as string | null) ?? null,
      email: c.email as string,
      kind: c.kind as "admin" | "client",
      is_active: c.is_active as boolean,
      list_name: c.list_id ? listName.get(c.list_id as string) ?? null : null,
    }));
  });
