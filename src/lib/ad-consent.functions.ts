import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { AD_NOTICE_TEXT, AD_NOTICE_VERSION } from "./ad-policy";

export const recordAdvertisingChoice = createServerFn({ method: "POST" })
  .inputValidator((i: { advertising: boolean; analytics: boolean }) => z.object({ advertising: z.boolean(), analytics: z.boolean() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = getCookie("awa_consent_visitor");
    const visitor = existing && z.string().uuid().safeParse(existing).success ? existing : crypto.randomUUID();
    setCookie("awa_consent_visitor", visitor, { httpOnly: true, secure: getRequestHeader("x-forwarded-proto") === "https", sameSite: "lax", path: "/", maxAge: 31536000 });
    const region = getRequestHeader("cf-ipcountry") || "UNKNOWN";
    const { data: record, error } = await supabaseAdmin.from("advertising_consent_records").insert({
      visitor_token: visitor, advertising: data.advertising, analytics: data.analytics,
      region, notice_version: AD_NOTICE_VERSION, notice_text: AD_NOTICE_TEXT,
    }).select("id").single();
    if (error || !record) throw new Error("Your privacy choice could not be recorded. Optional advertising stays off.");
    return { id: record.id };
  });