// Generates a short "coles notes" AI summary of a lead's notes so the CRM list
// can show at a glance where the lead is at. Stored on leads.notes_summary.

type Admin = {
  from: (t: string) => any;
};

export async function refreshLeadNotesSummary(supabaseAdmin: Admin, leadId: string) {
  try {
    const { data: notes } = await supabaseAdmin
      .from("lead_notes")
      .select("body, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(25);

    const list = (notes ?? []) as Array<{ body: string; created_at: string }>;

    if (!list.length) {
      await supabaseAdmin
        .from("leads")
        .update({ notes_summary: null, notes_summary_at: new Date().toISOString() })
        .eq("id", leadId);
      return null;
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    const joined = list
      .slice()
      .reverse()
      .map((n) => `- [${new Date(n.created_at).toLocaleDateString()}] ${n.body}`)
      .join("\n")
      .slice(0, 6000);

    let summary = list[0].body.replace(/\s+/g, " ").slice(0, 140);

    if (apiKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You summarize auto-finance sales rep notes. Reply with ONE plain sentence (max 20 words), no quotes, no preamble. Capture the current state of the lead and the next step.",
            },
            { role: "user", content: `Notes (oldest first):\n${joined}` },
          ],
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const text = json.choices?.[0]?.message?.content?.trim();
        if (text) summary = text.replace(/^["'`]|["'`]$/g, "").slice(0, 220);
      } else {
        console.error("[notes-summary] AI error", res.status, await res.text());
      }
    }

    await supabaseAdmin
      .from("leads")
      .update({ notes_summary: summary, notes_summary_at: new Date().toISOString() })
      .eq("id", leadId);

    return summary;
  } catch (e) {
    console.error("[notes-summary] failed", e);
    return null;
  }
}
