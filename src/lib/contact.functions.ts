import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { PersonNameSchema } from "@/lib/name-validation";

const ContactSchema = z.object({
  name: PersonNameSchema,
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(1).max(5000),
  turnstileToken: z.string().min(10, "Captcha required"),
});

export type ContactInput = z.infer<typeof ContactSchema>;

async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Fail closed: never accept submissions without server-side verification.
  if (!secret) {
    console.error("[contact] TURNSTILE_SECRET_KEY not set — rejecting submission");
    return false;
  }
  if (!token) return false;
  try {
    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const json = (await res.json()) as { success?: boolean };
    return !!json.success;
  } catch (e) {
    console.error("[contact] turnstile verify error", e);
    return false;
  }
}

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: ContactInput) => ContactSchema.parse(input))
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) || null;
    const userAgent = getRequestHeader("user-agent") || null;

    const ok = await verifyTurnstile(data.turnstileToken, ip);
    if (!ok) throw new Error("Captcha verification failed. Please try again.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("contact_messages")
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        message: data.message,
        ip_address: ip,
        user_agent: userAgent,
      } as any)
      .select("id")
      .single();
    if (error) {
      console.error("[contact] insert error", error);
      throw new Error("Could not send your message. Please try again.");
    }

    // Fire-and-forget email notification
    try {
      await sendContactNotification(data);
    } catch (e) {
      console.error("[contact] email error", e);
    }

    return { id: (row as { id: string }).id };
  });

async function sendContactNotification(data: ContactInput) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log("[contact] RESEND_API_KEY not set — skipping notification email");
    return;
  }
  const to = "admin@autoworldapprovals.com";
  const from = "Auto World Approvals <onboarding@resend.dev>";
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const subject = `New contact message from ${data.name}`;
  const safeMsg = esc(data.message).replace(/\n/g, "<br/>");
  const safeName = esc(data.name);
  const safeEmail = esc(data.email);
  const safePhone = data.phone ? esc(data.phone) : null;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 12px;color:#0F1B3D">New contact form message</h2>
      <p style="margin:0 0 16px;color:#475569">Submitted via autoworldapprovals.com</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#64748b;width:120px">Name</td><td style="padding:6px 0;font-weight:600">${safeName}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Email</td><td style="padding:6px 0;font-weight:600"><a href="mailto:${safeEmail}" style="color:#2D7BFF">${safeEmail}</a></td></tr>
        ${safePhone ? `<tr><td style="padding:6px 0;color:#64748b">Phone</td><td style="padding:6px 0;font-weight:600"><a href="tel:${safePhone}" style="color:#2D7BFF">${safePhone}</a></td></tr>` : ""}
      </table>
      <div style="margin-top:18px;padding:16px;background:#f8fafc;border-radius:8px;border-left:3px solid #2D7BFF">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:8px">Message</div>
        <div style="white-space:pre-wrap;line-height:1.6">${safeMsg}</div>
      </div>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: data.email,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error("[contact] resend error", res.status, await res.text());
  }
}

// --- Admin: list & mark read ---
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdminClient(userId: string) {
  const { requireAdmin } = await import("@/lib/admin-auth.server");
  return requireAdmin(userId);
}

export const listContactMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdminClient(context.userId);
    const { data, error } = await supabaseAdmin
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setContactMessageRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; isRead: boolean }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdminClient(context.userId);
    const { error } = await supabaseAdmin
      .from("contact_messages")
      .update({ is_read: data.isRead, read_at: data.isRead ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContactMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdminClient(context.userId);
    const { error } = await supabaseAdmin.from("contact_messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
