import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Megaphone, Upload, Trash2, Loader2, Sparkles, ImageIcon, Wand2, Download, X,
  Target, User, Layers, Check, Pencil, Repeat,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAdAssets,
  uploadAdLibraryImage,
  deleteAdAsset,
  saveEditedAd,
  suggestAdCreativeDirection,
  reapplyAdTemplate,
  AD_SIZES,
  type AdAsset,
  type AdSizeKey,
} from "@/lib/ad-studio.functions";
import { enqueueJob, cancelJob } from "@/lib/jobs.functions";
import { useMyJobs } from "@/hooks/use-jobs";
import { BannerCanvasEditor, type BannerOverlays } from "@/components/admin/BannerCanvasEditor";



export const Route = createFileRoute("/_authenticated/admin/ad-studio/")({
  head: () => ({ meta: [{"title": "Ad Studio | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals ad studio area for authorized users."}, {"property": "og:title", "content": "Ad Studio | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals ad studio area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: AdStudio,
});

function AdStudio() {
  const list = useServerFn(listAdAssets);
  const upload = useServerFn(uploadAdLibraryImage);
  const remove = useServerFn(deleteAdAsset);
  const enqueue = useServerFn(enqueueJob);
  const cancel = useServerFn(cancelJob);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function onCancelJob(id: string) {
    setCancellingId(id);
    try {
      await cancel({ data: { id } });
      toast.success("Cancelled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setCancellingId(null);
    }
  }
  const saveEdited = useServerFn(saveEditedAd);
  const suggest = useServerFn(suggestAdCreativeDirection);
  const reapply = useServerFn(reapplyAdTemplate);


  const [refs, setRefs] = useState<AdAsset[]>([]);
  const [clients, setClients] = useState<AdAsset[]>([]);
  const [ads, setAds] = useState<AdAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(new Set());
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());

  const [sizes, setSizes] = useState<Set<AdSizeKey>>(new Set<AdSizeKey>(["square_1x1"]));
  const [prompt, setPrompt] = useState("");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [queuing, setQueuing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const [remixPrompts, setRemixPrompts] = useState<Record<string, string>>({});
  const [remixingId, setRemixingId] = useState<string | null>(null);

  const [reuseSource, setReuseSource] = useState<AdAsset | null>(null);
  const [reusePicked, setReusePicked] = useState<string | null>(null);
  const [reusing, setReusing] = useState(false);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    url: string;
    title: string;
    fileName: string;
    overlays: BannerOverlays;
    label: string;
    size: AdSizeKey | null;
  } | null>(null);


  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c, a] = await Promise.all([
        list({ data: { kind: "ad_competitor_ref" } }),
        list({ data: { kind: "ad_client_photo" } }),
        list({ data: { kind: "ad_generated" } }),
      ]);
      setRefs(r); setClients(c); setAds(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => { refresh(); }, [refresh]);

  // Refresh ads whenever a relevant job finishes
  const { jobs } = useMyJobs({ limit: 20 });
  const lastSeen = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    for (const j of jobs) {
      if (j.kind !== "ad_generate" && j.kind !== "ad_remix") continue;
      const prev = lastSeen.current.get(j.id);
      if (prev === j.status) continue;
      lastSeen.current.set(j.id, j.status);
      if (j.status === "succeeded") refresh();
      if (j.status === "failed") toast.error(`Ad generation failed: ${j.error ?? "unknown error"}`);
    }
  }, [jobs, refresh]);

  async function handleUpload(
    kind: "ad_competitor_ref" | "ad_client_photo",
    file: File,
  ) {
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const b64 = btoa(binary);
      await upload({
        data: {
          kind,
          label: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
          mime: file.type || "image/jpeg",
          data_base64: b64,
        },
      });
      toast.success("Uploaded");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this image?")) return;
    try {
      await remove({ data: { id } });
      setRefs((s) => s.filter((r) => r.id !== id));
      setClients((s) => s.filter((r) => r.id !== id));
      setAds((s) => s.filter((r) => r.id !== id));
      setSelectedRefIds((s) => { const n = new Set(s); n.delete(id); return n; });
      setSelectedClientIds((s) => { const n = new Set(s); n.delete(id); return n; });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function onGenerate() {
    if (sizes.size === 0) {
      toast.error("Pick at least one ad size");
      return;
    }
    setQueuing(true);
    try {
      const sizeList = Array.from(sizes);
      await Promise.all(sizeList.map((sz) =>
        enqueue({
          data: {
            kind: "ad_generate",
            label: `Ad — ${AD_SIZES[sz].label}`,
            input: {
              size: sz,
              prompt: prompt.trim(),
              competitorRefIds: Array.from(selectedRefIds),
              clientPhotoIds: Array.from(selectedClientIds),
              includeLogo,
            },
          },
        })
      ));
      const noPhoto = selectedClientIds.size === 0;
      toast.success(
        sizeList.length === 1
          ? noPhoto
            ? "Queued — generating a car-only ad in your brand style. It'll appear in the library when it's ready."
            : "Queued — your ad will appear in the library when it's ready. You can leave this page."
          : `Queued ${sizeList.length} ads — they'll appear in the library as each one finishes. You can leave this page.`,
      );
      setPrompt("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue");
    } finally {
      setQueuing(false);
    }
  }

  async function onSuggest() {
    setSuggesting(true);
    try {
      const r = await suggest({ data: { vibe: prompt.trim() } });
      setPrompt(r.suggestion);
      toast.success("Fresh direction generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suggest failed");
    } finally {
      setSuggesting(false);
    }
  }

  async function onRemix(id: string) {
    const p = (remixPrompts[id] ?? "").trim();
    if (!p) { toast.error("Enter what you want to change"); return; }
    setRemixingId(id);
    try {
      await enqueue({
        data: {
          kind: "ad_remix",
          label: "Ad remix",
          input: { id, prompt: p },
        },
      });
      setRemixPrompts((s) => ({ ...s, [id]: "" }));
      toast.success("Remix queued — new version will appear above.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue remix");
    } finally {
      setRemixingId(null);
    }
  }

  function openReuse(a: AdAsset) {
    setReuseSource(a);
    // Prefill with the first currently-selected client photo, if any
    const first = selectedClientIds.values().next().value as string | undefined;
    setReusePicked(first ?? null);
  }

  async function confirmReuse() {
    if (!reuseSource) return;
    setReusing(true);
    try {
      await reapply({
        data: {
          sourceId: reuseSource.id,
          clientPhotoIds: reusePicked ? [reusePicked] : [],
        },
      });
      toast.success(
        reusePicked
          ? "Queued — the re-applied ad with your selected photo will appear in the library when it's ready."
          : "Queued — a car-only ad in the same brand style will appear in the library when it's ready.",
      );
      setReuseSource(null);
      setReusePicked(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reuse template");
    } finally {
      setReusing(false);
    }
  }

  function download(a: AdAsset) {
    const link = document.createElement("a");
    link.href = a.url;
    link.download = `${a.label.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}-${a.id}.png`;
    link.click();
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Megaphone className="h-6 w-6 text-[var(--electric)]" /> Ad Studio
        </h1>
        <p className="text-sm text-muted-foreground">
          Feed competitor ads as style references, drop in real client photos, and the AI composes a polished ad in our brand — keeping the client's face untouched. Generated ads live in the library; remix any of them with a prompt.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          {/* LEFT — libraries + studio */}
          <div className="space-y-6">
            {/* COMPETITOR REFS */}
            <LibrarySection
              icon={<Target className="h-4 w-4 text-[var(--electric)]" />}
              title="Competitor / inspiration ads"
              subtitle="The AI studies layout, lighting, and overlay design from these (it never copies their branding)."
              accept="image/png,image/jpeg,image/webp"
              onUpload={(f) => handleUpload("ad_competitor_ref", f)}
              items={refs}
              selectedIds={selectedRefIds}
              onToggleSelect={(id) =>
                setSelectedRefIds((s) => {
                  const n = new Set(s);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  return n;
                })
              }
              onDelete={onDelete}
              onPreview={(u) => setLightboxUrl(u)}
              emptyHint="Upload screenshots of ads whose style you want to match."
            />

            {/* CLIENT PHOTOS */}
            <LibrarySection
              icon={<User className="h-4 w-4 text-[var(--electric)]" />}
              title="Client photos"
              subtitle="Real client photos. Used as the full-bleed background of the ad — the AI lays brand chrome, logo, and copy on top while preserving the person and vehicle."
              accept="image/png,image/jpeg,image/webp"
              onUpload={(f) => handleUpload("ad_client_photo", f)}
              items={clients}
              selectedIds={selectedClientIds}
              onToggleSelect={(id) =>
                setSelectedClientIds((s) => {
                  const n = new Set(s);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  return n;
                })
              }
              onDelete={onDelete}
              onPreview={(u) => setLightboxUrl(u)}
              emptyHint="Upload high-quality portrait-style photos of happy clients."
            />

            {/* GENERATED LIBRARY */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              {(() => {
                const pendingJobs = jobs.filter(
                  (j) =>
                    (j.kind === "ad_generate" || j.kind === "ad_remix") &&
                    (j.status === "queued" || j.status === "running"),
                );
                return (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="flex items-center gap-2 font-semibold">
                          <Layers className="h-4 w-4 text-[var(--electric)]" /> Generated ads ({ads.length})
                          {pendingJobs.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[17px] font-semibold text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" /> {pendingJobs.length} generating
                            </span>
                          )}
                        </h2>
                        <p className="text-xs text-muted-foreground">Every generation and every remix is saved here. Remix any of them below.</p>
                      </div>
                    </div>
                    {ads.length === 0 && pendingJobs.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                        <Sparkles className="mx-auto mb-2 h-6 w-6 opacity-40" />
                        No ads yet — pick references + client photos on the right, then generate your first one.
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {pendingJobs.map((j) => (
                          <div
                            key={`pending-${j.id}`}
                            className="overflow-hidden rounded-xl border border-dashed border-[var(--electric)]/60 bg-soft"
                          >
                            <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-muted via-card to-muted">
                              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                              <div className="relative z-10 flex flex-col items-center gap-2 text-center">
                                <Loader2 className="h-7 w-7 animate-spin text-[var(--electric)]" />
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  {j.status === "running" ? "Generating…" : "Queued"}
                                </p>
                              </div>
                            </div>
                            <div className="p-3">
                              <p className="truncate text-sm font-semibold" title={j.label}>{j.label}</p>
                              <p className="text-[17px] uppercase tracking-wider text-muted-foreground">
                                {j.kind === "ad_remix" ? "Remix" : "New ad"} · {new Date(j.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                              </p>
                              <p className="mt-2 text-[17px] leading-snug text-muted-foreground">
                                You can leave this page — it'll show up here automatically when it's ready.
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 h-7 w-full text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => onCancelJob(j.id)}
                                disabled={cancellingId === j.id}
                              >
                                {cancellingId === j.id
                                  ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Cancelling…</>
                                  : <><X className="mr-1 h-3 w-3" /> Cancel</>}
                              </Button>
                            </div>
                          </div>
                        ))}
                        {ads.map((a) => (
                    <div key={a.id} className="overflow-hidden rounded-xl border border-border bg-soft">
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(a.url)}
                        className="block w-full overflow-hidden bg-muted"
                      >
                        <img src={a.url} alt={a.label} loading="lazy" className="block w-full" />
                        {/* overlays are baked into the saved PNG — no BannerPreview SVG layer */}
                      </button>
                      <div className="p-3">
                        <p className="truncate text-sm font-semibold" title={a.label}>{a.label}</p>
                        <p className="text-[17px] uppercase tracking-wider text-muted-foreground">
                          {AD_SIZES[(a.platform as AdSizeKey) ?? "square_1x1"]?.label ?? a.platform}
                        </p>
                        <div className="mt-2 flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditor({
                              url: a.url,
                              title: `Edit — ${a.label}`,
                              fileName: `awa-ad-${a.platform ?? "ad"}-${a.id}.png`,
                              overlays: (a.overlays as BannerOverlays) ?? null,
                              label: `${a.label} (edited)`,
                              size: (a.platform as AdSizeKey) ?? null,
                            })}
                            className="flex-1"
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openReuse(a)} title="Reuse this template with different client photos">
                            <Repeat className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => download(a)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onDelete(a.id)} className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-card p-2">
                          <Label className="flex items-center gap-1 text-[17px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <Wand2 className="h-3 w-3" /> Remix
                          </Label>
                          <Input
                            value={remixPrompts[a.id] ?? ""}
                            onChange={(e) => setRemixPrompts((s) => ({ ...s, [a.id]: e.target.value }))}
                            placeholder='e.g. "warmer sunset lighting" or "bigger headline"'
                            className="h-8 text-xs"
                            onKeyDown={(e) => { if (e.key === "Enter") onRemix(a.id); }}
                            disabled={remixingId === a.id}
                          />
                          <Button
                            size="sm"
                            onClick={() => onRemix(a.id)}
                            disabled={remixingId === a.id || !(remixPrompts[a.id] ?? "").trim()}
                            className="h-7 w-full bg-electric-gradient text-white text-xs"
                          >
                            {remixingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Queue remix</>}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* RIGHT — generator panel */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4 text-[var(--electric)]" /> New ad
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Powered by Gemini 3 Pro Image — best-in-class for compositing real photos with designed text overlays.
              </p>

              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Ad sizes (pick one or more)</Label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(Object.entries(AD_SIZES) as [AdSizeKey, typeof AD_SIZES[AdSizeKey]][]).map(([k, v]) => {
                      const active = sizes.has(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setSizes((s) => {
                            const n = new Set(s);
                            if (n.has(k)) n.delete(k); else n.add(k);
                            return n;
                          })}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                            active ? "border-[var(--electric)] bg-[var(--electric)]/10" : "border-border hover:bg-accent"
                          }`}
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${active ? "border-[var(--electric)] bg-[var(--electric)] text-white" : "border-border"}`}>
                              {active && <Check className="h-3 w-3" />}
                            </span>
                            {v.label}
                          </span>
                          <span className="text-muted-foreground">{v.spec}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[17px] text-muted-foreground">
                    One ad is queued per selected size — they all run concurrently.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Creative direction (optional)</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={onSuggest}
                      disabled={suggesting}
                      className="h-6 gap-1 px-2 text-[17px]"
                      title="Generate an AI creative direction — current events, pop culture, humour"
                    >
                      {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                      Suggest
                    </Button>
                  </div>
                  <Textarea
                    rows={5}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder='Leave blank to use our brand defaults — or click Suggest for an on-trend, witty, culturally-aware direction.'
                  />
                  <p className="text-[17px] text-muted-foreground">
                    If left blank, the AI uses our brand aesthetic. Otherwise this flavours the scene.
                  </p>
                </div>

                <label className="flex items-start gap-2 rounded-lg border border-border bg-soft p-3 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLogo}
                    onChange={(e) => setIncludeLogo(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--electric)]"
                  />
                  <span>
                    <span className="font-semibold">Include our logo</span>
                    <span className="block text-muted-foreground">
                      The official AWA logo is composited into the ad by the AI. Turn off for an unbranded version.
                    </span>
                  </span>
                </label>

                <div className="rounded-lg border border-border bg-soft p-3 text-xs">
                  <p>
                    <span className="font-semibold">Selected refs:</span>{" "}
                    <span className="text-foreground">{selectedRefIds.size}</span>
                    <span className="text-muted-foreground"> {selectedRefIds.size === 0 ? "(optional — brand template will be used)" : ""}</span>
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold">Selected clients:</span>{" "}
                    <span className="text-foreground">{selectedClientIds.size}</span>
                    <span className="text-muted-foreground"> {selectedClientIds.size === 0 ? "(optional — we'll generate a car-only ad in your brand style)" : ""}</span>
                  </p>
                  {selectedClientIds.size === 0 && (
                    <p className="mt-2 text-muted-foreground">No client photo selected — the AI will generate a clean vehicle hero shot in your brand style instead. Pick a client photo to feature a real customer.</p>
                  )}
                </div>

                <Button
                  onClick={onGenerate}
                  disabled={queuing || sizes.size === 0}
                  className="w-full bg-electric-gradient text-white"
                >
                  {queuing
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Queuing…</>
                    : <><Sparkles className="mr-2 h-4 w-4" /> Generate {sizes.size > 1 ? `${sizes.size} ads` : "ad"}</>}
                </Button>
                <p className="text-[17px] text-muted-foreground">
                  Runs in the background (~30-90s each, all concurrent). Watch the Background Tasks panel — results appear in the library above.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img src={lightboxUrl} alt="" className="max-h-full max-w-full rounded-lg shadow-2xl" />
        </div>
      )}

      {/* Reuse-template modal */}
      {reuseSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={() => !reusing && setReuseSource(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <Repeat className="h-4 w-4 text-[var(--electric)]" /> Reuse template
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Re-runs the same design recipe behind <span className="font-medium text-foreground">{reuseSource.label}</span> (same size, same reference style, same brand chrome) with a different hero. Pick a client photo to swap in, or leave blank to generate a car-only ad in the same style.
                </p>
              </div>
              <button
                className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => !reusing && setReuseSource(null)}
                disabled={reusing}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {clients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-soft p-4 text-center text-xs text-muted-foreground">
                No client photos in the library — applying will generate a car-only ad in the same brand style.
              </p>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[17px] text-muted-foreground">
                    Pick one client photo, or leave blank for a car-only ad in the same style.
                  </p>
                  {reusePicked && (
                    <button
                      type="button"
                      className="text-[17px] text-muted-foreground underline hover:text-foreground"
                      onClick={() => setReusePicked(null)}
                    >
                      Clear selection
                    </button>
                  )}
                </div>
                <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-auto rounded-lg border border-border bg-soft p-2 sm:grid-cols-4 md:grid-cols-5">
                  {clients.map((c) => {
                    const picked = reusePicked === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setReusePicked((s) => (s === c.id ? null : c.id))}
                        className={`group relative overflow-hidden rounded-lg border transition-colors ${picked ? "border-[var(--electric)] ring-2 ring-[var(--electric)]/40" : "border-border hover:border-[var(--electric)]/50"}`}
                      >
                        <img src={c.url} alt={c.label} className="block aspect-square w-full object-cover" />
                        {picked && (
                          <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--electric)] text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                        <span className="block truncate p-1 text-[17px]" title={c.label}>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {reusePicked ? "1 photo selected" : "No photo — will generate a car-only ad"}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setReuseSource(null)} disabled={reusing}>Cancel</Button>
                <Button
                  className="bg-electric-gradient text-white"
                  onClick={confirmReuse}
                  disabled={reusing}
                >
                  {reusing
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Queuing…</>
                    : reusePicked
                      ? <><Repeat className="mr-2 h-4 w-4" /> Re-apply with selected photo</>
                      : <><Sparkles className="mr-2 h-4 w-4" /> Re-apply as car-only ad</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}


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
              size: editor.size ?? null,
              dataBase64: dataUrl,
            },
          });
          toast.success("Saved to ad library");
          setEditor(null);
          refresh();
        }}
      />
    </AdminLayout>

  );
}

function LibrarySection({
  icon, title, subtitle, accept, onUpload, items, selectedIds, onToggleSelect, onDelete, onPreview, emptyHint,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accept: string;
  onUpload: (file: File) => void;
  items: AdAsset[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (url: string) => void;
  emptyHint: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        await onUpload(f);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            {icon} {title} <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Uploading…</> : <><Upload className="mr-1 h-3.5 w-3.5" /> Upload</>}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <ImageIcon className="mx-auto mb-2 h-6 w-6 opacity-40" />
          {emptyHint}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {items.map((it) => {
            const selected = selectedIds.has(it.id);
            return (
              <div key={it.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onToggleSelect(it.id)}
                  className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 transition-all ${
                    selected ? "border-[var(--electric)] shadow-[0_0_0_4px_oklch(0.62_0.20_252/0.25)]" : "border-border hover:border-[var(--electric)]/40"
                  }`}
                  title={it.label}
                >
                  <img src={it.url} alt={it.label} className="h-full w-full object-cover" loading="lazy" />
                  {selected && (
                    <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--electric)] text-white shadow">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPreview(it.url); }}
                    className="rounded p-1 text-white/90 hover:bg-white/15"
                    title="Preview"
                  >
                    <ImageIcon className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(it.id); }}
                    className="rounded p-1 text-white/90 hover:bg-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
