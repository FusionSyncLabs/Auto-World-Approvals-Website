import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Transformer, Rect } from "react-konva";
import type Konva from "konva";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ImagePlus, Type, Trash2, Download, ArrowUp, ArrowDown,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Loader2, Save,
} from "lucide-react";
import { toast } from "sonner";

type ImageNode = {
  id: string;
  kind: "image";
  src: string;
  image: HTMLImageElement;
  x: number; y: number; width: number; height: number; rotation: number;
};
type TextNode = {
  id: string;
  kind: "text";
  text: string;
  x: number; y: number; width: number; rotation: number;
  fontSize: number; fontFamily: string; fontStyle: string; align: "left" | "center" | "right";
  fill: string;
  shadow: boolean;
};
type Node = ImageNode | TextNode;

function uid() { return Math.random().toString(36).slice(2, 10); }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export type BannerOverlays = {
  headline?: string;
  tagline?: string;
  logoUrl?: string | null;
  subjectUrl?: string | null;
  subjectUrls?: string[] | null;
  textZone?: "left" | "right" | "center";
  textColor?: "light" | "dark";
  templateId?: string;
} | null;

export function BannerCanvasEditor({
  open,
  onOpenChange,
  backgroundUrl,
  overlays,
  title,
  defaultFileName = "banner-edited.png",
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  backgroundUrl: string | null;
  overlays?: BannerOverlays;
  title?: string;
  defaultFileName?: string;
  onSave?: (dataUrl: string) => Promise<void> | void;
}) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [displayWidth, setDisplayWidth] = useState(900);
  const [loadingBg, setLoadingBg] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load background + auto-populate overlays when opened
  useEffect(() => {
    if (!open) return;
    setNodes([]);
    setSelectedId(null);
    if (!backgroundUrl) { setBg(null); return; }
    setLoadingBg(true);
    loadImage(backgroundUrl)
      .then(async (img) => {
        setBg(img);
        // Auto-populate text + logo as separate, editable layers
        if (overlays) {
          const nW = img.naturalWidth;
          const nH = img.naturalHeight;
          const dispW = displayWidth;
          const s = dispW / nW;
          const dispH = nH * s;
          const zone = overlays.textZone ?? "left";
          const isCenter = zone === "center";
          const zoneLeft = zone === "left";
          const padX = dispW * 0.05;
          const colWidth = isCenter ? dispW * 0.86 : dispW * 0.42;
          const xStart = isCenter
            ? (dispW - colWidth) / 2
            : zoneLeft
              ? padX
              : dispW - padX - colWidth;
          const align: "left" | "right" | "center" = isCenter ? "center" : (zoneLeft ? "left" : "right");
          const isDark = (overlays.textColor ?? "light") === "dark";
          const headlineFill = isDark ? "#0F1B3D" : "#ffffff";
          const taglineFill = isDark ? "#1f2937" : "#e6efff";
          const newNodes: Node[] = [];

          if (overlays.headline) {
            const headlineSize = Math.round(dispH * 0.12);
            newNodes.push({
              id: uid(),
              kind: "text",
              text: overlays.headline,
              x: xStart,
              y: isCenter ? dispH * 0.18 : dispH * 0.28,
              width: colWidth,
              rotation: 0,
              fontSize: headlineSize,
              fontFamily: "Inter, system-ui, sans-serif",
              fontStyle: "bold",
              align,
              fill: headlineFill,
              shadow: !isDark,
            });
          }
          if (overlays.tagline) {
            const tagSize = Math.round(dispH * 0.05);
            newNodes.push({
              id: uid(),
              kind: "text",
              text: overlays.tagline,
              x: xStart,
              y: isCenter ? dispH * 0.42 : dispH * 0.58,
              width: colWidth,
              rotation: 0,
              fontSize: tagSize,
              fontFamily: "Inter, system-ui, sans-serif",
              fontStyle: "normal",
              align,
              fill: taglineFill,
              shadow: !isDark,
            });
          }
          if (overlays.logoUrl) {
            try {
              const logoImg = await loadImage(overlays.logoUrl);
              const logoW = dispW * 0.18;
              const logoH = (logoImg.naturalHeight / logoImg.naturalWidth) * logoW;
              newNodes.push({
                id: uid(),
                kind: "image",
                src: overlays.logoUrl,
                image: logoImg,
                x: isCenter ? (dispW - logoW) / 2 : (zoneLeft ? padX : dispW - padX - logoW),
                y: dispH * 0.04,
                width: logoW,
                height: logoH,
                rotation: 0,
              });
            } catch {
              console.warn("[editor] logo failed to load");
            }
          }
          // Subject overlay(s) — original client photo, untouched, composited on top
          const subjectList = (overlays.subjectUrls && overlays.subjectUrls.length
            ? overlays.subjectUrls
            : overlays.subjectUrl ? [overlays.subjectUrl] : []) as string[];
          // Subject occupies side OPPOSITE the text zone (or right side if center)
          const subjectZoneLeft = isCenter ? false : !zoneLeft;
          // Place subject(s) BELOW text/logo nodes in the stacking order so user can re-arrange easily — push first so they render under text
          const subjectNodes: Node[] = [];
          for (let i = 0; i < subjectList.length; i++) {
            const url = subjectList[i];
            try {
              const subImg = await loadImage(url);
              const targetH = dispH * 0.92;
              const targetW = (subImg.naturalWidth / subImg.naturalHeight) * targetH;
              const maxW = isCenter ? dispW * 0.55 : dispW * 0.55;
              let w = targetW; let h = targetH;
              if (w > maxW) { const s2 = maxW / w; w = maxW; h = h * s2; }
              const slotX = isCenter
                ? (dispW - w) / 2 + (i - (subjectList.length - 1) / 2) * (w * 0.6)
                : subjectZoneLeft
                  ? padX + i * (w * 0.15)
                  : dispW - padX - w - i * (w * 0.15);
              subjectNodes.push({
                id: uid(),
                kind: "image",
                src: url,
                image: subImg,
                x: slotX,
                y: dispH - h, // anchor to bottom
                width: w,
                height: h,
                rotation: 0,
              });
            } catch {
              console.warn("[editor] subject overlay failed to load", url);
            }
          }
          // Subjects go first (bottom of stack), then text/logo on top
          if (subjectNodes.length) newNodes.unshift(...subjectNodes);
          if (newNodes.length) setNodes(newNodes);
        }
      })
      .catch(() => toast.error("Failed to load banner image"))
      .finally(() => setLoadingBg(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, backgroundUrl]);

  // Stage size from bg
  const { stageW, stageH, scale, naturalW, naturalH } = useMemo(() => {
    const nW = bg?.naturalWidth ?? 1200;
    const nH = bg?.naturalHeight ?? 628;
    const s = displayWidth / nW;
    return { stageW: displayWidth, stageH: Math.round(nH * s), scale: s, naturalW: nW, naturalH: nH };
  }, [bg, displayWidth]);

  // Responsive width
  useEffect(() => {
    function update() {
      const w = Math.min(window.innerWidth - 420, 1100);
      setDisplayWidth(Math.max(400, w));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Attach transformer to selected node
  useEffect(() => {
    const tr = transformerRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;
    if (!selectedId) { tr.nodes([]); layer.batchDraw(); return; }
    const node = layer.findOne<Konva.Node>(`#${selectedId}`);
    if (node) { tr.nodes([node]); layer.batchDraw(); }
    else { tr.nodes([]); layer.batchDraw(); }
  }, [selectedId, nodes]);

  const selected = nodes.find((n) => n.id === selectedId) || null;

  async function onAddPhoto(file: File) {
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const img = await loadImage(dataUrl);
      // Default size: 40% of stage width, preserving aspect
      const w = stageW * 0.4;
      const h = (img.naturalHeight / img.naturalWidth) * w;
      const node: ImageNode = {
        id: uid(),
        kind: "image",
        src: dataUrl,
        image: img,
        x: (stageW - w) / 2,
        y: (stageH - h) / 2,
        width: w,
        height: h,
        rotation: 0,
      };
      setNodes((s) => [...s, node]);
      setSelectedId(node.id);
    } catch (e) {
      toast.error("Could not load photo");
    }
  }

  function onAddText() {
    const node: TextNode = {
      id: uid(),
      kind: "text",
      text: "Your headline",
      x: stageW * 0.1,
      y: stageH * 0.4,
      width: stageW * 0.6,
      rotation: 0,
      fontSize: Math.round(stageH * 0.08),
      fontFamily: "Inter, system-ui, sans-serif",
      fontStyle: "bold",
      align: "left",
      fill: "#ffffff",
      shadow: true,
    };
    setNodes((s) => [...s, node]);
    setSelectedId(node.id);
  }

  function updateNode(id: string, patch: Partial<Node>) {
    setNodes((s) => s.map((n) => (n.id === id ? ({ ...n, ...patch } as Node) : n)));
  }

  function deleteSelected() {
    if (!selectedId) return;
    setNodes((s) => s.filter((n) => n.id !== selectedId));
    setSelectedId(null);
  }

  function moveLayer(dir: "up" | "down") {
    if (!selectedId) return;
    setNodes((s) => {
      const i = s.findIndex((n) => n.id === selectedId);
      if (i < 0) return s;
      const j = dir === "up" ? Math.min(s.length - 1, i + 1) : Math.max(0, i - 1);
      if (i === j) return s;
      const arr = [...s];
      const [it] = arr.splice(i, 1);
      arr.splice(j, 0, it);
      return arr;
    });
  }

  async function rasterize(): Promise<string | null> {
    const stage = stageRef.current;
    if (!stage) return null;
    setSelectedId(null);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const pixelRatio = bg ? naturalW / stageW : 2;
    return stage.toDataURL({ pixelRatio, mimeType: "image/png" });
  }

  async function onExport() {
    setExporting(true);
    try {
      const dataUrl = await rasterize();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = defaultFileName;
      a.click();
      toast.success("Exported PNG");
    } catch (e) {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function onSaveClick() {
    if (!onSave) return;
    setSaving(true);
    try {
      const dataUrl = await rasterize();
      if (!dataUrl) return;
      await onSave(dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle>{title ?? "Canvas Editor"}</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[calc(95vh-60px)] flex-col gap-4 overflow-auto p-4 lg:flex-row">
          {/* Canvas */}
          <div className="flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onAddPhoto(f);
                  if (e.target) e.target.value = "";
                }}
              />
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="mr-2 h-4 w-4" /> Add photo
              </Button>
              <Button size="sm" variant="outline" onClick={onAddText}>
                <Type className="mr-2 h-4 w-4" /> Add text
              </Button>
              <div className="mx-1 h-6 w-px bg-border" />
              <Button size="sm" variant="outline" onClick={() => moveLayer("up")} disabled={!selectedId}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => moveLayer("down")} disabled={!selectedId}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={deleteSelected} disabled={!selectedId}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="ml-auto flex gap-2">
                {onSave && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onSaveClick}
                    disabled={saving || exporting || loadingBg}
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save to library
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={onExport}
                  disabled={exporting || loadingBg}
                  className="bg-electric-gradient text-white"
                >
                  {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Export PNG
                </Button>
              </div>
            </div>

            <div className="overflow-auto rounded-lg border border-border bg-[#1a1a1a]" style={{ maxHeight: "calc(95vh - 180px)" }}>
              {loadingBg ? (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
                </div>
              ) : (
                <Stage
                  ref={stageRef}
                  width={stageW}
                  height={stageH}
                  onMouseDown={(e) => {
                    if (e.target === e.target.getStage()) setSelectedId(null);
                  }}
                  onTouchStart={(e) => {
                    if (e.target === e.target.getStage()) setSelectedId(null);
                  }}
                >
                  <Layer ref={layerRef}>
                    {bg ? (
                      <KonvaImage image={bg} x={0} y={0} width={stageW} height={stageH} listening={false} />
                    ) : (
                      <Rect x={0} y={0} width={stageW} height={stageH} fill="#0F1B3D" listening={false} />
                    )}
                    {nodes.map((n) =>
                      n.kind === "image" ? (
                        <KonvaImage
                          key={n.id}
                          id={n.id}
                          image={n.image}
                          x={n.x}
                          y={n.y}
                          width={n.width}
                          height={n.height}
                          rotation={n.rotation}
                          draggable
                          onClick={() => setSelectedId(n.id)}
                          onTap={() => setSelectedId(n.id)}
                          onDragEnd={(e) =>
                            updateNode(n.id, { x: e.target.x(), y: e.target.y() })
                          }
                          onTransformEnd={(e) => {
                            const node = e.target as Konva.Image;
                            const sx = node.scaleX();
                            const sy = node.scaleY();
                            node.scaleX(1);
                            node.scaleY(1);
                            updateNode(n.id, {
                              x: node.x(),
                              y: node.y(),
                              width: Math.max(20, node.width() * sx),
                              height: Math.max(20, node.height() * sy),
                              rotation: node.rotation(),
                            });
                          }}
                        />
                      ) : (
                        <KonvaText
                          key={n.id}
                          id={n.id}
                          text={n.text}
                          x={n.x}
                          y={n.y}
                          width={n.width}
                          rotation={n.rotation}
                          fontSize={n.fontSize}
                          fontFamily={n.fontFamily}
                          fontStyle={n.fontStyle}
                          align={n.align}
                          fill={n.fill}
                          shadowColor={n.shadow ? "#000" : undefined}
                          shadowBlur={n.shadow ? 8 : 0}
                          shadowOpacity={n.shadow ? 0.6 : 0}
                          shadowOffset={n.shadow ? { x: 1, y: 2 } : undefined}
                          draggable
                          onClick={() => setSelectedId(n.id)}
                          onTap={() => setSelectedId(n.id)}
                          onDragEnd={(e) =>
                            updateNode(n.id, { x: e.target.x(), y: e.target.y() })
                          }
                          onTransformEnd={(e) => {
                            const node = e.target as Konva.Text;
                            const sx = node.scaleX();
                            node.scaleX(1);
                            node.scaleY(1);
                            updateNode(n.id, {
                              x: node.x(),
                              y: node.y(),
                              width: Math.max(40, node.width() * sx),
                              rotation: node.rotation(),
                            });
                          }}
                        />
                      ),
                    )}
                    <Transformer
                      ref={transformerRef}
                      rotateEnabled
                      anchorSize={10}
                      borderStroke="#2D7BFF"
                      anchorStroke="#2D7BFF"
                      anchorFill="#ffffff"
                      boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 20 || newBox.height < 20) return oldBox;
                        return newBox;
                      }}
                    />
                  </Layer>
                </Stage>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tip: drag handles to resize/rotate. Click an empty area to deselect. Export rasterizes at the original banner resolution ({naturalW}×{naturalH}).
            </p>
          </div>

          {/* Side panel */}
          <div className="w-full shrink-0 space-y-4 rounded-lg border border-border bg-card p-4 lg:w-[300px]">
            <p className="text-sm font-semibold">
              {selected ? `Selected: ${selected.kind === "image" ? "Photo" : "Text"}` : "Nothing selected"}
            </p>
            {!selected && (
              <p className="text-xs text-muted-foreground">
                Add a photo or text layer, then click it on the canvas to edit its properties here.
              </p>
            )}
            {selected?.kind === "text" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Content</Label>
                  <textarea
                    value={selected.text}
                    onChange={(e) => updateNode(selected.id, { text: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Font size</Label>
                    <Input
                      type="number"
                      value={selected.fontSize}
                      onChange={(e) => updateNode(selected.id, { fontSize: Math.max(8, Number(e.target.value) || 0) })}
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Color</Label>
                    <input
                      type="color"
                      value={selected.fill}
                      onChange={(e) => updateNode(selected.id, { fill: e.target.value })}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Style</Label>
                  <div className="mt-1 flex gap-1">
                    <Button
                      size="sm"
                      variant={selected.fontStyle.includes("bold") ? "default" : "outline"}
                      onClick={() => {
                        const hasBold = selected.fontStyle.includes("bold");
                        const hasItalic = selected.fontStyle.includes("italic");
                        const next = [hasBold ? "" : "bold", hasItalic ? "italic" : ""].filter(Boolean).join(" ") || "normal";
                        updateNode(selected.id, { fontStyle: next });
                      }}
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={selected.fontStyle.includes("italic") ? "default" : "outline"}
                      onClick={() => {
                        const hasBold = selected.fontStyle.includes("bold");
                        const hasItalic = selected.fontStyle.includes("italic");
                        const next = [hasBold ? "bold" : "", hasItalic ? "" : "italic"].filter(Boolean).join(" ") || "normal";
                        updateNode(selected.id, { fontStyle: next });
                      }}
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Align</Label>
                  <div className="mt-1 flex gap-1">
                    {(["left", "center", "right"] as const).map((a) => (
                      <Button
                        key={a}
                        size="sm"
                        variant={selected.align === a ? "default" : "outline"}
                        onClick={() => updateNode(selected.id, { align: a })}
                      >
                        {a === "left" ? <AlignLeft className="h-4 w-4" /> : a === "center" ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
                      </Button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selected.shadow}
                    onChange={(e) => updateNode(selected.id, { shadow: e.target.checked })}
                  />
                  Drop shadow (improves readability)
                </label>
              </div>
            )}
            {selected?.kind === "image" && (
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Drag to move. Use the corner handles to resize and the top handle to rotate.</p>
                <Button size="sm" variant="outline" onClick={deleteSelected} className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" /> Remove photo
                </Button>
              </div>
            )}

            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium">Layers ({nodes.length})</p>
              <div className="space-y-1">
                {nodes.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
                {[...nodes].reverse().map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs ${
                      selectedId === n.id ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <span className="truncate">
                      {n.kind === "text" ? `T · ${(n as TextNode).text.slice(0, 20)}` : "Photo"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
