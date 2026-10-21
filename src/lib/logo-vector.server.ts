import archivoBlackB64 from "./assets/archivo-black.b64.txt?raw";

type LogoVariantKey = "primary_full" | "stacked" | "icon_only" | "wordmark_only" | "monogram";
type LogoMode = "light" | "dark";

type LogoSvgAsset = {
  svg: string;
  base64: string;
  width: number;
  height: number;
};

const BLUE = "#2D7BFF";
const NAVY = "#0F1B3D";
const WHITE = "#FFFFFF";

// Embedded Archivo Black so the wordmark renders identically everywhere
// (browser, canvas rasterizer, OS preview, Facebook) — no system-font fallbacks,
// no "blurry edges" from a substituted typeface.
const EMBEDDED_FONT_FACE = `
@font-face {
  font-family: 'AWA Display';
  font-style: normal;
  font-weight: 900;
  font-display: block;
  src: url(data:font/ttf;base64,${archivoBlackB64.trim()}) format('truetype');
}
`;

function encodeSvg(svg: string) {
  return Buffer.from(svg, "utf8").toString("base64");
}

function palette(mode: LogoMode) {
  return {
    primary: mode === "dark" ? WHITE : NAVY,
    accent: mode === "dark" ? "#7FB1FF" : BLUE,
    soft: mode === "dark" ? WHITE : "#174C9F",
  };
}

function svgShell(width: number, height: number, body: string, mode: LogoMode) {
  const p = palette(mode);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Auto World Approvals logo" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
  <defs>
    <linearGradient id="awaMark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.primary}"/>
      <stop offset="1" stop-color="${p.accent}"/>
    </linearGradient>
    <style>${EMBEDDED_FONT_FACE}
      .awa-word { font-family: 'AWA Display', 'Arial Black', Arial, sans-serif; font-weight: 900; letter-spacing: 14px; }
      .awa-small { font-family: 'AWA Display', 'Arial Black', Arial, sans-serif; font-weight: 900; letter-spacing: 10px; }
    </style>
  </defs>
  ${body}
</svg>`;
}

function mark(size: number, mode: LogoMode) {
  const stroke = Math.round(size * 0.055);
  const p = palette(mode);
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.405}" stroke="url(#awaMark)" stroke-width="${stroke}"/>
    <path d="M ${size * 0.5} ${size * 0.1} C ${size * 0.38} ${size * 0.28}, ${size * 0.36} ${size * 0.72}, ${size * 0.5} ${size * 0.9}" stroke="url(#awaMark)" stroke-width="${stroke * 0.8}"/>
    <path d="M ${size * 0.5} ${size * 0.1} C ${size * 0.64} ${size * 0.28}, ${size * 0.66} ${size * 0.72}, ${size * 0.5} ${size * 0.9}" stroke="url(#awaMark)" stroke-width="${stroke * 0.8}"/>
    <path d="M ${size * 0.16} ${size * 0.35} C ${size * 0.36} ${size * 0.43}, ${size * 0.64} ${size * 0.43}, ${size * 0.84} ${size * 0.35}" stroke="url(#awaMark)" stroke-width="${stroke * 0.8}"/>
    <path d="M ${size * 0.16} ${size * 0.65} C ${size * 0.36} ${size * 0.57}, ${size * 0.64} ${size * 0.57}, ${size * 0.84} ${size * 0.65}" stroke="url(#awaMark)" stroke-width="${stroke * 0.8}"/>
    <path d="M ${size * 0.18} ${size * 0.72} L ${size * 0.52} ${size * 0.52} L ${size * 0.58} ${size * 0.62} L ${size * 0.84} ${size * 0.37}" stroke="${p.accent}" stroke-width="${stroke * 1.15}"/>
    <path d="M ${size * 0.71} ${size * 0.36} L ${size * 0.86} ${size * 0.37} L ${size * 0.85} ${size * 0.52}" stroke="${p.accent}" stroke-width="${stroke * 1.15}"/>
    <path d="M ${size * 0.62} ${size * 0.35} L ${size * 0.74} ${size * 0.25} L ${size * 0.77} ${size * 0.39} L ${size * 0.91} ${size * 0.43} L ${size * 0.79} ${size * 0.51} L ${size * 0.81} ${size * 0.66} L ${size * 0.68} ${size * 0.58}" stroke="${p.primary}" stroke-width="${stroke * 0.75}"/>
  </g>`;
}

function wordmark(x: number, y: number, size: number, mode: LogoMode, centered = false) {
  const p = palette(mode);
  const anchor = centered ? "middle" : "start";
  return `<g fill="${p.primary}" text-anchor="${anchor}" class="awa-word">
    <text x="${x}" y="${y}" font-size="${size}">AUTO WORLD</text>
    <text x="${x}" y="${y + size * 1.18}" font-size="${size}">APPROVALS</text>
  </g>`;
}

function monogram(mode: LogoMode) {
  const p = palette(mode);
  const body = `<g transform="translate(92 92)">${mark(840, mode)}</g>
  <text x="512" y="580" text-anchor="middle" class="awa-word" font-size="210" fill="${p.primary}" letter-spacing="8">AWA</text>`;
  return svgShell(1024, 1024, body, mode);
}

export function buildLogoSvg(variant: LogoVariantKey, mode: LogoMode): LogoSvgAsset {
  let width = 2400;
  let height = 760;
  let body = "";

  if (variant === "icon_only") {
    width = 1024; height = 1024;
    body = `<g transform="translate(92 92)">${mark(840, mode)}</g>`;
  } else if (variant === "wordmark_only") {
    width = 2200; height = 620;
    body = wordmark(130, 245, 170, mode);
  } else if (variant === "stacked") {
    width = 1400; height = 1600;
    body = `<g transform="translate(340 100)">${mark(720, mode)}</g>${wordmark(700, 1035, 150, mode, true)}`;
  } else if (variant === "monogram") {
    const svg = monogram(mode);
    return { svg, base64: encodeSvg(svg), width: 1024, height: 1024 };
  } else {
    body = `<g transform="translate(90 75)">${mark(610, mode)}</g>${wordmark(820, 300, 175, mode)}`;
  }

  const svg = svgShell(width, height, body, mode);
  return { svg, base64: encodeSvg(svg), width, height };
}

export function buildLogoSvgPair(variant: string | null | undefined) {
  const safeVariant: LogoVariantKey = ["primary_full", "stacked", "icon_only", "wordmark_only", "monogram"].includes(String(variant))
    ? (variant as LogoVariantKey)
    : "primary_full";
  return {
    light: buildLogoSvg(safeVariant, "light"),
    dark: buildLogoSvg(safeVariant, "dark"),
  };
}