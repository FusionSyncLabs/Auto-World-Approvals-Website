import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Heart, Plus, Trash2, Upload, Loader2, Pencil, X, ImageIcon, Sparkles, Wand2, EyeOff, Eye, RefreshCw, Library, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllHappyClients,
  upsertHappyClient,
  deleteHappyClient,
  uploadHappyClientPhoto,
  regenerateHappyClientDetails,
  listHappyClientPhotos,
  deleteHappyClientPhoto,
  type HappyClient,
  type HappyClientPhoto,
} from "@/lib/happy-clients.functions";
import { enqueueJob, listMyJobs } from "@/lib/jobs.functions";

export const Route = createFileRoute("/_authenticated/admin/happy-clients/")({
  head: () => ({ meta: [{"title": "Happy Clients | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals happy clients area for authorized users."}, {"property": "og:title", "content": "Happy Clients | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals happy clients area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: HappyClientsAdmin,
});

type Draft = {
  id?: string;
  client_name: string;
  location: string;
  vehicle: string;
  quote: string;
  photo_url: string;
  accent_color: string;
  display_order: number;
  is_active: boolean;
};

const EMPTY: Draft = {
  client_name: "",
  location: "",
  vehicle: "",
  quote: "",
  photo_url: "",
  accent_color: "",
  display_order: 100,
  is_active: true,
};

function HappyClientsAdmin() {
  const list = useServerFn(listAllHappyClients);
  const save = useServerFn(upsertHappyClient);
  const remove = useServerFn(deleteHappyClient);
  const upload = useServerFn(uploadHappyClientPhoto);
  const regenDetails = useServerFn(regenerateHappyClientDetails);
  const enqueue = useServerFn(enqueueJob);
  const listJobs = useServerFn(listMyJobs);
  const listPhotos = useServerFn(listHappyClientPhotos);
  const removePhoto = useServerFn(deleteHappyClientPhoto);

  const [rows, setRows] = useState<HappyClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sectionEnabled, setSectionEnabled] = useState(true);
  const [togglingSection, setTogglingSection] = useState(false);
  const [generatingNew, setGeneratingNew] = useState(false);
  const [pendingJobs, setPendingJobs] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryPickMode, setLibraryPickMode] = useState(false);
  const [photos, setPhotos] = useState<HappyClientPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  async function refresh(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    try {
      const [r, settings] = await Promise.all([
        list(),
        supabase.from("app_settings").select("value").eq("key", "happy_clients_enabled").maybeSingle(),
      ]);
      setRows(r);
      if (settings.data?.value === false) setSectionEnabled(false);
      else setSectionEnabled(true);
    } catch (e) {
      if (!opts?.silent) toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  async function toggleSection(next: boolean) {
    setTogglingSection(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "happy_clients_enabled", value: next } as never);
      if (error) throw error;
      setSectionEnabled(next);
      toast.success(next ? "Section enabled on homepage" : "Section hidden from homepage");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setTogglingSection(false);
    }
  }

  useEffect(() => {
    refresh();
    // On mount, also see if there are any in-flight happy-client jobs from
    // before this page was opened — if so, kick polling.
    listJobs({ data: { limit: 50 } })
      .then((jobs) => {
        const active = jobs.filter(
          (j) =>
            (j.kind === "happy_client_generate" || j.kind === "happy_client_regenerate") &&
            (j.status === "queued" || j.status === "running"),
        ).length;
        if (active > 0) setPendingJobs(active);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.display_order), 0);
    setDraft({ ...EMPTY, display_order: maxOrder + 10 });
  }

  function openEdit(r: HappyClient) {
    setDraft({
      id: r.id,
      client_name: r.client_name,
      location: r.location ?? "",
      vehicle: r.vehicle ?? "",
      quote: r.quote,
      photo_url: r.photo_url,
      accent_color: r.accent_color ?? "",
      display_order: r.display_order,
      is_active: r.is_active,
    });
  }

  async function onUpload(file: File) {
    if (!draft) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const b64 = btoa(binary);
      const { url } = await upload({
        data: {
          label: draft.client_name || file.name,
          mime: file.type || "image/jpeg",
          data_base64: b64,
        },
      });
      setDraft({ ...draft, photo_url: url });
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await save({
        data: {
          id: draft.id,
          client_name: draft.client_name,
          location: draft.location,
          vehicle: draft.vehicle,
          quote: draft.quote,
          photo_url: draft.photo_url,
          accent_color: draft.accent_color,
          display_order: Number(draft.display_order) || 0,
          is_active: draft.is_active,
        },
      });
      toast.success("Saved");
      setDraft(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this client entry?")) return;
    try {
      await remove({ data: { id } });
      setRows((r) => r.filter((x) => x.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function onRegenerate(id: string) {
    setRegeneratingId(id);
    try {
      await enqueue({
        data: {
          kind: "happy_client_regenerate",
          label: `Regenerate happy-client photo`,
          input: { id },
        },
      });
      setPendingJobs((n) => n + 1);
      toast.success("Queued — new photo will appear when ready. You can leave this page.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function onRewriteDetails(id: string) {
    setRewritingId(id);
    try {
      const result = await regenDetails({ data: { id } });
      setRows((rs) => rs.map((x) => x.id === id ? {
        ...x,
        client_name: result.client_name ?? x.client_name,
        location: result.location ?? x.location,
        vehicle: result.vehicle ?? x.vehicle,
        quote: result.quote ?? x.quote,
      } : x));
      toast.success("Updated name, vehicle, and quote to match the photo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate details");
    } finally {
      setRewritingId(null);
    }
  }


  async function onGenerateNew() {
    setGeneratingNew(true);
    try {
      await enqueue({
        data: {
          kind: "happy_client_generate",
          label: "Generate happy client",
          input: {},
        },
      });
      setPendingJobs((n) => n + 1);
      toast.success("Queued — new client will appear in the library when ready. You can leave this page.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue");
    } finally {
      setGeneratingNew(false);
    }
  }

  async function openLibrary(pickMode: boolean) {
    setLibraryPickMode(pickMode);
    setLibraryOpen(true);
    setPhotosLoading(true);
    try {
      const data = await listPhotos();
      setPhotos(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load library");
    } finally {
      setPhotosLoading(false);
    }
  }

  async function onDeletePhoto(p: HappyClientPhoto) {
    if (p.in_use) {
      if (!confirm(`This photo is currently used by a happy-client entry. Delete it anyway? The entry will show a broken image until you replace it.`)) return;
    } else if (!confirm("Delete this photo from the library? This cannot be undone.")) {
      return;
    }
    setDeletingPhotoId(p.id);
    try {
      await removePhoto({ data: { id: p.id, force: p.in_use } });
      setPhotos((ps) => ps.filter((x) => x.id !== p.id));
      toast.success("Photo deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingPhotoId(null);
    }
  }

  function onPickPhoto(p: HappyClientPhoto) {
    if (!draft) return;
    setDraft({ ...draft, photo_url: p.url });
    setLibraryOpen(false);
    toast.success("Photo selected");
  }

  // Poll for in-flight happy-client jobs (server-side) so completed work
  // shows up regardless of where the user navigates or how many are queued.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const jobs = await listJobs({ data: { limit: 50 } });
        const active = jobs.filter(
          (j) =>
            (j.kind === "happy_client_generate" || j.kind === "happy_client_regenerate") &&
            (j.status === "queued" || j.status === "running"),
        ).length;
        if (cancelled) return;
        setPendingJobs(active);
        if (active === 0) return; // stop polling when nothing in flight
        await refresh({ silent: true });
        if (cancelled) return;
        timer = setTimeout(tick, 4000);
      } catch {
        if (!cancelled) timer = setTimeout(tick, 8000);
      }
    }
    if (pendingJobs > 0) tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJobs]);

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Heart className="h-6 w-6 text-[var(--electric)]" /> Happy Clients
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage the showcase wall on the homepage. Upload a photo, add their story, control the order, and toggle visibility.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pendingJobs > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {pendingJobs} generating in background
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => openLibrary(false)}
            title="Browse all generated and uploaded happy-client photos"
          >
            <Library className="mr-1 h-4 w-4" /> Photo library
          </Button>
          <Button
            variant="outline"
            onClick={onGenerateNew}
            disabled={generatingNew}
            title="AI-generate a brand new happy client (photo, name, vehicle, quote)"
          >
            {generatingNew ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
            Generate new client
          </Button>
          <Button onClick={openNew} className="bg-electric-gradient text-white">
            <Plus className="mr-1 h-4 w-4" /> Add client
          </Button>
        </div>
      </div>

      {/* Section visibility toggle */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          {sectionEnabled ? (
            <Eye className="h-5 w-5 text-[var(--electric)]" />
          ) : (
            <EyeOff className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="font-semibold">Show Happy Clients on the homepage</p>
            <p className="text-xs text-muted-foreground">
              {sectionEnabled
                ? "The expandable Happy Clients teaser is visible on the homepage hero area."
                : "The section is currently hidden from all visitors."}
            </p>
          </div>
        </div>
        <Switch
          checked={sectionEnabled}
          onCheckedChange={toggleSection}
          disabled={togglingSection}
        />
      </div>


      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <ImageIcon className="mx-auto mb-3 h-8 w-8 opacity-40" />
          No happy clients yet — click "Add client" to add your first one.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="relative aspect-[4/3] bg-muted">
                <img src={r.photo_url} alt={r.client_name} className="h-full w-full object-cover" />
                {!r.is_active && (
                  <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[17px] font-bold uppercase tracking-wider text-white">
                    Hidden
                  </span>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[17px] font-semibold text-white">
                  #{r.display_order}
                </span>
              </div>
              <div className="p-4">
                <p className="font-semibold">{r.client_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[r.location, r.vehicle].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-foreground/80">"{r.quote}"</p>
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)} className="flex-1">
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRegenerate(r.id)}
                    disabled={regeneratingId === r.id}
                    className="w-full justify-start"
                    title="Generate a brand new candid AI photo (name, vehicle & quote stay the same)"
                  >
                    {regeneratingId === r.id ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-3.5 w-3.5" />
                    )}
                    Regenerate photo only
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRewriteDetails(r.id)}
                    disabled={rewritingId === r.id}
                    className="w-full justify-start"
                    title="Rewrite name, vehicle & quote to match the current photo (photo unchanged)"
                  >
                    {rewritingId === r.id ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    )}
                    Rewrite caption & profile to match photo
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer modal */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card shadow-elevated">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="text-lg font-bold">{draft.id ? "Edit client" : "Add client"}</h2>
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-5 p-5">
              {/* Photo */}
              <div className="space-y-2">
                <Label>Photo</Label>
                <div className="flex items-start gap-4">
                  <div className="h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {draft.photo_url ? (
                      <img src={draft.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUpload(f);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="w-full"
                    >
                      {uploading ? (
                        <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Uploading…</>
                      ) : (
                        <><Upload className="mr-1 h-3.5 w-3.5" /> Upload photo</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openLibrary(true)}
                      className="w-full"
                    >
                      <Library className="mr-1 h-3.5 w-3.5" /> Choose from library
                    </Button>
                    <Input
                      placeholder="…or paste an image URL"
                      value={draft.photo_url}
                      onChange={(e) => setDraft({ ...draft, photo_url: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Max ~4MB. Square or portrait crops look best.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Client name *</Label>
                  <NameInput value={draft.client_name} onChange={(e) => setDraft({ ...draft, client_name: e.target.value })} placeholder="e.g. Jordan Smith" />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="e.g. Surrey, BC" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Vehicle</Label>
                  <Input value={draft.vehicle} onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })} placeholder="e.g. 2023 Toyota RAV4" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Story / quote *</Label>
                <Textarea
                  rows={4}
                  value={draft.quote}
                  onChange={(e) => setDraft({ ...draft, quote: e.target.value })}
                  placeholder="What the client said about working with you…"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Display order</Label>
                  <Input
                    type="number"
                    value={draft.display_order}
                    onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">Lower = earlier.</p>
                </div>
                <div className="space-y-2">
                  <Label>Accent color (optional)</Label>
                  <Input
                    value={draft.accent_color}
                    onChange={(e) => setDraft({ ...draft, accent_color: e.target.value })}
                    placeholder="e.g. #4ea3ff"
                  />
                </div>
                <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-start">
                  <Label className="m-0">Visible on site</Label>
                  <Switch
                    checked={draft.is_active}
                    onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-5">
              <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
              <Button onClick={onSave} disabled={saving} className="bg-electric-gradient text-white">
                {saving ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Saving…</> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Photo library modal */}
      {libraryOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-5xl rounded-2xl border border-border bg-card shadow-elevated">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Library className="h-5 w-5 text-[var(--electric)]" /> Photo library
                </h2>
                <p className="text-xs text-muted-foreground">
                  Every AI-generated and uploaded happy-client photo is saved here.
                  {libraryPickMode ? " Click a photo to use it for this entry." : " Reuse any photo for a new entry, or delete ones you no longer need."}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLibraryOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-5">
              {photosLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" /> Loading library…
                </div>
              ) : photos.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <ImageIcon className="mx-auto mb-3 h-8 w-8 opacity-40" />
                  No photos yet. Generate or upload one to start the library.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((p) => (
                    <div key={p.id} className="group overflow-hidden rounded-xl border border-border bg-muted">
                      <div className="relative aspect-square">
                        <img src={p.url} alt={p.label} loading="lazy" className="h-full w-full object-cover" />
                        {p.in_use && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--electric)]/90 px-2 py-0.5 text-[17px] font-bold uppercase tracking-wider text-white">
                            <Check className="h-3 w-3" /> In use
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 p-2">
                        <p className="truncate text-xs text-foreground/80" title={p.label}>{p.label || "Untitled"}</p>
                        <p className="text-[17px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                        <div className="flex gap-1">
                          {libraryPickMode && (
                            <Button size="sm" className="flex-1 bg-electric-gradient text-white" onClick={() => onPickPhoto(p)}>
                              <Check className="mr-1 h-3 w-3" /> Use
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDeletePhoto(p)}
                            disabled={deletingPhotoId === p.id}
                            className="text-destructive"
                            title={p.in_use ? "In use — confirm to force delete" : "Delete from library"}
                          >
                            {deletingPhotoId === p.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-5">
              <Button variant="outline" onClick={() => setLibraryOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
