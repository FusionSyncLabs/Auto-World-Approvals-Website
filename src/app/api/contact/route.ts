import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PersonNameSchema } from "@/lib/name-validation";

const ContactSchema = z.object({
  name: PersonNameSchema,
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(1).max(5000),
  recaptchaToken: z.string().optional(),
  turnstileToken: z.string().optional(),
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
    if (recaptchaSecret && recaptchaSecret !== "your_recaptcha_secret_key_here") {
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

    // Save to Supabase if service role key is available, otherwise log in dev mode
    const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (hasServiceRole) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("contact_messages")
        .insert({
          name: data.name,
          email: data.email,
          message: data.message,
          ip_address: ip,
          user_agent: userAgent,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[contact] error saving message", error);
        return NextResponse.json(
          { error: "Could not save your message. Please try again." },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, id: row?.id });
    } else {
      console.log("[contact] message received (saved in local dev mode):", {
        name: data.name,
        email: data.email,
        message: data.message,
        time: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, id: "dev-" + Date.now() });
    }
  } catch (err) {
    console.error("[contact] exception", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
