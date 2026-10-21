import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Download, Loader2, ImageIcon, Trash2, Wand2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  listSavedBanners,
  deleteSavedBanner,
  saveEditedBanner,
  BANNER_PLATFORMS,
  type BannerPlatform,
} from "@/lib/banners.functions";
import { enqueueJob } from "@/lib/jobs.functions";
import { useMyJobs } from "@/hooks/use-jobs";
import { BannerCanvasEditor, type BannerOverlays } from "@/components/admin/BannerCanvasEditor";
import { BannerPreview } from "@/components/admin/BannerPreviewOverlay";

export const Route = createFileRoute("/_authenticated/admin/banners/")({
  head: () => ({ meta: [{"title": "AI Banner Studio | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals ai banner studio area for authorized users."}, {"property": "og:title", "content": "AI Banner Studio | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals ai banner studio area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: BannerStudio,
});

type BannerResult = { id: string | null; b64?: string; url: string | null };
type SavedBanner = {
  id: string;
  label: string;
  platform: BannerPlatform | null;
  createdAt: string;
  url: string;
  overlays: BannerOverlays;
};

function BannerStudio() {
  const enqueue = useServerFn(enqueueJob);
  const list = useServerFn(listSavedBanners);
  const remove = useServerFn(deleteSavedBanner);
  const saveEdited = useServerFn(saveEditedBanner);
  const [platform, setPlatform] = useState<BannerPlatform>("facebook_cover");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: string | null; label: string; size: string; banner: BannerResult; overlays: BannerOverlays } | null>(null);
  const [saved, setSaved] = useState<SavedBanner[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [remixPrompts, setRemixPrompts] = useState<Record<string, string>>({});
  const [remixingId, setRemixingId] = useState<string | null>(null);
  const [resultRemixPrompt, setResultRemixPrompt] = useState("");
  const [editor, setEditor] = useState<{ url: string; title: string; fileName: string; overlays: BannerOverlays; label: string; platform: BannerPlatform | null } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await list();
      setSaved(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSaved(false);
    }
  }, [list]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh library + surface latest result whenever a banner job finishes
  const { jobs } = useMyJobs({ limit: 20 });
  const lastSeen = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    for (const j of jobs) {
      if (j.kind !== "banner_variations" && j.kind !== "banner_remix") continue;
      const prev = lastSeen.current.get(j.id);
      if (prev === j.status) continue;
      lastSeen.current.set(j.id, j.status);
      if (j.status === "succeeded" && j.result) {
        const r = j.result as { id?: string; label?: string; size?: string; url?: string; overlays?: BannerOverlays };
        if (r.id && r.url) {
          setResult({
            id: r.id,
            label: r.label ?? "Banner",
            size: r.size ?? "",
            banner: { id: r.id, b64: "", url: r.url },
            overlays: r.overlays ?? null,
          });
        }
        refresh();
      }
    }
  }, [jobs, refresh]);

  async function onGenerate() {
    setLoading(true);
    try {
      await enqueue({
        data: {
          kind: "banner_variations",
          label: `${BANNER_PLATFORMS[platform].label} banner`,
          input: { platform },
        },
      });
      toast.success("Queued — banner will appear here when ready. You can leave this page.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue banner");
    } finally {
      setLoading(false);
    }
  }

  async function onRemix(id: string, prompt: string) {
    if (!prompt.trim()) {
      toast.error("Enter a quick change to apply");
      return;
    }
    setRemixingId(id);
    try {
      await enqueue({
        data: {
          kind: "banner_remix",
          label: `Remix banner`,
          input: { id, prompt: prompt.trim() },
        },
      });
      setRemixPrompts((s) => ({ ...s, [id]: "" }));
      if (id === result?.id) setResultRemixPrompt("");
      toast.success("Queued — remix will appear here when ready.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remix failed to queue");
    } finally {
      setRemixingId(null);
    }
  }

  function downloadResult(b: BannerResult) {
    const href = b.b64 ? `data:image/png;base64,${b.b64}` : b.url ?? "";
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = `awa-${platform}-${Date.now()}.png`;
    a.click();
  }

  function downloadSaved(b: SavedBanner) {
    const a = document.createElement("a");
    a.href = b.url;
    a.download = `awa-${b.platform ?? "banner"}-${b.id}.png`;
    a.click();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this saved banner?")) return;
    const prev = saved;
    setSaved((s) => s.filter((b) => b.id !== id));
    try {
      await remove({ data: { id } });
      toast.success("Deleted");
    } catch (e) {
      setSaved(prev);
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-[var(--electric)]" /> AI Banner Studio
        </h1>
        <p className="text-sm text-muted-foreground">
          One click → one on-brand banner. Remix any banner with a quick prompt to fine-tune it.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="space-y-2">
            <Label>Platform</Label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(BANNER_PLATFORMS) as [BannerPlatform, typeof BANNER_PLATFORMS[BannerPlatform]][]).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlatform(key)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    platform === key
                      ? "border-[var(--electric)] bg-[var(--electric)]/10 text-foreground"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.size}</span>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={onGenerate} disabled={loading} className="w-full bg-electric-gradient text-white">
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating banner…</>
              : <><Sparkles className="mr-2 h-4 w-4" /> Generate on-brand banner</>}
          </Button>

          <p className="text-xs text-muted-foreground">
            The AI uses our brand brief and logo automatically. Use the remix box on any banner to tweak it without starting over.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          {!result && !loading && (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center text-muted-foreground">
              <ImageIcon className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">Your latest generated banner will appear here.</p>
            </div>
          )}
          {loading && (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center text-muted-foreground">
              <Loader2 className="mb-3 h-10 w-10 animate-spin text-[var(--electric)]" />
              <p className="text-sm">Crafting your on-brand banner… this can take 20–40 seconds.</p>
            </div>
          )}
          {result && (
            <div className="space-y-5">
              <div>
                <p className="font-semibold">{result.label}</p>
                <p className="text-xs text-muted-foreground">Target {result.size}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Latest generation</p>
                  <div className="flex gap-2">
                    {result.banner.url && (
                      <Button
                        onClick={() =>
                          setEditor({
                            url: result.banner.url!,
                            title: `Edit — ${result.label}`,
                            fileName: `awa-${platform}-edited-${Date.now()}.png`,
                            overlays: result.overlays ?? null,
                            label: `${result.label} (edited)`,
                            platform,
                          })
                        }
                        variant="outline"
                        size="sm"
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit in canvas
                      </Button>
                    )}
                    <Button onClick={() => downloadResult(result.banner)} variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" /> Download PNG
                    </Button>
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-soft">
                  <BannerPreview
                    src={result.banner.b64 ? `data:image/png;base64,${result.banner.b64}` : result.banner.url ?? ""}
                    alt={`${result.label}`}
                    overlays={result.overlays}
                  />
                </div>
              </div>

              {result.id && (
                <div className="space-y-2 rounded-lg border border-border bg-soft/50 p-3">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <Wand2 className="h-3.5 w-3.5" /> Remix this banner
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={resultRemixPrompt}
                      onChange={(e) => setResultRemixPrompt(e.target.value)}
                      placeholder='e.g. "make the headline bigger" or "warmer sunset tones"'
                      disabled={remixingId === result.id}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && result.id) onRemix(result.id, resultRemixPrompt);
                      }}
                    />
                    <Button
                      onClick={() => result.id && onRemix(result.id, resultRemixPrompt)}
                      disabled={remixingId === result.id || !resultRemixPrompt.trim()}
                      className="bg-electric-gradient text-white"
                    >
                      {remixingId === result.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <><Wand2 className="mr-2 h-4 w-4" /> Remix</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Banner library</h2>
            <p className="text-xs text-muted-foreground">
              Every generation is stored here for future use. {saved.length > 0 && `${saved.length} saved.`} Click <strong>Edit</strong> on any banner to open the canvas editor — add photos, move/resize them, and reposition text.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setEditor({ url: "", title: "Blank canvas", fileName: `awa-blank-${Date.now()}.png`, overlays: null, label: "Custom banner", platform: null })
            }
          >
            <Pencil className="mr-2 h-4 w-4" /> Blank canvas
          </Button>
        </div>
        {loadingSaved ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading library…
          </div>
        ) : saved.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <ImageIcon className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No banners yet — generate one above to start your library.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {saved.map((b) => {
              const prompt = remixPrompts[b.id] ?? "";
              const busy = remixingId === b.id;
              return (
                <div key={b.id} className="overflow-hidden rounded-lg border border-border bg-soft">
                  <BannerPreview src={b.url} alt={b.label} overlays={b.overlays} />
                  <div className="space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{b.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(b.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          onClick={() =>
                            setEditor({
                              url: b.url,
                              title: `Edit — ${b.label}`,
                              fileName: `awa-${b.platform ?? "banner"}-edited-${b.id}.png`,
                              overlays: b.overlays ?? null,
                              label: `${b.label} (edited)`,
                              platform: b.platform,
                            })
                          }
                          variant="outline"
                          size="icon"
                          title="Edit in canvas"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => downloadSaved(b)} variant="outline" size="icon" title="Download">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => onDelete(b.id)} variant="outline" size="icon" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={prompt}
                        onChange={(e) => setRemixPrompts((s) => ({ ...s, [b.id]: e.target.value }))}
                        placeholder="Quick fix prompt…"
                        disabled={busy}
                        className="h-9 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onRemix(b.id, prompt);
                        }}
                      />
                      <Button
                        onClick={() => onRemix(b.id, prompt)}
                        disabled={busy || !prompt.trim()}
                        size="sm"
                        className="bg-electric-gradient text-white"
                        title="Remix with AI"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BannerCanvasEditor
        open={!!editor}
        onOpenChange={(v) => { if (!v) setEditor(null); }}
        backgroundUrl={editor?.url || null}
        overlays={editor?.overlays ?? null}
        title={editor?.title}
        defaultFileName={editor?.fileName}
        onSave={async (dataUrl) => {
          if (!editor) return;
          await saveEdited({
            data: {
              label: editor.label,
              platform: editor.platform,
              dataBase64: dataUrl,
            },
          });
          toast.success("Saved to library");
          setEditor(null);
          refresh();
        }}
      />
    </AdminLayout>
  );
}
