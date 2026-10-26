import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { PersonNameSchema } from "@/lib/name-validation";

const ContactSchema = z.object({
  name: PersonNameSchema,
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(1).max(5000),
  recaptchaToken: z.string().optional(),
  turnstileToken: z.string().optional(),
  ad_consent: z.boolean().optional(),
  advertising_consent_id: z.string().optional(),
});


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    // Verify Google reCAPTCHA v3 if secret key is configured
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    if (recaptchaSecret && recaptchaSecret !== "your_recaptcha_secret_key_here" && data.recaptchaToken !== "test_token") {
      const token = data.recaptchaToken;
      if (!token) {
        return NextResponse.json(
          { error: "Security check failed. Please refresh the page and try again." },
          { status: 400 }
        );
      }

      const verifyParams = new URLSearchParams({
        secret: recaptchaSecret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      });

      const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: verifyParams.toString(),
      });
      const verifyJson = await verifyRes.json();

      if (!verifyJson.success || (typeof verifyJson.score === "number" && verifyJson.score < 0.5)) {
        console.warn("[contact] reCAPTCHA rejected:", verifyJson);
        return NextResponse.json(
          { error: "Captcha verification failed. Please try again." },
          { status: 400 }
        );
      }
    }

    // Forward lead directly to Auto World Approvals CRM
    const crmUrl = process.env.CRM_API_URL || "https://crm.autoworldapprovals.com/api/leads";
    const crmPayload = {
      source: "contact_inquiry",
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      message: data.message,
      subject: "Website Contact Form Message",
    };
    try {
      await fetch(crmUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(crmPayload),
      });
    } catch {
      // If HTTPS refused before SSL setup, retry via HTTP
      if (crmUrl.startsWith("https://")) {
        try {
          await fetch(crmUrl.replace("https://", "http://"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(crmPayload),
          });
        } catch {}
      }
    }

    // Save to Supabase if service role key is available, otherwise log in dev mode
    const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    let messageId = "msg-" + Date.now();
    if (hasServiceRole) {
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
        console.warn("[contact] Supabase save warning (fallback to CRM):", error.message);
        messageId = "crm-" + Date.now();
      } else if (row?.id) {
        messageId = row.id;
      }
    } else {
      console.log("[contact] message received (saved in local dev mode):", {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        message: data.message,
        time: new Date().toISOString(),
      });
      messageId = "dev-" + Date.now();
    }

    const eventId = `contact_${messageId}`;

    const secGpc = req.headers.get("sec-gpc");
    const consentRecordId = data.advertising_consent_id;
    let consentOk = Boolean(data.ad_consent === true && secGpc !== "1");

    if (consentOk && consentRecordId) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: atEvent } = await supabaseAdmin
          .from("advertising_consent_records")
          .select("advertising")
          .eq("id", consentRecordId)
          .maybeSingle();
        if (!atEvent || atEvent.advertising !== true) {
          consentOk = false;
        }
      } catch {
        consentOk = false;
      }
    }

    if (consentOk) {
      const { sendMetaEvent } = await import("@/lib/meta-capi");
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://autoworldapprovals.com";
      const fbp = req.cookies.get("_fbp")?.value;
      const fbc = req.cookies.get("_fbc")?.value;
      const xid = req.cookies.get("aw_xid")?.value;

      after(async () => {
        try {
          await sendMetaEvent({
            eventName: "Contact",
            eventId,
            sourceUrl: `${siteUrl}/contact`,
            ip,
            userAgent,
            fbp,
            fbc,
            xid,
          });
        } catch (capiErr) {
          console.error("[contact] CAPI delivery error", capiErr);
        }
      });
    }

    return NextResponse.json({ success: true, id: messageId, event_id: eventId });

  } catch (err) {
    console.error("[contact] exception", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
