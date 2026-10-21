import { emailProviderFailure } from "./privacy-telemetry";
import { applicantName, buildApplicantEmailHtml, buildFullLeadEmailHtml } from "@/lib/lead-share";
import { getLeadEmailAssignment } from "./lead-assignment.server";
import { leadEmailTitle } from "./lead-email-status";

/**
 * Automatically deliver a brand-new lead to the configured delivery contacts.
 *
 * Two separate lists:
 *  - kind = 'admin'  → full internal copy (applicant data + marketing /
 *                      attribution / CRM data). Auto World Approvals staff only.
 *  - kind = 'client' → applicant-provided information only. Never any
 *                      campaign, ad, tracking or internal data.
 */
export async function autoDeliverLead(
  lead: Record<string, unknown>,
  opts: { keepStatus?: boolean } = {},
) {
  if (lead.is_test) return { delivered: 0, reason: "test-lead" };
  if (lead.duplicate_of || lead.status === "duplicate") {
    return { delivered: 0, reason: "duplicate-lead" };
  }
  const key = process.env["RESEND_API_KEY"];
  if (!key) return { delivered: 0, reason: "no-email-key" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", ["from_email"]);
  const m = Object.fromEntries((settings ?? []).map((s) => [s.key, s.value]));
  // Auto delivery is per-contact: any contact toggled on receives new leads.

  type Contact = {
    id: string;
    email: string;
    name: string | null;
    kind: string | null;
    list_id: string | null;
  };

  const { data: contacts } = await supabaseAdmin
    .from("lead_delivery_contacts")
    .select("id, email, name, kind, list_id")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const active = ((contacts ?? []) as unknown as Contact[]).filter((c) => !!c.email);

  // Distribution lists: leads are alternated (round robin) between the
  // recipients of the list whose geography best matches the applicant.
  type DList = {
    id: string;
    name: string;
    provinces: string[] | null;
    cities: string[] | null;
    mode: string;
    marks_contacted: boolean;
    priority: number;
  };
  const { data: listRows } = await supabaseAdmin
    .from("distribution_lists")
    .select("id, name, provinces, cities, mode, marks_contacted, priority")
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  const dlists = ((listRows ?? []) as unknown as DList[]).filter((l) =>
    active.some((c) => c.list_id === l.id && c.kind !== "admin"),
  );

  const norm = (v: unknown) =>
    String(v ?? "")
      .trim()
      .toLowerCase();

  // Province matching must survive spelling variants ("BC" vs "British
  // Columbia") and leads that haven't reached the address step yet — in that
  // case the postal code, then the phone area code, tells us the province.
  const PROV_CODE: Record<string, string> = {
    bc: "bc",
    "b.c.": "bc",
    "british columbia": "bc",
    "colombie-britannique": "bc",
    ab: "ab",
    alta: "ab",
    alberta: "ab",
    sk: "sk",
    sask: "sk",
    saskatchewan: "sk",
    mb: "mb",
    manitoba: "mb",
    yt: "yt",
    yukon: "yt",
    nt: "nt",
    nwt: "nt",
    "northwest territories": "nt",
    nu: "nu",
    nunavut: "nu",
  };
  const provCode = (v: unknown): string => PROV_CODE[norm(v)] ?? norm(v);

  const { normalizePhone } = await import("@/lib/phone");
  const BC_CODES = new Set(["236", "250", "257", "604", "672", "778"]);
  const AB_CODES = new Set(["368", "403", "587", "780", "825"]);
  const inferredProv = (): string => {
    const direct = provCode(lead.province);
    if (direct) return direct;
    const pc = norm(lead.postal_code).replace(/\s/g, "");
    if (pc.startsWith("v")) return "bc";
    if (pc.startsWith("t")) return "ab";
    const area = normalizePhone(String(lead.phone ?? "")).slice(0, 3);
    if (BC_CODES.has(area)) return "bc";
    if (AB_CODES.has(area)) return "ab";
    return "";
  };

  const leadCity = norm(lead.city);
  const leadProv = inferredProv();
  const matchList = (): DList | null => {
    const byCity = dlists.find((l) =>
      (l.cities ?? []).some((c) => norm(c) === leadCity && !!leadCity),
    );
    if (byCity) return byCity;
    const byProv = dlists.find((l) =>
      (l.provinces ?? []).some((p) => provCode(p) === leadProv && !!leadProv),
    );
    if (byProv) return byProv;
    // Catch-all list (no geography set) wins next.
    const catchAll = dlists.find((l) => !(l.cities ?? []).length && !(l.provinces ?? []).length);
    if (catchAll) return catchAll;
    // No geographic match at all (e.g. out-of-province applicant, or the lead
    // has no address yet): never drop the lead — fall back to the highest
    // priority active list so every lead still gets distributed.
    return dlists[0] ?? null;
  };


  const chosenList = matchList();

  // Recipients: admin and unassigned contacts receive informational copies.
  // Exactly one paying client from the matched list owns and receives the lead.
  const listMembers: Contact[] = [];
  let rotatedContactId: string | null = null;
  if (chosenList) {
    const members = active.filter((c) => c.list_id === chosenList.id && c.kind !== "admin");
    // Claim one recipient atomically per lead. Autosave, final submit, and
    // recovery jobs may overlap, but the database preserves the first owner.
    const leadId = typeof lead.id === "string" ? lead.id : null;
    if (leadId) {
      const { data: assignedId, error: assignmentError } = await supabaseAdmin.rpc(
        "assign_rotation_contact",
        { _list_id: chosenList.id, _lead_id: leadId },
      );
      if (assignmentError) {
        console.error("[auto-deliver] rotation assignment failed", assignmentError.message);
      } else {
        const picked = members.find((c) => c.id === assignedId) ?? null;
        if (picked) {
          rotatedContactId = picked.id;
          listMembers.push(picked);
        } else if (assignedId) {
          console.error("[auto-deliver] assigned contact is not an active member of the matched list", assignedId);
        }
      }
    }
  }

  const list = [...active.filter((c) => c.kind === "admin" || !c.list_id), ...listMembers];
  if (!list.length) return { delivered: 0, reason: "no-contacts" };

  // Who the rotation actually assigned this lead to. Named in every client
  // email (even copies sent to other recipients) so ownership is unambiguous.
  const assignedContact: Contact | null = rotatedContactId
    ? (listMembers.find((c) => c.id === rotatedContactId) ?? null)
    : null;
  const ownerFor = (contact: Contact) => {
    return {
      isAssigned: !!assignedContact && contact.id === assignedContact.id,
      name: assignedContact?.name ?? null,
      email: assignedContact?.email ?? null,
    };
  };

  const from =
    (typeof m.from_email === "string" && m.from_email) ||
    "Auto World Approvals <onboarding@resend.dev>";
  const name = applicantName(lead);
  const title = leadEmailTitle(lead);
  const emailSubject = `${title} — ${name}`;
  const assignment = await getLeadEmailAssignment(String(lead.id));
  const adminHtml = buildFullLeadEmailHtml(lead, { heading: emailSubject, ...assignment });

  // Send one email per recipient. A single multi-recipient send can be dropped
  // wholesale by a provider (and leaks recipients to each other), so each
  // contact gets their own message.
  //
  // Duplicates: concurrent autosaves and the safety-net sweep can try to
  // deliver the same lead at the same moment, so we CLAIM the delivery row
  // first. A unique index on (lead_id, lower(recipient_email)) where
  // recipient_name = 'Auto delivery' makes the claim atomic — whoever loses
  // the race simply skips. If the send then fails, the claim is released so a
  // later run can retry.
  const delivered: string[] = [];
  let firstContactRecipient: (typeof list)[number] | null = null;
  for (const contact of list) {
    const recipient = String(contact.email);
    const isAdmin = contact.kind === "admin";

    // Admin copies are claimed under their own name so an internal address can
    // also exist as a client recipient without one send blocking the other,
    // and they are never counted as a client distribution.
    const { data: claim, error: claimError } = await supabaseAdmin
      .from("lead_sends")
      .insert({
        lead_id: lead.id as string,
        recipient_email: recipient,
        recipient_name: isAdmin ? "Admin copy" : "Auto delivery",
        excluded_from_count: isAdmin,
      } as never)
      .select("id")
      .single();
    if (claimError || !claim) continue; // already claimed/delivered by another run


    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `lead_${lead.id}_${isAdmin ? "admin_copy" : "client_delivery"}_${contact.id}` },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject: emailSubject,
          html: isAdmin
            ? adminHtml
            : buildApplicantEmailHtml(lead, {
                heading: emailSubject,
                recipientName: contact.name,
                ...assignment,
                recipientIsAssigned: ownerFor(contact).isAssigned,
              }),
        }),
      });
      if (!res.ok) {
        console.error("[auto-deliver] send failed", res.status);
        await supabaseAdmin.from("notification_log").insert({
          lead_id: lead.id as string,
          kind: isAdmin ? "admin_copy" : "client_delivery",
          recipient,
          subject: emailSubject,
          status: "failed",
          error: emailProviderFailure(res.status),
        } as never);
        await supabaseAdmin
          .from("lead_sends")
          .delete()
          .eq("id", (claim as { id: string }).id);
        continue;
      }
      await supabaseAdmin.from("notification_log").insert({
        lead_id: lead.id as string,
        kind: isAdmin ? "admin_copy" : "client_delivery",
        recipient,
        subject: emailSubject,
        status: "sent",
        error: null,
      } as never);
      delivered.push(recipient);
      // Only the paying client atomically assigned by the matching list can
      // own first contact. Admin and unassigned copies are informational.
      if (
        !firstContactRecipient &&
        !!chosenList?.marks_contacted &&
        !!rotatedContactId &&
        contact.id === rotatedContactId
      ) {
        firstContactRecipient = contact;
      }
    } catch (e) {
      console.error("[auto-deliver] email provider request failed");
      await supabaseAdmin.from("notification_log").insert({ lead_id: String(lead.id), kind: isAdmin ? "admin_copy" : "client_delivery", recipient, status: "failed", error: "Email provider request failed; queued for recovery" });
      await supabaseAdmin
        .from("lead_sends")
        .delete()
        .eq("id", (claim as { id: string }).id);
    }
  }
  if (!delivered.length) return { delivered: 0, reason: "already-delivered-or-failed" };

  // The lead is logged as contacted against the client recipient it was
  // routed to, so the portal always shows who received it and when.

  const now = new Date().toISOString();
  const firstLabel = firstContactRecipient
    ? firstContactRecipient.name
      ? `${firstContactRecipient.name} (${firstContactRecipient.email})`
      : firstContactRecipient.email
    : null;
  const status = String((lead.status as string) ?? "");
  const patch: Record<string, unknown> = { updated_at: now };
  // Mid-funnel leads keep their draft/partial status so the applicant can
  // still resume and finish the application.
  if (firstContactRecipient && ["draft", "partial", "new", "submitted"].includes(status)) {
    patch.status = "contacted";
  }
  if (firstContactRecipient && !lead.first_contacted_at) {
    patch.first_contacted_at = now;
    patch.first_contact_by = firstLabel;
    patch.first_contact_source = "auto_delivery";
  }
  await supabaseAdmin
    .from("leads")
    .update(patch as never)
    .eq("id", lead.id as string);

  return { delivered: delivered.length };
}

