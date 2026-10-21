import { useState } from "react";
import type { BannerOverlays } from "./BannerCanvasEditor";

/**
 * Banner preview that mirrors the canvas editor's auto-layout EXACTLY,
 * so the thumbnail = editor open state = exported PNG.
 *
 * Editor reference (BannerCanvasEditor auto-populate, units = % of natural W/H):
 *   padX      = 5,  colWidth = 42
 *   headline  : x=padX, y=28, w=42, fontSize=12 (% of height), bold
 *   tagline   : x=padX, y=58, w=42, fontSize=5  (% of height)
 *   logo      : x=padX, y=8,  w=18 (% of width)
 *
 * Uses SVG with viewBox matching the image's natural dimensions so coords map 1:1.
 */
export function BannerPreview({
  src,
  alt,
  overlays,
  className,
}: {
  src: string;
  alt: string;
  overlays: BannerOverlays;
  className?: string;
}) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const subjectList = (overlays?.subjectUrls && overlays.subjectUrls.length
    ? overlays.subjectUrls
    : overlays?.subjectUrl ? [overlays.subjectUrl] : []) as string[];
  const hasOverlay = !!(overlays && (overlays.headline || overlays.tagline || overlays.logoUrl || subjectList.length));
  const zone = overlays?.textZone ?? "left";
  const isCenter = zone === "center";
  const zoneLeft = zone === "left";
  const isDark = (overlays?.textColor ?? "light") === "dark";
  const headlineFill = isDark ? "#0F1B3D" : "#ffffff";
  const taglineFill = isDark ? "#1f2937" : "#e6efff";

  return (
    <div className={`relative ${className ?? ""}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="block w-full"
        onLoad={(e) => {
          const img = e.currentTarget;
          setDims({ w: img.naturalWidth || 1200, h: img.naturalHeight || 628 });
        }}
      />
      {hasOverlay && dims && (
        <svg
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {(() => {
            const W = dims.w;
            const H = dims.h;
            const padX = W * 0.05;
            const colW = isCenter ? W * 0.86 : W * 0.42;
            const xStart = isCenter ? (W - colW) / 2 : (zoneLeft ? padX : W - padX - colW);
            const anchor: "start" | "middle" | "end" = isCenter ? "middle" : (zoneLeft ? "start" : "end");
            const textX = isCenter ? W / 2 : (zoneLeft ? xStart : xStart + colW);
            const headlineSize = H * 0.12;
            const tagSize = H * 0.05;
            const logoW = W * 0.18;
            const logoX = isCenter ? (W - logoW) / 2 : (zoneLeft ? padX : W - padX - logoW);
            const headY = isCenter ? H * 0.18 : H * 0.28;
            const tagY = isCenter ? H * 0.42 : H * 0.58;

            const subjectZoneLeft = isCenter ? false : !zoneLeft;
            const subjectMaxW = isCenter ? W * 0.55 : W * 0.55;
            const subjectH = H * 0.92;
            return (
              <>
                {subjectList.map((url, i) => {
                  // Assume ~3:4 portrait until image-load events; SVG <image> scales nicely with preserveAspectRatio
                  const sW = Math.min(subjectMaxW, subjectH * 0.75);
                  const slotX = isCenter
                    ? (W - sW) / 2 + (i - (subjectList.length - 1) / 2) * (sW * 0.6)
                    : subjectZoneLeft
                      ? padX + i * (sW * 0.15)
                      : W - padX - sW - i * (sW * 0.15);
                  return (
                    <image
                      key={`subj-${i}`}
                      href={url}
                      x={slotX}
                      y={H - subjectH}
                      width={sW}
                      height={subjectH}
                      preserveAspectRatio="xMidYMax meet"
                    />
                  );
                })}
                {overlays?.logoUrl && (
                  <image
                    href={overlays.logoUrl}
                    x={logoX}
                    y={H * 0.04}
                    width={logoW}
                    preserveAspectRatio="xMidYMid meet"
                  />
                )}
                <defs>
                  <filter id="bp-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation={H * 0.005} />
                    <feOffset dx="0" dy={H * 0.003} result="off" />
                    <feComponentTransfer><feFuncA type="linear" slope="0.7" /></feComponentTransfer>
                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                {overlays?.headline && (
                  <Wrapped
                    text={overlays.headline}
                    x={textX}
                    y={headY + headlineSize}
                    maxWidth={colW}
                    fontSize={headlineSize}
                    fontWeight={700}
                    fill={headlineFill}
                    anchor={anchor}
                    lineHeight={1.05}
                    shadow={!isDark}
                  />
                )}
                {overlays?.tagline && (
                  <Wrapped
                    text={overlays.tagline}
                    x={textX}
                    y={tagY + tagSize}
                    maxWidth={colW}
                    fontSize={tagSize}
                    fontWeight={400}
                    fill={taglineFill}
                    anchor={anchor}
                    lineHeight={1.25}
                    shadow={!isDark}
                  />
                )}
              </>
            );
          })()}
        </svg>
      )}
    </div>
  );
}

/** Naive word-wrap (approximates Konva's word wrap closely enough for previews). */
function Wrapped({
  text, x, y, maxWidth, fontSize, fontWeight, fill, anchor, lineHeight, shadow = true,
}: {
  text: string; x: number; y: number; maxWidth: number;
  fontSize: number; fontWeight: number; fill: string;
  anchor: "start" | "middle" | "end"; lineHeight: number; shadow?: boolean;
}) {
  // Approx char width for Inter at given size
  const charW = fontSize * 0.52;
  const maxChars = Math.max(4, Math.floor(maxWidth / charW));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);

  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fontFamily="Inter, system-ui, sans-serif"
      fontSize={fontSize}
      fontWeight={fontWeight}
      textAnchor={anchor}
      filter={shadow ? "url(#bp-shadow)" : undefined}
    >
      {lines.map((ln, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : fontSize * lineHeight}>{ln}</tspan>
      ))}
    </text>
  );
}
