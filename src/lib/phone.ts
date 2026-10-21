/** Canadian phone helpers — the funnel only accepts BC / Alberta numbers. */

export const BC_AREA_CODES = ["236", "250", "257", "604", "672", "778"] as const;
export const AB_AREA_CODES = ["368", "403", "587", "780", "825"] as const;

export const BC_AB_AREA_CODES: readonly string[] = [...BC_AREA_CODES, ...AB_AREA_CODES];

/** Strip to 10 digits, dropping a leading country code 1. */
export function normalizePhone(v: string): string {
  let d = (v || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
}

/** A structurally valid North American 10-digit number. */
export function isValidNanpNumber(v: string): boolean {
  const d = normalizePhone(v);
  if (d.length !== 10) return false;
  // NANP: area code and exchange must start 2-9; N11 area codes are invalid.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return false;
  if (/^(\d)\1{9}$/.test(d)) return false; // 1111111111 etc.
  if (d.slice(1, 3) === "11") return false;
  return true;
}

export function areaCode(v: string): string {
  return normalizePhone(v).slice(0, 3);
}

export function isBcOrAbPhone(v: string): boolean {
  return isValidNanpNumber(v) && BC_AB_AREA_CODES.includes(areaCode(v));
}

/** Quebec + Atlantic Canada area codes — we can't serve these regions. */
export const EASTERN_AREA_CODES: readonly string[] = [
  // Quebec
  "263", "354", "367", "418", "438", "450", "468", "514", "579", "581", "819", "873",
  // New Brunswick, Nova Scotia, PEI
  "428", "506", "782", "902",
  // Newfoundland & Labrador
  "709", "879",
];

export const EASTERN_REGION_MESSAGE =
  "Sorry — we only serve Western Canada right now and can't accept applications from Quebec or Atlantic Canada.";

export function isEasternPhone(v: string): boolean {
  return EASTERN_AREA_CODES.includes(areaCode(v));
}

/** Provinces we refuse applications from. */
export const BLOCKED_PROVINCES: readonly string[] = ["QC", "NB", "NS", "PE", "NL"];

/** Postal code first letters for the blocked provinces. */
const BLOCKED_POSTAL_PREFIXES = ["A", "B", "C", "E", "G", "H", "J"];

export function isBlockedRegion(province?: string | null, postal?: string | null): boolean {
  if (province && BLOCKED_PROVINCES.includes(province.trim().toUpperCase())) return true;
  const c = (postal || "").trim().toUpperCase().charAt(0);
  return Boolean(c) && BLOCKED_POSTAL_PREFIXES.includes(c);
}

/**
 * User-facing reason the number was rejected, or null when it's fine.
 * Valid Canadian numbers are accepted except Quebec / Atlantic area codes.
 */
export function phoneError(v: string): string | null {
  const d = normalizePhone(v);
  if (!d) return "A mobile number is required so we can confirm your approval.";
  if (d.length !== 10) return "Enter a 10-digit phone number.";
  if (!isValidNanpNumber(v)) return "That doesn't look like a real phone number.";
  if (isEasternPhone(v)) return EASTERN_REGION_MESSAGE;
  return null;
}