/**
 * Deliver a mid-funnel (draft/partial) lead as soon as it has usable contact
 * details, so partial applications don't sit in the CRM undelivered.
 */
export async function autoDeliverPartialLead(lead: Record<string, unknown> | null | undefined) {
  if (!lead) return { delivered: 0, reason: "no-lead" };
  if (lead.is_test) return { delivered: 0, reason: "test-lead" };
  const status = String((lead.status as string) ?? "");
  if (!["draft", "partial", "contacted"].includes(status) || lead.submitted_at) {
    return { delivered: 0, reason: "not-partial" };
  }
  const name = String(lead.first_name ?? "").trim();
  const email = String(lead.email ?? "").trim();
  // Minimum viable lead: a name, a callable BC/AB mobile number AND a valid
  // email. An email alone is never enough — every lead must be phoneable.
  const { isValidNanpNumber } = await import("@/lib/phone");
  const phoneOk = isValidNanpNumber(String(lead.phone ?? ""));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !phoneOk || !emailOk) return { delivered: 0, reason: "no-contact" };

  // Contact details are only ever stored after the applicant has been shown the
  // contact-consent notice in the funnel, so a missing consent flag (autosave
  // wrote the fields before the consent stamp landed) must not strand a lead.
  // Delivery is still limited to applicant-supplied information.
  return autoDeliverLead(lead, { keepStatus: true });
}
