import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  identifier: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

/**
 * Sign in with either an email address or a username.
 * The username -> email lookup happens server-side so emails are never exposed.
 */
export const signInWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    let email = data.identifier.trim();

    if (!email.includes("@")) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .ilike("username", email)
        .maybeSingle();
      if (!profile?.email) return { error: "Invalid username or password" as const, session: null };
      email = profile.email;
    }

    const client = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: signIn, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error || !signIn.session) {
      return { error: "Invalid username or password" as const, session: null };
    }
    return {
      error: null,
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
    };
  });
