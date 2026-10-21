import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listBlogPosts,
  deleteBlogPost,
  setBlogPostStatus,
  getBlogAutopilot,
  saveBlogAutopilot,
  type BlogAutopilot,
} from "@/lib/blog.functions";
import { enqueueJob } from "@/lib/jobs.functions";
import { useMyJobs } from "@/hooks/use-jobs";
import { Loader2, Sparkles, Trash2, ExternalLink, PenLine, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/blog/")({
  head: () => ({ meta: [{"title": "Blog & Resources | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals blog & resources area for authorized users."}, {"property": "og:title", "content": "Blog & Resources | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals blog & resources area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: BlogAdmin,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function BlogAdmin() {
  const listFn = useServerFn(listBlogPosts);
  const delFn = useServerFn(deleteBlogPost);
  const statusFn = useServerFn(setBlogPostStatus);
  const getCfg = useServerFn(getBlogAutopilot);
  const saveCfg = useServerFn(saveBlogAutopilot);
  const enqueue = useServerFn(enqueueJob);

  const { jobs } = useMyJobs({ limit: 15, notify: true });
  const activeBlogJobs = jobs.filter(
    (j) => j.kind.startsWith("blog_") && (j.status === "queued" || j.status === "running"),
  );

  const posts = useQuery({ queryKey: ["admin-blog-posts"], queryFn: () => listFn() });
  const cfgQuery = useQuery({ queryKey: ["blog-autopilot"], queryFn: () => getCfg() });

  const [cfg, setCfg] = useState<BlogAutopilot | null>(null);
  useEffect(() => {
    if (cfgQuery.data && !cfg) setCfg(cfgQuery.data as BlogAutopilot);
  }, [cfgQuery.data, cfg]);

  const [topic, setTopic] = useState("");
  const [direction, setDirection] = useState("");
  const [busy, setBusy] = useState(false);

  // Refresh the list whenever a blog job finishes.
  const finishedCount = jobs.filter((j) => j.kind.startsWith("blog_") && j.status === "succeeded").length;
  useEffect(() => {
    if (finishedCount) posts.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedCount]);

  const generate = async () => {
    setBusy(true);
    try {
      await enqueue({
        data: {
          kind: "blog_generate",
          label: topic.trim() ? `Blog: ${topic.trim().slice(0, 60)}` : "Blog: new AI article",
          input: {
            topic: topic.trim() || undefined,
            direction: direction.trim() || undefined,
            publish: false,
          },
        },
      });
      toast.success("Writing started — it'll appear here in a minute or two.");
      setTopic("");
      setDirection("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start generation");
    } finally {
      setBusy(false);
    }
  };

  const persistCfg = async (next: BlogAutopilot) => {
    setCfg(next);
    try {
      await saveCfg({
        data: {
          enabled: next.enabled,
          hour_local: next.hour_local,
          days: next.days,
          posts_per_run: next.posts_per_run,
          topics: next.topics,
          auto_publish: next.auto_publish,
          timezone: next.timezone ?? "America/Edmonton",
        },
      });
      toast.success("Schedule saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save schedule");
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Blog &amp; Resources</h1>
          <p className="text-sm text-muted-foreground">
            SEO articles about cars, credit and financing. Generate, edit, regenerate and schedule them here.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/blog" target="_blank" rel="noreferrer">
            View public page <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Generate now */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--electric)]" />
            <h2 className="font-bold">Write a new article</h2>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Topic (optional — AI picks one if blank)</Label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. What a 'soft' credit check really means in Canada"
              />
            </div>
            <div>
              <Label className="text-xs">Extra direction (optional)</Label>
              <Textarea
                rows={3}
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                placeholder="Tone, angle, must-cover points, target reader…"
              />
            </div>
            <Button onClick={generate} disabled={busy} className="w-full">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate article + cover photo
            </Button>
            {activeBlogJobs.length > 0 && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> {activeBlogJobs.length} generation
                {activeBlogJobs.length > 1 ? "s" : ""} in progress…
              </p>
            )}
          </div>
        </div>

        {/* Autopilot */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[var(--electric)]" />
              <h2 className="font-bold">Auto-pilot schedule</h2>
            </div>
            {cfg && (
              <Switch
                checked={cfg.enabled}
                onCheckedChange={(v) => persistCfg({ ...cfg, enabled: v })}
                aria-label="Enable auto-pilot"
              />
            )}
          </div>

          {cfg ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Time of day (Mountain time)</Label>
                  <Select
                    value={String(cfg.hour_local)}
                    onValueChange={(v) => setCfg({ ...cfg, hour_local: Number(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, h) => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Posts per run</Label>
                  <Select
                    value={String(cfg.posts_per_run)}
                    onValueChange={(v) => setCfg({ ...cfg, posts_per_run: Number(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Days</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {DAYS.map((d, i) => {
                    const on = cfg.days.includes(i);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          setCfg({
                            ...cfg,
                            days: on ? cfg.days.filter((x) => x !== i) : [...cfg.days, i].sort(),
                          })
                        }
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          on ? "bg-[var(--electric)] text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs">Standing direction for auto posts (optional)</Label>
                <Textarea
                  rows={2}
                  value={cfg.topics}
                  onChange={(e) => setCfg({ ...cfg, topics: e.target.value })}
                  placeholder="Focus on BC & Alberta buyers, practical money advice, no hype…"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={cfg.auto_publish}
                  onCheckedChange={(v) => setCfg({ ...cfg, auto_publish: v })}
                />
                Publish automatically (off = saved as draft for review)
              </label>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {cfg.last_run_at ? `Last run ${new Date(cfg.last_run_at).toLocaleString()}` : "Never run yet"}
                  {cfg.last_error ? ` — last error: ${cfg.last_error}` : ""}
                </p>
                <Button size="sm" onClick={() => persistCfg(cfg)}>Save schedule</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="mt-8">
        <h2 className="mb-3 font-bold">All articles ({posts.data?.length ?? 0})</h2>
        {posts.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !posts.data?.length ? (
          <p className="text-sm text-muted-foreground">No articles yet — generate your first one above.</p>
        ) : (
          <div className="grid gap-3">
            {posts.data.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
                {p.cover_image_url ? (
                  <img src={p.cover_image_url} alt={p.cover_alt ?? p.title} className="h-16 w-24 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-24 rounded-lg bg-muted" />
                )}
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={p.status === "published" ? "default" : "outline"}>
                      {p.status === "published" ? "Published" : "Draft"}
                    </Badge>
                    {p.category && <Badge variant="secondary">{p.category}</Badge>}
                    {p.auto_generated && <Badge variant="outline">Auto</Badge>}
                  </div>
                  <p className="mt-1 font-semibold leading-snug">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    /{p.slug} · {p.reading_minutes} min ·{" "}
                    {new Date(p.published_at ?? p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/admin/blog/$id" params={{ id: p.id }}>
                      <PenLine className="mr-1 h-3.5 w-3.5" /> Edit
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await statusFn({ data: { id: p.id, status: p.status === "published" ? "draft" : "published" } });
                      posts.refetch();
                    }}
                  >
                    {p.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      if (!confirm(`Delete "${p.title}"?`)) return;
                      await delFn({ data: { id: p.id } });
                      toast.success("Deleted");
                      posts.refetch();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
