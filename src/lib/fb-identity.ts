/**
 * Stable visitor identity for Meta Pixel / Conversions API matching.
 *
 * - `external_id` is a random per-browser ID kept in a first-party cookie so
 *   both the browser pixel and the server (CAPI) send the exact same value.
 * - Known email / phone are cached so PageView events can carry hashed
 *   contact info once the visitor has identified themselves in the funnel.
 */

const XID_COOKIE = "aw_xid";
const IDENTITY_KEY = "aw_ident";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Returns (and creates if needed) the stable external_id for this browser. */
export function getExternalId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    let id = readCookie(XID_COOKIE);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      document.cookie = `${XID_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
    }
    return id;
  } catch {
    return undefined;
  }
}

export interface KnownIdentity {
  email?: string;
  phone?: string;
}

/** Cache the visitor's contact details for future event matching. */
export function saveIdentity(next: KnownIdentity): void {
  if (typeof window === "undefined") return;
  try {
    const current = readIdentity();
    const merged: KnownIdentity = {
      email: next.email?.trim() || current.email,
      phone: next.phone?.trim() || current.phone,
    };
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(merged));
  } catch {
    /* storage unavailable */
  }
}

export function readIdentity(): KnownIdentity {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as KnownIdentity) : {};
  } catch {
    return {};
  }
}
