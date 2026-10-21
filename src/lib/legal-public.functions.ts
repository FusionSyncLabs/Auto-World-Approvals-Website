import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Public read of a legal document by slug. Uses the publishable key
 * (anon role). The legal_documents table has a `select to anon` policy,
 * so this is safe.
 */
export const getPublicLegalDoc = createServerFn({ method: "GET" })
  .inputValidator((i: { slug: string }) => i)
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    const supabase = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: row } = await supabase
      .from("legal_documents")
      .select("slug, title, body_md, effective_date, updated_at")
      .eq("slug", data.slug)
      .maybeSingle();
    return row;
  });
