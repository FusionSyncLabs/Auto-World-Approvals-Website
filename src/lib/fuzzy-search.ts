/** Lightweight fuzzy / partial matching helpers for list search boxes. */

export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bounded Levenshtein distance; returns max+1 when it exceeds max. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function tolerance(len: number) {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  return 2;
}

/** Does a single search token match a single haystack word (prefix / substring / typo)? */
function tokenMatchesWord(token: string, word: string): boolean {
  if (word.includes(token)) return true;
  const tol = tolerance(token.length);
  if (!tol) return false;
  if (editDistance(word, token, tol) <= tol) return true;
  // typo inside a longer word: compare against same-length window prefixes
  if (word.length > token.length) {
    const slice = word.slice(0, token.length + tol);
    if (editDistance(slice, token, tol) <= tol) return true;
  }
  return false;
}

/**
 * Returns true when every whitespace-separated token in `query` matches the
 * haystack somewhere — exactly, as a partial, or as a close (typo) match.
 */
export function fuzzyMatch(haystack: string, query: string): boolean {
  const hay = normalizeText(haystack);
  const q = normalizeText(query);
  if (!q) return true;
  if (!hay) return false;
  if (hay.includes(q)) return true;
  const words = hay.split(" ").filter(Boolean);
  return q.split(" ").filter(Boolean).every((token) => {
    if (hay.includes(token)) return true;
    return words.some((w) => tokenMatchesWord(token, w));
  });
}

/** Build a searchable blob from arbitrary values. */
export function searchBlob(values: unknown[]): string {
  return values
    .filter((v) => typeof v === "string" || typeof v === "number")
    .join(" ");
}
