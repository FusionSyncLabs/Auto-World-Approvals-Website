export const STORAGE_KEY = "awa-cookie-consent-v1";
export const POLICY_VERSION = 2;

export type Prefs = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  ts: number;
  version: number;
  recordId?: string;
};

export function readPrefs(): Prefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Prefs;
    if (p.version !== POLICY_VERSION) return null;
    return p;
  } catch {
    return null;
  }
}

/** True only when the visitor accepted marketing/advertising cookies and has a valid recordId, without GPC. */
export function hasAdConsent(): boolean {
  if (typeof navigator === "undefined") return false;
  const p = readPrefs();
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
  return Boolean(p?.marketing && p?.recordId) && !gpc;
}

export function advertisingRecordId(): string | undefined {
  return hasAdConsent() ? readPrefs()?.recordId : undefined;
}
