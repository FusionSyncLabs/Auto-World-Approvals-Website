import { NextResponse } from "next/server";
import { z } from "zod";
import { AD_NOTICE_TEXT, AD_NOTICE_VERSION } from "@/lib/ad-policy";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const schema = z.object({
  advertising: z.boolean(),
  analytics: z.boolean(),
});

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { advertising, analytics } = parsed.data;
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/awa_consent_visitor=([^;]+)/);
    const existing = match ? match[1] : undefined;
    const visitor = existing && z.string().uuid().safeParse(existing).success ? existing : crypto.randomUUID();

    const region = req.headers.get("cf-ipcountry") || "UNKNOWN";
    const supabase = getAdminClient();

    let recordId = crypto.randomUUID();
    if (supabase) {
      const { data, error } = await supabase
        .from("advertising_consent_records")
        .insert({
          visitor_token: visitor,
          advertising,
          analytics,
          region,
          notice_version: AD_NOTICE_VERSION,
          notice_text: AD_NOTICE_TEXT,
        })
        .select("id")
        .maybeSingle();

      if (!error && data?.id) {
        recordId = data.id;
      }
    }

    const res = NextResponse.json({ id: recordId });
    const isHttps = req.headers.get("x-forwarded-proto") === "https";
    res.cookies.set("awa_consent_visitor", visitor, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 31536000,
    });

    return res;
  } catch (err) {
    console.error("[api/ad-consent] error", err);
    return NextResponse.json({ error: "Consent could not be recorded" }, { status: 500 });
  }
}
