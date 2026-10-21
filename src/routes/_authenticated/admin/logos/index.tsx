import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Download, Loader2, ImageIcon, Trash2, Wand2, Check, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  listSavedLogos,
  repairLogoPair,
  uploadLogo,
  generateFaviconFromActive,
  applyActiveFaviconAcrossSite,
  LOGO_VARIANTS,
  type LogoVariant,
} from "@/lib/logos.functions";
import { setActiveLogoPair, clearActiveLogo, deleteBrandAsset } from "@/lib/brand-library.functions";
import { enqueueJob } from "@/lib/jobs.functions";
import { useMyJobs } from "@/hooks/use-jobs";

export const Route = createFileRoute("/_authenticated/admin/logos/")({
  head: () => ({ meta: [{"title": "AI Logo Studio | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals ai logo studio area for authorized users."}, {"property": "og:title", "content": "AI Logo Studio | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals ai logo studio area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: LogoStudio,
});

type PairSide = { id: string; mode: "light" | "dark"; url: string; b64?: string };
type LatestPair = {
  pairId: string;
  label: string;
  variant: LogoVariant;
  light: PairSide | null;
  dark: PairSide | null;
  darkFailed: boolean;
};

type SavedItem = {
  id: string;
  label: string;
  variant: LogoVariant | null;
  createdAt: string;
  url: string;
  pairId: string | null;
  pairMode: "light" | "dark" | null;
  isActiveLight: boolean;
  isActiveDark: boolean;
};

type SavedPair = {
  pairId: string;
  light: SavedItem | null;
  dark: SavedItem | null;
  createdAt: string;
};

type DownloadSpec = {
  label: string;
  filenameSuffix: string;
  format: "source" | "png";
  size?: number;          // width in px for non-square exports
  width?: number;         // explicit width for rectangular exports
  height?: number;        // explicit height for rectangular exports
  square?: boolean;
  padPct?: number;        // padding percentage inside the export (default 10% for square)
};

const LOGO_DOWNLOADS: DownloadSpec[] = [
  { label: "Source (SVG/PNG)", filenameSuffix: "source", format: "source" },
  { label: "PNG 512", filenameSuffix: "512", format: "png", size: 512 },
  { label: "PNG 1024", filenameSuffix: "1024", format: "png", size: 1024 },
  { label: "PNG 2048", filenameSuffix: "2048", format: "png", size: 2048 },
  { label: "PNG 4096 (master)", filenameSuffix: "4096", format: "png", size: 4096 },
  { label: "FB profile 320²", filenameSuffix: "facebook-profile-320", format: "png", size: 320, square: true, padPct: 0.08 },
  { label: "FB profile 2048²", filenameSuffix: "facebook-profile-2048", format: "png", size: 2048, square: true, padPct: 0.08 },
  { label: "FB cover 820×312", filenameSuffix: "facebook-cover", format: "png", width: 820, height: 312, padPct: 0.10 },
  { label: "Instagram 1080²", filenameSuffix: "instagram-1080", format: "png", size: 1080, square: true, padPct: 0.10 },
  { label: "Avatar 512²", filenameSuffix: "avatar-512", format: "png", size: 512, square: true, padPct: 0.08 },
  { label: "Favicon 256²", filenameSuffix: "favicon-256", format: "png", size: 256, square: true, padPct: 0.06 },
];


const CHECKER_LIGHT = {
  backgroundImage:
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
  backgroundColor: "#fff",
} as const;
const CHECKER_DARK = {
  backgroundImage:
    "linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
  backgroundColor: "#0f172a",
} as const;

function LogoStudio() {
  const enqueue = useServerFn(enqueueJob);
  const list = useServerFn(listSavedLogos);
  const repairPair = useServerFn(repairLogoPair);
  const applyPair = useServerFn(setActiveLogoPair);
  const clearActive = useServerFn(clearActiveLogo);
  const remove = useServerFn(deleteBrandAsset);
  const upload = useServerFn(uploadLogo);
  const genFavicon = useServerFn(generateFaviconFromActive);
  const applyFavicon = useServerFn(applyActiveFaviconAcrossSite);

  const [variant, setVariant] = useState<LogoVariant>("primary_full");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LatestPair | null>(null);
  const [pairs, setPairs] = useState<SavedPair[]>([]);
  const [orphans, setOrphans] = useState<SavedItem[]>([]);
  const [activeLightUrl, setActiveLightUrl] = useState("");
  const [activeDarkUrl, setActiveDarkUrl] = useState("");
  const [activeFaviconUrl, setActiveFaviconUrl] = useState("");
  const [activeFaviconMonoUrl, setActiveFaviconMonoUrl] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [generatingFavicon, setGeneratingFavicon] = useState(false);
  const [applyingFavicon, setApplyingFavicon] = useState(false);
  const [remixPrompts, setRemixPrompts] = useState<Record<string, string>>({});
  const [remixingId, setRemixingId] = useState<string | null>(null);
  const [busyPairId, setBusyPairId] = useState<string | null>(null);
  const [repairingPairId, setRepairingPairId] = useState<string | null>(null);

  // Upload-your-own state
  const [upLabel, setUpLabel] = useState("Custom upload");
  const [upLightFile, setUpLightFile] = useState<File | null>(null);
  const [upDarkFile, setUpDarkFile] = useState<File | null>(null);
  const [upLightPreview, setUpLightPreview] = useState<string>("");
  const [upDarkPreview, setUpDarkPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  function pickFile(side: "light" | "dark") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      if (!f) return;
      if (f.size > 6 * 1024 * 1024) { toast.error("File too large — keep under 6MB."); return; }
      const url = URL.createObjectURL(f);
      if (side === "light") { setUpLightFile(f); setUpLightPreview(url); }
      else { setUpDarkFile(f); setUpDarkPreview(url); }
    };
  }

  function fileToB64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function onUpload() {
    if (!upLightFile && !upDarkFile) { toast.error("Choose a file for light bg, dark bg, or both."); return; }
    if (!upLabel.trim()) { toast.error("Give this logo a label."); return; }
    setUploading(true);
    try {
      const payload: Record<string, string> = { label: upLabel.trim() };
      if (upLightFile) { payload.lightB64 = await fileToB64(upLightFile); payload.lightMime = upLightFile.type || "image/png"; }
      if (upDarkFile) { payload.darkB64 = await fileToB64(upDarkFile); payload.darkMime = upDarkFile.type || "image/png"; }
      const res = await upload({ data: payload as never });
      toast.success("Uploaded to library");
      // Reset
      setUpLightFile(null); setUpDarkFile(null);
      if (upLightPreview) URL.revokeObjectURL(upLightPreview);
      if (upDarkPreview) URL.revokeObjectURL(upDarkPreview);
      setUpLightPreview(""); setUpDarkPreview("");
      await refresh();
      // Offer one-click apply
      if (res.pairId && confirm("Apply this uploaded logo across the site now?")) {
        await applyPair({ data: { pairId: res.pairId } });
        toast.success("Applied across the site");
        refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const refresh = useCallback(async () => {
    try {
      const res = await list();
      setPairs(res.pairs as SavedPair[]);
      setOrphans(res.orphans as SavedItem[]);
      setActiveLightUrl(res.activeLightUrl);
      setActiveDarkUrl(res.activeDarkUrl);
      setActiveFaviconUrl((res as { activeFaviconUrl?: string }).activeFaviconUrl ?? "");
      setActiveFaviconMonoUrl((res as { activeFaviconMonoUrl?: string }).activeFaviconMonoUrl ?? "");
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSaved(false);
    }
  }, [list]);

  useEffect(() => { refresh(); }, [refresh]);

  // Surface the result of background jobs in this studio when they finish.
  const { jobs } = useMyJobs({ limit: 20 });
  const lastSeen = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    for (const j of jobs) {
      if (j.kind !== "logo_generate" && j.kind !== "logo_remix") continue;
      const prev = lastSeen.current.get(j.id);
      if (prev === j.status) continue;
      lastSeen.current.set(j.id, j.status);
      if (j.status === "succeeded" && j.result) {
        if (j.kind === "logo_generate") {
          const r = j.result as { pairId?: string; darkFailed?: boolean; light?: { id: string; url: string }; dark?: { id: string; url: string } };
          if (r.pairId) {
            const version = Date.now();
            const bust = (url: string) => url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`;
            setResult({
              pairId: r.pairId,
              label: j.label,
              variant,
              light: r.light ? { id: r.light.id, url: bust(r.light.url), mode: "light" as const } : null,
              dark: r.dark ? { id: r.dark.id, url: bust(r.dark.url), mode: "dark" as const } : null,
              darkFailed: !!r.darkFailed,
            });
          }
        }
        refresh();
      }
    }
  }, [jobs, refresh, variant]);

  async function onGenerate() {
    setLoading(true);
    setResult(null);
    try {
      await enqueue({
        data: {
          kind: "logo_generate",
          label: `${LOGO_VARIANTS[variant].label}`,
          input: { variant, notes },
        },
      });
      toast.success("Queued — your logo pair will appear here when ready. You can leave this page.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue logo");
    } finally {
      setLoading(false);
    }
  }

  async function onRemix(id: string, prompt: string) {
    if (!prompt.trim()) { toast.error("Enter a quick change to apply"); return; }
    setRemixingId(id);
    try {
      await enqueue({
        data: {
          kind: "logo_remix",
          label: `Remix logo`,
          input: { id, prompt: prompt.trim() },
        },
      });
      setRemixPrompts((s) => ({ ...s, [id]: "" }));
      toast.success("Queued — remix will appear in the library when ready.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remix failed to queue");
    } finally {
      setRemixingId(null);
    }
  }

  async function onApplyPair(pairId: string) {
    setBusyPairId(pairId);
    try {
      await applyPair({ data: { pairId } });
      toast.success("Logo applied across the site (light + dark backgrounds)");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setBusyPairId(null);
    }
  }

  async function onRepairPair(pairId: string) {
    setRepairingPairId(pairId);
    try {
      await repairPair({ data: { pairId } });
      toast.success("Logo repaired as a crisp scalable asset");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clean logo");
    } finally {
      setRepairingPairId(null);
    }
  }

  async function onClear() {
    if (!confirm("Revert to the bundled default logo?")) return;
    try {
      await clearActive();
      toast.success("Reverted to default logo");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear");
    }
  }

  async function onGenerateFavicon() {
    if (!activeLightUrl) {
      toast.error("Apply a logo pair to the site first — the favicon is extracted from the active logo.");
      return;
    }
    setGeneratingFavicon(true);
    try {
      const res = await genFavicon();
      setActiveFaviconUrl(res.url);
      if ((res as { monoUrl?: string }).monoUrl) setActiveFaviconMonoUrl((res as { monoUrl?: string }).monoUrl!);
      toast.success("Favicon generated (color + light-blue) and applied across the site.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Favicon generation failed");
    } finally {
      setGeneratingFavicon(false);
    }
  }

  async function onApplyFavicon() {
    setApplyingFavicon(true);
    try {
      const res = await applyFavicon();
      setActiveFaviconUrl(res.url);
      if ((res as { monoUrl?: string }).monoUrl) setActiveFaviconMonoUrl((res as { monoUrl?: string }).monoUrl!);
      toast.success("Favicon re-applied across the site. Browser tabs will refresh shortly.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply favicon");
    } finally {
      setApplyingFavicon(false);
    }
  }


  async function onDeletePair(pairId: string, ids: string[]) {
    if (!confirm("Delete this logo pair?")) return;
    const prev = pairs;
    setPairs((s) => s.filter((p) => p.pairId !== pairId));
    try {
      for (const id of ids) await remove({ data: { id } });
      toast.success("Deleted");
    } catch (e) {
      setPairs(prev);
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  async function downloadLogoAsset(url: string, basename: string, spec: DownloadSpec) {
    try {
      if (spec.format === "source") {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("Download failed");
        const blob = await res.blob();
        const ext = blob.type.includes("svg") ? "svg" : blob.type.includes("webp") ? "webp" : blob.type.includes("jpeg") ? "jpg" : "png";
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `${basename}-${spec.filenameSuffix}.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        return;
      }

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const isSvg = blob.type.includes("svg");
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.decoding = "async";
      // SVG sources need an explicit large intrinsic size before decode so
      // the rasterizer paints at full resolution rather than 300×150 default.
      if (isSvg) {
        img.width = Math.max(spec.width ?? spec.size ?? 2048, 2048);
        img.height = Math.max(spec.height ?? spec.size ?? 2048, 2048);
      }
      img.src = objectUrl;
      await img.decode();

      const sourceW = img.naturalWidth || spec.size || 1024;
      const sourceH = img.naturalHeight || spec.size || 1024;
      const targetW = spec.width ?? (spec.square ? spec.size! : spec.size!);
      const targetH = spec.height ?? (spec.square ? spec.size! : Math.round((targetW * sourceH) / sourceW));
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.clearRect(0, 0, targetW, targetH);
      const padPct = spec.padPct ?? (spec.square ? 0.1 : 0);
      const pad = Math.round(Math.min(targetW, targetH) * padPct);
      const maxW = targetW - pad * 2;
      const maxH = targetH - pad * 2;
      const scale = Math.min(maxW / sourceW, maxH / sourceH);
      const drawW = Math.round(sourceW * scale);
      const drawH = Math.round(sourceH * scale);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, Math.round((targetW - drawW) / 2), Math.round((targetH - drawH) / 2), drawW, drawH);
      URL.revokeObjectURL(objectUrl);
      const pngBlob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error("PNG export failed")), "image/png"),
      );
      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${basename}-${spec.filenameSuffix}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-[var(--electric)]" /> AI Logo Studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Every generation produces a crisp scalable logo pair — the same exact artwork in light-background and dark-background color treatments. Apply both with one click.
          </p>
        </div>
        {(activeLightUrl || activeDarkUrl) && (
          <Button variant="outline" size="sm" onClick={onClear}>Revert to default</Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="space-y-2">
            <Label>Variant</Label>
            <div className="grid gap-2">
              {(Object.entries(LOGO_VARIANTS) as [LogoVariant, typeof LOGO_VARIANTS[LogoVariant]][]).map(([key, v]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVariant(key)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    variant === key
                      ? "border-[var(--electric)] bg-[var(--electric)]/10 text-foreground"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <span className="font-medium">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Extra direction (optional)</Label>
            <Textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='e.g. "incorporate a subtle wheel motif"'
            />
          </div>

          <Button onClick={onGenerate} disabled={loading} className="w-full bg-electric-gradient text-white">
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating pair…</>
              : <><Sparkles className="mr-2 h-4 w-4" /> Generate logo pair</>}
          </Button>
          <p className="text-xs text-muted-foreground">
            Logos are created as scalable artwork with transparent backgrounds and downloadable PNG sizes.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          {!result && !loading && (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center text-muted-foreground">
              <ImageIcon className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">Your latest generated logo pair will appear here.</p>
            </div>
          )}
          {loading && (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center text-muted-foreground">
              <Loader2 className="mb-3 h-10 w-10 animate-spin text-[var(--electric)]" />
              <p className="text-sm">Designing your logo pair… 40–90 seconds.</p>
              <p className="mt-1 text-xs">Step 1: light-bg master · Step 2: dark-bg recolor.</p>
            </div>
          )}
          {result && (
            <div className="space-y-5">
              <div>
                <p className="font-semibold">{result.label}</p>
                <p className="text-xs text-muted-foreground">Same artwork, two color treatments.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <PreviewTile title="Light background" side={result.light} checker={CHECKER_LIGHT} onDownload={downloadLogoAsset} fallbackB64={result.light?.b64} />
                <PreviewTile title="Dark background" side={result.dark} checker={CHECKER_DARK} onDownload={downloadLogoAsset} fallbackB64={result.dark?.b64} failed={result.darkFailed} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => onApplyPair(result.pairId)}
                  disabled={busyPairId === result.pairId}
                  className="bg-electric-gradient text-white"
                >
                  {busyPairId === result.pairId
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Check className="mr-2 h-4 w-4" />}
                  Apply pair to site
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-[var(--electric)]" />
          <div>
            <h2 className="text-lg font-semibold">Upload your own logo</h2>
            <p className="text-xs text-muted-foreground">
              Drop in a transparent PNG (recommended), SVG, JPEG, or WEBP. Provide a light-bg version, a dark-bg version, or both — then apply across the site like an AI-generated pair.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_240px]">
          <div className="space-y-2">
            <Label htmlFor="up-light">Light-background version</Label>
            <div className="overflow-hidden rounded-lg border border-border" style={CHECKER_LIGHT}>
              {upLightPreview ? (
                <img src={upLightPreview} alt="Light preview" className="mx-auto max-h-[160px] w-full object-contain p-3" />
              ) : (
                <div className="flex h-[160px] items-center justify-center text-xs text-muted-foreground">No file</div>
              )}
            </div>
            <Input id="up-light" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={pickFile("light")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="up-dark">Dark-background version</Label>
            <div className="overflow-hidden rounded-lg border border-border" style={CHECKER_DARK}>
              {upDarkPreview ? (
                <img src={upDarkPreview} alt="Dark preview" className="mx-auto max-h-[160px] w-full object-contain p-3" />
              ) : (
                <div className="flex h-[160px] items-center justify-center text-xs text-white/60">No file</div>
              )}
            </div>
            <Input id="up-dark" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={pickFile("dark")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="up-label">Label</Label>
            <Input id="up-label" value={upLabel} onChange={(e) => setUpLabel(e.target.value)} placeholder="e.g. Final brand logo" />
            <Button onClick={onUpload} disabled={uploading} className="w-full bg-electric-gradient text-white">
              {uploading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                : <><Upload className="mr-2 h-4 w-4" /> Save to library</>}
            </Button>
            <p className="text-[17px] text-muted-foreground">Max 6MB per file. Transparent PNG recommended for best results.</p>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--electric)]" />
          <div>
            <h2 className="text-lg font-semibold">Site favicon (browser tab icon)</h2>
            <p className="text-xs text-muted-foreground">
              Extracts ONLY the icon/mark from the currently-active logo (no text) and applies it as the favicon across the whole site — what visitors see in their browser tab and what Google indexes.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Color variant <span className="text-muted-foreground">(transparent)</span></Label>
            <div className="overflow-hidden rounded-lg border border-border" style={CHECKER_LIGHT}>
              {activeFaviconUrl ? (
                <img src={activeFaviconUrl} alt="Color favicon" className="mx-auto h-[160px] w-[160px] object-contain p-3" />
              ) : (
                <div className="flex h-[160px] items-center justify-center text-center text-xs text-muted-foreground">
                  No custom favicon yet — using the bundled default.
                </div>
              )}
            </div>
            <p className="text-[17px] text-muted-foreground">
              Checker pattern indicates true transparency — it's not part of the image. This is the favicon browsers and Google use.
            </p>
            {activeFaviconUrl && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline"
                  onClick={() => downloadLogoAsset(activeFaviconUrl, "awa-favicon-color", { label: "256²", filenameSuffix: "256", format: "png", size: 256, square: true, padPct: 0.04 })}>
                  <Download className="mr-2 h-4 w-4" /> 256²
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => downloadLogoAsset(activeFaviconUrl, "awa-favicon-color", { label: "512²", filenameSuffix: "512", format: "png", size: 512, square: true, padPct: 0.04 })}>
                  <Download className="mr-2 h-4 w-4" /> 512²
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => downloadLogoAsset(activeFaviconUrl, "awa-favicon-color", { label: "Source", filenameSuffix: "source", format: "source" })}>
                  <Download className="mr-2 h-4 w-4" /> Source PNG
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Light-blue variant <span className="text-muted-foreground">(for dark backgrounds)</span></Label>
            <div className="overflow-hidden rounded-lg border border-border" style={CHECKER_DARK}>
              {activeFaviconMonoUrl ? (
                <img src={activeFaviconMonoUrl} alt="Light-blue favicon" className="mx-auto h-[160px] w-[160px] object-contain p-3" />
              ) : (
                <div className="flex h-[160px] items-center justify-center text-center text-xs text-muted-foreground/80">
                  Generate the favicon to create the light-blue variant.
                </div>
              )}
            </div>
            <p className="text-[17px] text-muted-foreground">
              Same icon, tinted light blue with a real transparent background — for dark navbars, dark-mode tabs, and printed/email use.
            </p>
            {activeFaviconMonoUrl && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline"
                  onClick={() => downloadLogoAsset(activeFaviconMonoUrl, "awa-favicon-lightblue", { label: "256²", filenameSuffix: "256", format: "png", size: 256, square: true, padPct: 0.04 })}>
                  <Download className="mr-2 h-4 w-4" /> 256²
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => downloadLogoAsset(activeFaviconMonoUrl, "awa-favicon-lightblue", { label: "512²", filenameSuffix: "512", format: "png", size: 512, square: true, padPct: 0.04 })}>
                  <Download className="mr-2 h-4 w-4" /> 512²
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => downloadLogoAsset(activeFaviconMonoUrl, "awa-favicon-lightblue", { label: "Source", filenameSuffix: "source", format: "source" })}>
                  <Download className="mr-2 h-4 w-4" /> Source PNG
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            onClick={onGenerateFavicon}
            disabled={generatingFavicon || !activeLightUrl}
            className="bg-electric-gradient text-white"
          >
            {generatingFavicon
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extracting icon…</>
              : <><Wand2 className="mr-2 h-4 w-4" /> Generate favicon from active logo</>}
          </Button>

          {activeFaviconUrl && (
            <Button
              onClick={onApplyFavicon}
              disabled={applyingFavicon}
              variant="outline"
            >
              {applyingFavicon
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying…</>
                : <><CheckCircle2 className="mr-2 h-4 w-4" /> Apply favicon across site</>}
            </Button>
          )}
        </div>

        {!activeLightUrl && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            Apply a logo pair to the site first — the favicon is extracted from whichever logo is currently live.
          </p>
        )}
      </div>



      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Logo library</h2>
          <p className="text-xs text-muted-foreground">
            Every pair is saved here. {pairs.length > 0 && `${pairs.length} pair${pairs.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        {loadingSaved ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading library…
          </div>
        ) : pairs.length === 0 && orphans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <ImageIcon className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No logos yet — generate a pair above to start your library.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pairs.map((p) => {
              const prompt = remixPrompts[p.pairId] ?? "";
              const remixTarget = p.light?.id ?? p.dark?.id ?? "";
              const busyRemix = !!remixTarget && remixingId === remixTarget;
              const isActive = (p.light?.isActiveLight ?? false) || (p.dark?.isActiveDark ?? false);
              return (
                <div key={p.pairId} className={`rounded-xl border bg-soft p-4 ${isActive ? "border-[var(--electric)] ring-2 ring-[var(--electric)]/30" : "border-border"}`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{p.light?.label?.replace(/ — light bg$/, "") ?? p.dark?.label ?? "Logo pair"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button onClick={() => onDeletePair(p.pairId, [p.light?.id, p.dark?.id].filter(Boolean) as string[])} variant="outline" size="icon" title="Delete pair">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <LibraryTile side={p.light} title="Light background" checker={CHECKER_LIGHT} onDownload={downloadLogoAsset} />
                    <LibraryTile side={p.dark} title="Dark background" checker={CHECKER_DARK} onDownload={downloadLogoAsset} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => onApplyPair(p.pairId)}
                      disabled={busyPairId === p.pairId || isActive}
                      size="sm"
                      className={isActive ? "" : "bg-electric-gradient text-white"}
                      variant={isActive ? "outline" : "default"}
                    >
                      {busyPairId === p.pairId
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : isActive
                          ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Currently applied</>
                          : <><Check className="mr-2 h-4 w-4" /> Apply pair to site</>}
                    </Button>
                    <Button
                      onClick={() => onRepairPair(p.pairId)}
                      disabled={repairingPairId === p.pairId}
                      size="sm"
                      variant="outline"
                    >
                      {repairingPairId === p.pairId
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Wand2 className="mr-2 h-4 w-4" />}
                      Repair crisp asset
                    </Button>
                    {remixTarget && (
                      <div className="flex flex-1 min-w-[260px] gap-2">
                        <Input
                          value={prompt}
                          onChange={(e) => setRemixPrompts((s) => ({ ...s, [p.pairId]: e.target.value }))}
                          placeholder="Quick fix (will regenerate the light version)…"
                          disabled={busyRemix}
                          className="h-9 text-sm"
                          onKeyDown={(e) => { if (e.key === "Enter") onRemix(remixTarget, prompt); }}
                        />
                        <Button
                          onClick={() => onRemix(remixTarget, prompt)}
                          disabled={busyRemix || !prompt.trim()}
                          size="sm"
                          className="bg-electric-gradient text-white"
                          title="Remix with AI"
                        >
                          {busyRemix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {orphans.length > 0 && (
              <div className="rounded-xl border border-dashed border-border bg-background/40 p-4">
                <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Older single-version logos</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {orphans.map((o) => (
                    <div key={o.id} className="overflow-hidden rounded-lg border border-border bg-card">
                      <div style={CHECKER_LIGHT}>
                        <img src={o.url} alt={o.label} className="mx-auto max-h-40 w-full object-contain" loading="lazy" />
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2">
                        <p className="truncate text-xs">{o.label}</p>
                        <Button onClick={() => downloadLogoAsset(o.url, `awa-logo-${o.id}`, LOGO_DOWNLOADS[1])} variant="ghost" size="icon" title="Download">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function PreviewTile({
  title, side, checker, fallbackB64, failed, onDownload,
}: {
  title: string;
  side: PairSide | null;
  checker: React.CSSProperties;
  fallbackB64?: string;
  failed?: boolean;
  onDownload: (url: string, basename: string, spec: DownloadSpec) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-background/60 px-3 py-1.5 text-xs font-medium">{title}</div>
      {side ? (
        <>
          <div style={checker}>
            <img
              src={side.url}
              alt={title}
              className="mx-auto max-h-[280px] w-full object-contain"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 p-2">
            {LOGO_DOWNLOADS.map((spec) => (
              <Button key={spec.filenameSuffix} onClick={() => onDownload(side.url, `awa-logo-${side.mode}-${side.id}`, spec)} variant="outline" size="sm">
                <Download className="mr-1.5 h-3.5 w-3.5" /> {spec.label}
              </Button>
            ))}
          </div>
        </>
      ) : fallbackB64 ? (
        <div style={checker}>
          <img src={`data:image/png;base64,${fallbackB64}`} alt={title} className="mx-auto max-h-[280px] w-full object-contain" />
        </div>
      ) : (
        <div className="flex h-[200px] items-center justify-center bg-muted/40 text-center text-xs text-muted-foreground">
          {failed ? "Recolor pass failed — use Remix to retry." : "Not generated."}
        </div>
      )}
    </div>
  );
}

function LibraryTile({
  side, title, checker, onDownload,
}: {
  side: SavedItem | null;
  title: string;
  checker: React.CSSProperties;
  onDownload: (url: string, basename: string, spec: DownloadSpec) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-background/60 px-3 py-1 text-[17px] font-medium">
        <span>{title}</span>
        {side && (side.isActiveLight || side.isActiveDark) && (
          <span className="inline-flex items-center gap-1 text-[17px] text-[var(--electric)]">
            <CheckCircle2 className="h-3 w-3" /> Live
          </span>
        )}
      </div>
      {side ? (
        <>
          <div style={checker}>
            <img src={side.url} alt={title} loading="lazy" className="mx-auto max-h-44 w-full object-contain" />
          </div>
          <div className="flex flex-wrap justify-end gap-1 p-1.5">
            {LOGO_DOWNLOADS.map((spec) => (
              <Button key={spec.filenameSuffix} onClick={() => onDownload(side.url, `awa-logo-${side.pairMode ?? "logo"}-${side.id}`, spec)} variant="ghost" size="sm" title={`Download ${spec.label}`}>
                <Download className="h-3.5 w-3.5" /> {spec.label}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex h-32 items-center justify-center bg-muted/40 text-center text-xs text-muted-foreground">Missing</div>
      )}
    </div>
  );
}
