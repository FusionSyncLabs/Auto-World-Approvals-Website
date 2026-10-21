/**
 * Server-only PNG background removal + auto-trim.
 *
 * Takes a base64 PNG (no data: prefix) and returns a base64 PNG with:
 *  - solid uniform background (sampled from corners) replaced with alpha=0
 *  - transparent margins trimmed
 *
 * Pure JS via upng-js — works in Cloudflare Workers (no native deps).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import UPNG from "upng-js";

type RGBA = { r: number; g: number; b: number; a: number };

function px(buf: Uint8Array, i: number): RGBA {
  return { r: buf[i], g: buf[i + 1], b: buf[i + 2], a: buf[i + 3] };
}

function dist(a: RGBA, b: RGBA) {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isNeutralPaper(c: RGBA) {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const lum = (c.r + c.g + c.b) / 3;
  return c.a > 16 && lum > 132 && max - min < 32;
}

/**
 * Remove a near-uniform background from a PNG.
 * - Samples the 4 corners. If they agree (within tolerance), treats that as the background color.
 * - Any pixel within `tolerance` of the bg color is fully transparent.
 * - Pixels within `feather` of the threshold get partial alpha for clean edges.
 * - After bg removal, the image is auto-cropped to the visible (alpha>16) bounding box plus a small margin.
 */
export async function removeBackgroundAndTrim(
  base64Png: string,
  opts: { tolerance?: number; feather?: number; marginPct?: number; logoMode?: "light" | "dark" | "auto" } = {},
): Promise<string> {
  const tolerance = opts.tolerance ?? 32;
  const feather = opts.feather ?? 16;
  const marginPct = opts.marginPct ?? 0.04;
  const logoMode = opts.logoMode ?? "auto";

  const bin = Uint8Array.from(atob(base64Png), (c) => c.charCodeAt(0));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const img: any = UPNG.decode(bin.buffer);
  const rgbaBuf = new Uint8Array(UPNG.toRGBA8(img)[0]);
  const w: number = img.width;
  const h: number = img.height;

  // Remove model-painted fake checkerboard/plate pixels even when they are
  // centered inside an otherwise transparent export. This is the common case
  // where the image *has* alpha outside, but still contains an opaque grey
  // square behind the logo.
  removeFakeTransparencyPlate(rgbaBuf, w, h, logoMode);
  strengthenVisibleArtwork(rgbaBuf);

  // Sample 4 corners
  const corners = [
    px(rgbaBuf, 0),
    px(rgbaBuf, (w - 1) * 4),
    px(rgbaBuf, (h - 1) * w * 4),
    px(rgbaBuf, ((h - 1) * w + (w - 1)) * 4),
  ];
  // Average corners (ignoring already-transparent ones)
  const opaqueCorners = corners.filter((c) => c.a > 128);
  if (opaqueCorners.length === 0) {
    // Already transparent at the true canvas edge. The fake plate pass above
    // handles any centered checkerboard square; do not flood-fill from the edge
    // or transparent pixels can bridge into white logo artwork.
    return trimAndEncode(rgbaBuf, w, h, marginPct);
  }
  const bg: RGBA = {
    r: Math.round(opaqueCorners.reduce((s, c) => s + c.r, 0) / opaqueCorners.length),
    g: Math.round(opaqueCorners.reduce((s, c) => s + c.g, 0) / opaqueCorners.length),
    b: Math.round(opaqueCorners.reduce((s, c) => s + c.b, 0) / opaqueCorners.length),
    a: 255,
  };

  // Check corners aren't too varied (logo could be touching a corner)
  const cornerSpread = Math.max(...opaqueCorners.map((c) => dist(c, bg)));
  const cornersLookLikeFakeTransparency = opaqueCorners.every(isNeutralPaper);
  if (cornerSpread > 40 && !cornersLookLikeFakeTransparency) {
    return trimAndEncode(rgbaBuf, w, h, marginPct);
  }

  // Remove the background only where it is connected to the canvas edge.
  // This catches solid fills and fake grey/white checkerboard "transparency"
  // without deleting centered white logo artwork for dark-background variants.
  removeEdgeConnectedBackground(rgbaBuf, w, h, opaqueCorners, bg, tolerance, feather);

  return trimAndEncode(rgbaBuf, w, h, marginPct);
}

export async function recolorPngToWhite(base64Png: string): Promise<string> {
  const bin = Uint8Array.from(atob(base64Png), (c) => c.charCodeAt(0));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const img: any = UPNG.decode(bin.buffer);
  const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] <= 16) continue;
    rgba[i] = 255;
    rgba[i + 1] = 255;
    rgba[i + 2] = 255;
    rgba[i + 3] = 255;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const png = (UPNG as any).encode([rgba.buffer], img.width, img.height, 0);
  return base64FromBuf(new Uint8Array(png));
}

