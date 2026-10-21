import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

const isIpv6 = (v: string) => v.includes(":");

/**
 * Meta prefers IPv6 addresses for event matching. Proxies often forward both,
 * so pick the first IPv6 candidate from x-forwarded-for and fall back to the
 * regular request IP.
 */
export function getBestClientIp(): string | null {
  try {
    const forwarded = getRequestHeader("x-forwarded-for") || "";
    const candidates = forwarded
      .split(",")
      .map((v) => v.trim().replace(/^\[|\]$/g, ""))
      .filter(Boolean);
    const v6 = candidates.find(isIpv6);
    if (v6) return v6;
    const direct = getRequestIP({ xForwardedFor: true }) || null;
    if (direct) return direct.replace(/^\[|\]$/g, "");
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}
