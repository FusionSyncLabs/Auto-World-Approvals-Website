import { createFileRoute } from "@tanstack/react-router";

/**
 * Hourly cron hook (pg_cron). Generates scheduled blog articles when the
 * configured local hour/day matches and it hasn't already run today.
 */
export const Route = createFileRoute("/api/public/hooks/blog-autopilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let force = false;
        try {
          const body = (await request.json()) as { force?: boolean };
          force = body?.force === true;
        } catch {
          /* empty body is fine */
        }

        const { data: settingRow } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "blog_autopilot")
          .maybeSingle();

        const cfg = {
          enabled: false,
          hour_local: 9,
          days: [1, 3, 5] as number[],
          posts_per_run: 1,
          topics: "",
          auto_publish: true,
          timezone: "America/Edmonton",
          last_run_at: null as string | null,
          ...((settingRow?.value as Record<string, unknown>) ?? {}),
        };

        if (!cfg.enabled && !force) return new Response("disabled", { status: 200 });

        const tz = (cfg.timezone as string) || "America/Edmonton";
        const now = new Date();
        const fmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          hour12: false,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          weekday: "short",
        });
        const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
        const localDate = `${parts.year}-${parts.month}-${parts.day}`;
        const localHour = Number(parts.hour);
        const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const localDow = weekdayMap[String(parts.weekday)] ?? 0;

        if (!force) {
          const days = Array.isArray(cfg.days) ? (cfg.days as number[]) : [];
          if (days.length && !days.includes(localDow)) return new Response("not today", { status: 200 });
          if (localHour !== Number(cfg.hour_local)) return new Response("not the hour", { status: 200 });
          const last = cfg.last_run_at ? new Date(cfg.last_run_at as string) : null;
          if (last) {
            const lastLocal = new Intl.DateTimeFormat("en-CA", {
              timeZone: tz,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })
              .format(last)
              .replace(/\//g, "-");
            if (lastLocal === localDate) return new Response("already ran today", { status: 200 });
          }
        }

        // Claim the slot immediately so a retry can't double-post.
        await supabaseAdmin
          .from("app_settings")
          .upsert(
            {
              key: "blog_autopilot",
              value: { ...cfg, last_run_at: now.toISOString(), last_error: null } as never,
              updated_at: now.toISOString(),
            },
            { onConflict: "key" },
          );

        const count = Math.min(3, Math.max(1, Number(cfg.posts_per_run) || 1));
        const created: string[] = [];
        let lastError: string | null = null;

        try {
          const { runBlogGenerate } = await import("@/lib/blog-gen.server");
          for (let i = 0; i < count; i++) {
            try {
              const res = await runBlogGenerate(
                {
                  direction: (cfg.topics as string) || undefined,
                  publish: cfg.auto_publish !== false,
                  userId: null,
                },
                supabaseAdmin,
              );
              created.push(res.slug);
            } catch (e) {
              lastError = e instanceof Error ? e.message : String(e);
              console.error("[blog-autopilot] generation failed", lastError);
            }
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }

        if (lastError) {
          await supabaseAdmin
            .from("app_settings")
            .upsert(
              {
                key: "blog_autopilot",
                value: { ...cfg, last_run_at: now.toISOString(), last_error: lastError.slice(0, 500) } as never,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "key" },
            );
        }

        return new Response(JSON.stringify({ created, error: lastError }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
