/** Only the live website may send ad/analytics conversions or real leads. */
export const PRODUCTION_HOSTS = ["autoworldapprovals.com", "www.autoworldapprovals.com"];

export function isProductionHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase().split(":")[0];
  return PRODUCTION_HOSTS.includes(h);
}

/** Extracts the host from an Origin/Referer URL or a bare Host header. */
export function hostFromHeader(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    return new URL(v).hostname;
  } catch {
    return v;
  }
}
