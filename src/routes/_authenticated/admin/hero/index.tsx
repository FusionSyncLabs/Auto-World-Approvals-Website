import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Trash2, CheckCircle2, ImageIcon, Loader2, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  uploadHeroImage,
  setActiveHeroImage,
  clearActiveHeroImage,
  deleteHeroImage,
} from "@/lib/hero-library.functions";
import { useBranding, HERO_SLOTS, type HeroSlotKey } from "@/hooks/use-branding";
import defaultHero from "@/assets/hero-suv.jpg";
import defaultCatSuv from "@/assets/cat-suv.jpg";
import defaultCatTruck from "@/assets/cat-truck.jpg";
import defaultCatSedan from "@/assets/cat-sedan.jpg";
import defaultCatEv from "@/assets/cat-ev.jpg";
import defaultKeys from "@/assets/keys-handoff-v2.jpg";

export const Route = createFileRoute("/_authenticated/admin/hero/")({
  head: () => ({ meta: [{"title": "Hero Images | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals hero images area for authorized users."}, {"property": "og:title", "content": "Hero Images | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals hero images area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: HeroImagesAdmin,
});

const DEFAULTS: Record<HeroSlotKey, string> = {
  hero_image_url: defaultHero,
  hero_cat_suv_url: defaultCatSuv,
  hero_cat_truck_url: defaultCatTruck,
  hero_cat_sedan_url: defaultCatSedan,
  hero_cat_ev_url: defaultCatEv,
  hero_why_url: defaultKeys,
};

type HeroRow = { id: string; label: string; created_at: string };

function HeroImagesAdmin() {
  const qc = useQueryClient();
  const branding = useBranding();
  const upload = useServerFn(uploadHeroImage);
  const promote = useServerFn(setActiveHeroImage);
  const clear = useServerFn(clearActiveHeroImage);
  const del = useServerFn(deleteHeroImage);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hero-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_assets")
        .select("id, label, created_at")
        .eq("kind", "hero")
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as HeroRow[];
    },
  });

  const slots = branding.data?.heroSlots ?? ({} as Record<HeroSlotKey, string>);

  const activeIdForSlot = (slot: HeroSlotKey): string | null => {
    const url = slots[slot] ?? "";
    const m = url.match(/\/brand-asset\/([0-9a-f-]{36})\./i);
    return m?.[1] ?? null;
  };

  async function handleFile(file: File, targetSlot?: HeroSlotKey) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please choose a JPEG, PNG, or WebP image");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Image is too large (max 12 MB)");
      return;
    }
    setUploading(true);
    if (targetSlot) setBusy(`upload:${targetSlot}`);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
      }
      const b64 = btoa(bin);

      const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
        img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
        img.src = url;
      });

      const slotLabel = targetSlot ? HERO_SLOTS.find((s) => s.key === targetSlot)?.label : null;
      const autoLabel =
        label.trim() ||
        (slotLabel ? `${slotLabel} — ${new Date().toLocaleDateString()}` : "") ||
        file.name.replace(/\.[^.]+$/, "") ||
        "Hero image";

      const res = await upload({
        data: {
          label: autoLabel,
          mime: file.type,
          dataBase64: b64,
          width: dims?.w,
          height: dims?.h,
        },
      }) as { ok: boolean; id: string };

      if (targetSlot && res?.id) {
        await promote({ data: { id: res.id, slot: targetSlot } });
        toast.success(`Uploaded & applied to ${slotLabel}`);
        qc.invalidateQueries({ queryKey: ["branding"] });
      } else {
        toast.success("Image added to library");
      }
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["hero-library"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (targetSlot) setBusy(null);
    }
  }

  async function applyToSlot(id: string, slot: HeroSlotKey) {
    setBusy(`apply:${id}:${slot}`);
    try {
      await promote({ data: { id, slot } });
      toast.success(`Now live in ${HERO_SLOTS.find((s) => s.key === slot)?.label}`);
      qc.invalidateQueries({ queryKey: ["branding"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function revertSlot(slot: HeroSlotKey) {
    setBusy(`clear:${slot}`);
    try {
      await clear({ data: { slot } });
      toast.success("Reverted to default");
      qc.invalidateQueries({ queryKey: ["branding"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this image from the library? This cannot be undone.")) return;
    setBusy(`del:${id}`);
    try {
      await del({ data: { id } });
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["hero-library"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  function download(id: string, lbl: string) {
    const a = document.createElement("a");
    a.href = `/api/public/brand-asset/${id}.jpg`;
    a.download = `awa-hero-${lbl.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${id.slice(0, 8)}.jpg`;
    a.click();
  }

  const rows = data ?? [];

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ImageIcon className="h-6 w-6 text-[var(--electric)]" /> Homepage Images
        </h1>
        <p className="text-sm text-muted-foreground">
          Every photo that appears on the homepage — the hero background, the four vehicle-category tiles, and the "keys handoff" photo — can be swapped independently. Upload once, then reuse any image in any slot.
        </p>
      </div>

      {/* Slots */}
      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {HERO_SLOTS.map((s) => {
          const activeId = activeIdForSlot(s.key);
          const currentUrl = slots[s.key] || DEFAULTS[s.key];
          const clearing = busy === `clear:${s.key}`;
          return (
            <div key={s.key} className="rounded-2xl border border-border bg-card p-3 shadow-card">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                {activeId ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--electric)]/10 px-2 py-0.5 text-[17px] font-semibold text-[var(--electric)]">
                    <Sparkles className="h-3 w-3" /> Custom
                  </span>
                ) : (
                  <span className="text-[17px] uppercase tracking-wider text-muted-foreground">Default</span>
                )}
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-black/5">
                <img
                  src={currentUrl}
                  alt={s.label}
                  className="h-40 w-full object-cover"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Select
                  value={activeId ?? "__default__"}
                  onValueChange={(v) => {
                    if (v === "__default__") revertSlot(s.key);
                    else applyToSlot(v, s.key);
                  }}
                >
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Choose from library…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Default (bundled)</SelectItem>
                    {rows.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => document.getElementById(`slot-upload-${s.key}`)?.click()}
                  disabled={busy === `upload:${s.key}`}
                >
                  {busy === `upload:${s.key}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <><Upload className="mr-1 h-3 w-3" /> Upload</>
                  )}
                </Button>
                <input
                  id={`slot-upload-${s.key}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f, s.key);
                    e.target.value = "";
                  }}
                />
                {activeId && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => revertSlot(s.key)} disabled={clearing}>
                    {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reset"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Upload */}
      <div className="mb-8 rounded-2xl border border-dashed border-[var(--electric)]/40 bg-[var(--electric)]/5 p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Upload className="h-4 w-4" /> Upload a new image to the library</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Optional label (e.g. Summer 2026 truck hero)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="sm:max-w-sm"
          />
          <Input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="sm:max-w-sm"
          />
          {uploading && (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          JPEG, PNG, or WebP · Max 12 MB. Any image works for any slot — the hero uses landscape 16:9, category tiles use 5:3, and the "keys" photo is square.
        </p>
      </div>

      {/* Library */}
      <section>
        <h2 className="mb-3 font-semibold">Library <span className="ml-1 text-xs font-normal text-muted-foreground">({rows.length})</span></h2>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            <ImageIcon className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No images uploaded yet. Upload one above to build your library.</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((a) => {
            const usedIn = HERO_SLOTS.filter((s) => activeIdForSlot(s.key) === a.id);
            const deleting = busy === `del:${a.id}`;
            return (
              <div
                key={a.id}
                className={`rounded-2xl border p-3 shadow-card transition-colors ${usedIn.length > 0 ? "border-[var(--electric)] bg-[var(--electric)]/5" : "border-border bg-card"}`}
              >
                <div className="overflow-hidden rounded-lg bg-black/5">
                  <img
                    src={`/api/public/brand-asset/${a.id}.jpg`}
                    alt={a.label}
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{a.label}</p>
                    <p className="truncate text-[17px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {usedIn.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {usedIn.map((s) => (
                      <span key={s.key} className="inline-flex items-center gap-1 rounded-full bg-[var(--electric)] px-2 py-0.5 text-[17px] font-semibold text-white">
                        <CheckCircle2 className="h-3 w-3" /> {s.label}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Select
                    onValueChange={(v) => applyToSlot(a.id, v as HeroSlotKey)}
                  >
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Use in slot…" />
                    </SelectTrigger>
                    <SelectContent>
                      {HERO_SLOTS.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => download(a.id, a.label)} className="h-8 text-xs">
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(a.id)}
                    disabled={deleting}
                    className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                  >
                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </AdminLayout>
  );
}
