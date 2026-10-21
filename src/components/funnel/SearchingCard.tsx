import { useEffect, useState } from "react";
import { Search } from "lucide-react";

interface Props {
  provinceLabel: string;
  onDone: () => void;
  /** How long the search theatre runs before advancing. */
  durationMs?: number;
}

/**
 * Branded interstitial: an electric sweep runs across a navy card while we
 * "check" lender programs for the applicant's province.
 */
export function SearchingCard({ provinceLabel, onDone, durationMs = 2400 }: Props) {
  const [pct, setPct] = useState(4);

  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - started) / durationMs) * 100));
      setPct(Math.max(4, p));
    }, 60);
    const done = setTimeout(onDone, durationMs);
    return () => { clearInterval(tick); clearTimeout(done); };
  }, [durationMs, onDone]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[var(--navy)] p-8 text-center text-white shadow-3d animate-fade-in lg:p-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.22 245 / 0.55), transparent 70%)" }}
      />
      <div className="relative">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--electric)]/40 bg-white/5">
          <Search className="h-7 w-7 animate-pulse text-[var(--electric)]" />
        </div>
        <p className="mt-6 text-[17px] font-bold uppercase tracking-[0.22em] text-[var(--electric)]/80">
          Checking lender programs
        </p>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight lg:text-3xl">
          Searching vehicles in{" "}
          <span className="bg-gradient-to-r from-[oklch(0.78_0.18_240)] to-[oklch(0.60_0.22_250)] bg-clip-text text-transparent">
            {provinceLabel}
          </span>
        </h2>

        <div className="mx-auto mt-8 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[oklch(0.70_0.18_240)] to-[oklch(0.55_0.22_250)] transition-[width] duration-100 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-4 text-xs text-white/50">Matching your profile with our lender network…</p>
      </div>
    </div>
  );
}
