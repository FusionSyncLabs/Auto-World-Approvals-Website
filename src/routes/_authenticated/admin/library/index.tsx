import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Download, Trash2, CheckCircle2, ImageIcon, Loader2, Library } from "lucide-react";
import { toast } from "sonner";
import { setActiveLogo, clearActiveLogo, deleteBrandAsset } from "@/lib/brand-library.functions";
import { useBranding } from "@/hooks/use-branding";

export const Route = createFileRoute("/_authenticated/admin/library/")({
  head: () => ({ meta: [{"title": "Brand Library | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals brand library area for authorized users."}, {"property": "og:title", "content": "Brand Library | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals brand library area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: BrandLibrary,
});

type AssetRow = {
  id: string;
  kind: "logo" | "banner";
  label: string;
  variant: string | null;
  palette: string | null;
  platform: string | null;
  created_at: string;
};

function BrandLibrary() {
  const qc = useQueryClient();
  const branding = useBranding();
  const promote = useServerFn(setActiveLogo);
  const clear = useServerFn(clearActiveLogo);
  const del = useServerFn(deleteBrandAsset);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["brand-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_assets")
        .select("id, kind, label, variant, palette, platform, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AssetRow[];
    },
  });

  const activeUrl = branding.data?.logoUrl ?? "";
  const isActive = (id: string) => activeUrl.includes(`/api/public/brand-asset/${id}.`);

  const logos = (data ?? []).filter((a) => a.kind === "logo");
  const banners = (data ?? []).filter((a) => a.kind === "banner");

  async function useAsLogo(id: string, mode: "light" | "dark") {
    setBusy(`${id}:${mode}`);
    try {
      const r = await promote({ data: { id, mode } });
      toast.success(
        mode === "dark"
          ? "Applied as the dark-background logo (used on dark hero, footer, emails)."
          : "Applied as the light-background logo (used on white header & pages).",
      );
      qc.invalidateQueries({ queryKey: ["branding"] });
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      console.info("[library] active logo:", r.url, "mode:", r.mode);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update site logo");
    } finally {
      setBusy(null);
    }
  }

  async function revertLogo() {
    setBusy("clear");
    try {
      await clear();
      toast.success("Reverted to default Auto World Approvals logo.");
      qc.invalidateQueries({ queryKey: ["branding"] });
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this asset from the library? This cannot be undone.")) return;
    setBusy(id);
    try {
      await del({ data: { id } });
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["brand-library"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  function download(id: string, label: string) {
    const a = document.createElement("a");
    a.href = `/api/public/brand-asset/${id}.png`;
    a.download = `awa-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${id.slice(0, 8)}.png`;
    a.click();
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Library className="h-6 w-6 text-[var(--electric)]" /> Brand Library
          </h1>
          <p className="text-sm text-muted-foreground">
            Every AI-generated logo and banner is collected here. Download any asset, or push a logo live across the site, dashboards, and email templates.
          </p>
        </div>
        {activeUrl && (
          <Button variant="outline" size="sm" onClick={revertLogo} disabled={busy === "clear"}>
            {busy === "clear" ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            Revert to default logo
          </Button>
        )}
      </div>

      {activeUrl && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-[var(--electric)]/40 bg-[var(--electric)]/5 p-4">
          <div className="rounded-lg bg-white p-2">
            <img src={activeUrl} alt="Active site logo" className="h-12 w-auto object-contain" />
          </div>
          <div className="text-sm">
            <p className="font-semibold">This is the active site logo</p>
            <p className="text-xs text-muted-foreground break-all">{activeUrl}</p>
          </div>
        </div>
      )}

      <Section title="Logos" kind="logo" rows={logos} isLoading={isLoading} busy={busy}
        onDownload={download} onDelete={remove} onUseAsLogo={useAsLogo} isActive={isActive} />

      <Section title="Banners" kind="banner" rows={banners} isLoading={isLoading} busy={busy}
        onDownload={download} onDelete={remove} />
    </AdminLayout>
  );
}

function Section({
  title, kind, rows, isLoading, busy, onDownload, onDelete, onUseAsLogo, isActive,
}: {
  title: string;
  kind: "logo" | "banner";
  rows: AssetRow[];
  isLoading: boolean;
  busy: string | null;
  onDownload: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onUseAsLogo?: (id: string, mode: "light" | "dark") => void;
  isActive?: (id: string) => boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-semibold">{title} <span className="ml-1 text-xs font-normal text-muted-foreground">({rows.length})</span></h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          <ImageIcon className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">No {kind}s yet. Generate one from the {kind === "logo" ? "Logo" : "Banner"} Studio.</p>
        </div>
      )}
      <div className={kind === "logo" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid gap-4 lg:grid-cols-2"}>
        {rows.map((a) => {
          const active = isActive?.(a.id) ?? false;
          const isLightSubject = String(a.palette ?? "") === "white_on_navy" || String(a.palette ?? "") === "mono_white";
          const busyLight = busy === `${a.id}:light`;
          const busyDark = busy === `${a.id}:dark`;
          return (
            <div key={a.id} className={`rounded-2xl border p-3 shadow-card transition-colors ${active ? "border-[var(--electric)] bg-[var(--electric)]/5" : "border-border bg-card"}`}>
              <div
                className="overflow-hidden rounded-lg"
                style={{
                  backgroundImage: isLightSubject
                    ? "linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)"
                    : "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                  backgroundColor: isLightSubject ? "#0f172a" : "#fff",
                }}
              >
                <img src={`/api/public/brand-asset/${a.id}.png`} alt={a.label} className="w-full" loading="lazy" />
              </div>
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{a.label}</p>
                  <p className="truncate text-[17px] text-muted-foreground">
                    {[a.palette, a.platform, new Date(a.created_at).toLocaleDateString()].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {active && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--electric)] px-2 py-0.5 text-[17px] font-semibold text-white">
                    <CheckCircle2 className="h-3 w-3" /> Live
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => onDownload(a.id, a.label)} className="h-8 text-xs">
                  <Download className="mr-1 h-3 w-3" /> PNG
                </Button>
                {onUseAsLogo && (
                  <>
                    <Button size="sm" onClick={() => onUseAsLogo(a.id, "light")} disabled={busyLight} className="h-8 bg-electric-gradient text-xs text-white" title="Use on light backgrounds">
                      {busyLight ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />} Light bg
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onUseAsLogo(a.id, "dark")} disabled={busyDark} className="h-8 text-xs" title="Use on dark backgrounds">
                      {busyDark ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />} Dark bg
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => onDelete(a.id)} className="h-8 px-2 text-xs text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
