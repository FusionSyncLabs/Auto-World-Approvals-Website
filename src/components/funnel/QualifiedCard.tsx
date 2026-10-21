import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, PartyPopper, Sparkles } from "lucide-react";
import { Link } from "@/components/ui/link";
import { Button } from "@/components/ui/button";

interface Props {
  provinceLabel: string;
  onContinue: () => void;
  submitting?: boolean;
}

/** The celebration moment, before the final few personal details. */
export function QualifiedCard({ provinceLabel, onContinue, submitting }: Props) {
  useEffect(() => {
    try {
      navigator.vibrate?.([12, 60, 22, 40, 30]);
    } catch {
      /* unsupported */
    }
  }, []);




  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[var(--electric)]/30 bg-card p-5 text-center shadow-3d sm:rounded-[28px] sm:p-8 lg:p-10">
      <Rays />
      <Confetti />
      <StarBurst />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.62 0.20 252 / 0.45), transparent 70%)" }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0.3, 0.65, 0.4], scale: 1 }}
        transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
      />

      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[17px] font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300 sm:text-[17px] sm:tracking-[0.2em]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Pre-qualification step complete
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 18, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.62, type: "spring", stiffness: 160, damping: 14 }}
          className="mt-3 text-balance font-display text-[26px] font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl"
        >
          <ShimmerText>Congratulations</ShimmerText> — you're almost there!
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.78 }}
          className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground sm:mt-4 lg:text-base"
        >
          Partners in <span className="font-semibold text-foreground">{provinceLabel}</span> can review your file once it's complete. Just a few quick questions left — about 60 seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mx-auto mt-6 max-w-sm"
        >
          <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <BadgeCheck className="h-4 w-4 flex-shrink-0" />
            Free to apply · No obligation
          </div>
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Button
              type="button"
              variant="hero"
              size="lg"
              disabled={submitting}
              onClick={onContinue}
              className="h-14 w-full text-base"
            >
              <BadgeCheck className="h-4 w-4" />
              Continue my application
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-muted-foreground">
            <PartyPopper className="h-3.5 w-3.5 text-amber-500" /> No fee, no obligation — takes less than a minute
          </p>

          <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
            By continuing, you agree that Auto World Approvals and our partner dealers and lenders
            may contact you about your application. Our inquiry does not run a credit check; a lender will ask your permission before any credit check. Submitting an inquiry is not an approval.{" "}
            <Link to="/privacy" className="underline">Privacy Policy</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}


function ShimmerText({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block whitespace-nowrap bg-clip-text text-transparent"
      style={{
        backgroundImage:
          "linear-gradient(100deg, var(--electric) 0%, #fbbf24 45%, var(--electric) 90%)",
        backgroundSize: "220% 100%",
        backgroundRepeat: "repeat",
        animation: "awa-shimmer 3s linear infinite",
      }}
    >
      {children}
    </span>
  );
}

/** Rotating light rays behind the card content. */
function Rays() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/3 opacity-[0.16]"
      initial={{ rotate: 0, scale: 0.7, opacity: 0 }}
      animate={{ rotate: 360, scale: 1, opacity: 0.16 }}
      transition={{ rotate: { duration: 26, repeat: Infinity, ease: "linear" }, scale: { duration: 1.2 }, opacity: { duration: 1.2 } }}
      style={{
        background:
          "repeating-conic-gradient(from 0deg, var(--electric) 0deg 8deg, transparent 8deg 24deg)",
        maskImage: "radial-gradient(circle, black 0%, transparent 68%)",
        WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 68%)",
      }}
    />
  );
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Star-burst particles rising from the seal. */
function StarBurst() {
  const mounted = useMounted();
  const reduced = useRef(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 320,
        y: -(90 + Math.random() * 200),
        delay: 0.15 + Math.random() * 0.5,
        size: 10 + Math.random() * 10,
        spin: Math.random() > 0.5 ? 540 : -540,
      })),
    [],
  );

  if (!mounted || reduced.current) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s) => (
        <motion.span
          key={s.id}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{ x: s.x, y: [0, s.y, s.y + 260], opacity: [0, 1, 0], scale: 1, rotate: s.spin }}
          transition={{ delay: s.delay, duration: 2.4, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: "50%",
            top: "22%",
            fontSize: s.size,
            color: "#facc15",
            textShadow: "0 0 10px rgba(250,204,21,0.55)",
          }}
        >
          ⭐
        </motion.span>
      ))}
    </div>
  );
}

function Confetti() {
  const mounted = useMounted();

  const pieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        duration: 2.2 + Math.random() * 2,
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 90,
        color: ["var(--electric)", "var(--primary)", "var(--success)", "#facc15", "#f472b6", "#38bdf8"][i % 6],
        size: 5 + Math.random() * 8,
      })),
    [],
  );

  if (!mounted) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -40, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 700, x: p.drift, rotate: p.rotate + 900, opacity: [1, 1, 0] }}
          transition={{ delay: p.delay, duration: p.duration, ease: "easeIn" }}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: 0,
            width: p.size,
            height: p.size * 0.42,
            background: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
