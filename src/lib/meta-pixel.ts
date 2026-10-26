import { hasAdConsent } from "@/lib/consent";

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
export const META_ENABLED = META_PIXEL_ID !== "";

const HOSTS = (
  process.env.NEXT_PUBLIC_META_HOSTS ??
  "autoworldapprovals.com,www.autoworldapprovals.com,localhost"
)
  .split(",")
  .map((h) => h.trim().toLowerCase());

const SKIP_PATHS = ["/admin", "/crm"];
let started = false;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export function metaAllowed(): boolean {
  if (typeof window === "undefined" || !META_ENABLED) return false;
  const hostname = window.location.hostname.toLowerCase();
  if (!HOSTS.includes(hostname)) return false;
  return hasAdConsent();
}

function injectBaseCode(): void {
  if (typeof window === "undefined" || window.fbq) return;
  // Official Meta Pixel snippet, typed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n: any = function () {
    // eslint-disable-next-line prefer-rest-params
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
}

function getXid(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|; )aw_xid=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `xid_${Date.now()}`;
  const domain =
    typeof location !== "undefined" && location.hostname.endsWith("autoworldapprovals.com")
      ? "; Domain=.autoworldapprovals.com"
      : "";
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `aw_xid=${id}; Path=/; Max-Age=15552000; SameSite=Lax${secure}${domain}`;
  return id;
}

/** Call on app start, after consent is saved, and on any consent change. */
export function syncMetaPixel(): void {
  if (typeof window === "undefined") return;
  if (!metaAllowed()) {
    window.fbq?.("consent", "revoke");
    return;
  }
  if (started) {
    window.fbq?.("consent", "grant");
    return;
  }
  started = true;
  injectBaseCode();
  if (window.fbq) {
    window.fbq("set", "autoConfig", false, META_PIXEL_ID);
    window.fbq("init", META_PIXEL_ID, { external_id: getXid() });
    window.fbq("consent", "grant");
    if (!SKIP_PATHS.some((p) => window.location.pathname.startsWith(p))) {
      window.fbq("track", "PageView");
    }
  }
}

export function metaTrack(event: string, o: { custom?: boolean; eventId?: string } = {}): void {
  if (!started || !metaAllowed() || !window.fbq) return;
  const method = o.custom ? "trackCustom" : "track";
  if (o.eventId) {
    window.fbq(method, event, {}, { eventID: o.eventId });
  } else {
    window.fbq(method, event, {});
  }
}

/** Fires once per application session (keyed by the intake key). */
export function metaTrackOnce(event: string, intakeKey: string, custom = false): void {
  if (!started || !metaAllowed()) return;
  const key = `awa.meta.${event}.${intakeKey}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* storage blocked: fire anyway */
  }
  metaTrack(event, { custom });
}