/**
 * Recolor every visible (non-transparent) pixel of a PNG to a single tint
 * while preserving the original alpha channel. Use for monochrome icon
 * variants (e.g. a light-blue favicon for dark-background browser tabs/UIs).
 */
export async function recolorPngToTint(base64Png: string, r: number, g: number, b: number): Promise<string> {
  const bin = Uint8Array.from(atob(base64Png), (c) => c.charCodeAt(0));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const img: any = UPNG.decode(bin.buffer);
  const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] <= 16) continue;
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const png = (UPNG as any).encode([rgba.buffer], img.width, img.height, 0);
  return base64FromBuf(new Uint8Array(png));
}




function strengthenVisibleArtwork(rgba: Uint8Array) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] > 16) rgba[i + 3] = 255;
  }
}

function saturation(c: RGBA) {
  return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
}

function luminance(c: RGBA) {
  return (c.r + c.g + c.b) / 3;
}

function removeFakeTransparencyPlate(rgba: Uint8Array, w: number, h: number, mode: "light" | "dark" | "auto") {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c = px(rgba, i);
      if (c.a <= 16) continue;
      const sat = saturation(c);
      const lum = luminance(c);
      const neutral = sat <= 38;

      // Light-background logo: remove white/light-grey checker or paper while
      // preserving navy/blue/black logo strokes.
      const lightPlate = neutral && lum >= 112;
      // Dark-background logo: remove black/dark-grey checker or plate while
      // preserving white logo strokes and their anti-aliased edges.
      const darkPlate = neutral && lum <= 110;

      if (
        (mode === "light" && lightPlate) ||
        (mode === "dark" && darkPlate) ||
        (mode === "auto" && (lightPlate || darkPlate))
      ) {
        rgba[i + 3] = 0;
      }
    }
  }
}

function removeEdgeConnectedBackground(
  rgba: Uint8Array,
  w: number,
  h: number,
  cornerColors: RGBA[],
  avgBg: RGBA,
  tolerance: number,
  feather: number,
) {
  const total = w * h;
  const seen = new Uint8Array(total);
  const stack: number[] = [];
  const closeEnough = tolerance + feather;

  function candidateAt(index: number) {
    const i = index * 4;
    const c = px(rgba, i);
    if (c.a <= 16) return true;
    if (dist(c, avgBg) <= closeEnough) return true;
    if (cornerColors.some((corner) => dist(c, corner) <= closeEnough)) return true;
    return isNeutralPaper(c);
  }

  function push(index: number) {
    if (index < 0 || index >= total || seen[index] || !candidateAt(index)) return;
    seen[index] = 1;
    stack.push(index);
  }

  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    push(y * w);
    push(y * w + (w - 1));
  }

  while (stack.length) {
    const index = stack.pop()!;
    const x = index % w;
    const y = Math.floor(index / w);
    const i = index * 4;
    const c = px(rgba, i);
    const d = Math.min(dist(c, avgBg), ...cornerColors.map((corner) => dist(c, corner)));
    rgba[i + 3] = d <= tolerance || isNeutralPaper(c) ? 0 : Math.round(rgba[i + 3] * ((d - tolerance) / feather));
    if (x > 0) push(index - 1);
    if (x < w - 1) push(index + 1);
    if (y > 0) push(index - w);
    if (y < h - 1) push(index + w);
  }
}

function trimAndEncode(rgba: Uint8Array, w: number, h: number, marginPct: number): string {
  // bounding box of alpha > 16
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = rgba[(y * w + x) * 4 + 3];
      if (a > 16) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    // empty — return original encoded
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = (UPNG as any).encode([rgba.buffer], w, h, 0);
    return base64FromBuf(new Uint8Array(out));
  }

  const bbW = maxX - minX + 1;
  const bbH = maxY - minY + 1;
  // Crop to the actual logo bounds, not a square export. Horizontal wordmarks
  // become wide PNGs whose visible artwork fills header height instead of being
  // trapped inside a mostly-empty square canvas.
  const marginX = Math.max(1, Math.round(bbW * marginPct));
  const marginY = Math.max(1, Math.round(bbH * marginPct));
  const finalW = bbW + marginX * 2;
  const finalH = bbH + marginY * 2;
  const sx = minX - marginX;
  const sy = minY - marginY;

  const out = new Uint8Array(finalW * finalH * 4); // zero-filled = transparent
  for (let y = 0; y < finalH; y++) {
    const srcY = sy + y;
    if (srcY < 0 || srcY >= h) continue;
    for (let x = 0; x < finalW; x++) {
      const srcX = sx + x;
      if (srcX < 0 || srcX >= w) continue;
      const si = (srcY * w + srcX) * 4;
      const di = (y * finalW + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const png = (UPNG as any).encode([out.buffer], finalW, finalH, 0);
  return base64FromBuf(new Uint8Array(png));
}

function base64FromBuf(buf: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    s += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(s);
}
