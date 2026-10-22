import { useEffect, useState } from "react";
import { Link } from "@/components/ui/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, Gift, Zap, ArrowRight, Star, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const BONUS_POPUP_ENABLED = false;
const STORAGE_KEY = "awa_vip_offer_shown_count_v1";
const STARTED_KEY = "awa.application_started_v1";
const MAX_SHOWS = 2;
const DELAY_MS = 15_000;


function KeyReveal() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto flex h-32 w-full items-center justify-center md:h-40">
      {/* Radiating light rays */}
      {!reduce && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
          animate={{ opacity: 1, scale: 1, rotate: 360 }}
          transition={{ opacity: { duration: 0.6 }, scale: { duration: 0.6 }, rotate: { duration: 20, repeat: Infinity, ease: "linear" } }}
          className="absolute h-56 w-56 md:h-64 md:w-64"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.55) 12deg, transparent 24deg, transparent 60deg, rgba(253,224,71,0.4) 72deg, transparent 84deg, transparent 120deg, rgba(251,191,36,0.55) 132deg, transparent 144deg, transparent 180deg, rgba(253,224,71,0.4) 192deg, transparent 204deg, transparent 240deg, rgba(251,191,36,0.55) 252deg, transparent 264deg, transparent 300deg, rgba(253,224,71,0.4) 312deg, transparent 324deg)",
            filter: "blur(6px)",
            maskImage: "radial-gradient(circle, black 30%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle, black 30%, transparent 70%)",
          }}
        />
      )}

      {/* Expanding glow ring */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0.6, scale: 0.3 }}
        animate={reduce ? { opacity: 0.3, scale: 1 } : { opacity: [0.6, 0, 0.6], scale: [0.3, 1.6, 0.3] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
        className="absolute h-40 w-40 rounded-full border-2 border-amber-300/60"
      />

      {/* Soft glow behind key */}
      <div
        aria-hidden
        className="absolute h-28 w-28 rounded-full bg-amber-400/40 blur-3xl md:h-32 md:w-32"
      />

      {/* The key */}
      <motion.div
        initial={{ scale: 0, rotate: -180, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 12, stiffness: 180, delay: 0.3 }}
        className="relative"
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 shadow-[0_0_40px_rgba(251,191,36,0.7)] md:h-28 md:w-28"
        >
          <div className="absolute inset-1 rounded-full bg-gradient-to-br from-amber-200/60 to-transparent" />
          <KeyRound className="relative h-12 w-12 text-slate-950 md:h-14 md:w-14" strokeWidth={2.5} />
        </motion.div>
      </motion.div>

      {/* Sparkles */}
      {!reduce &&
        Array.from({ length: 6 }).map((_, i) => (
          <motion.span
            key={i}
            aria-hidden
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              x: Math.cos((i / 6) * Math.PI * 2) * 80,
              y: Math.sin((i / 6) * Math.PI * 2) * 80,
            }}
            transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 + i * 0.15, ease: "easeOut" }}
            className="absolute text-xl"
          >
            ✨
          </motion.span>
        ))}
    </div>
  );
}



export function VipOfferPopup() {
  if (!BONUS_POPUP_ENABLED) return null;
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const count = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
    if (count >= MAX_SHOWS) return;
    // If the user has already started the application process, don't show the VIP offer popup.
    if (localStorage.getItem(STARTED_KEY)) return;
    const t = setTimeout(() => {
      // Only count as "shown" once the popup actually opens.
      try {
        localStorage.setItem(STORAGE_KEY, String(count + 1));
      } catch {}
      setOpen(true);
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, []);


  const close = () => {
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Pre-qualification offer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.button
            aria-label="Close"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Confetti sparkles */}
          {!reduce && (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 24 }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={{
                    y: "-10vh",
                    x: `${Math.random() * 100}vw`,
                    opacity: 0,
                    rotate: 0,
                  }}
                  animate={{
                    y: "110vh",
                    opacity: [0, 1, 1, 0],
                    rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
                  }}
                  transition={{
                    duration: 3 + Math.random() * 2,
                    delay: Math.random() * 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute text-2xl"
                >
                  {["✨", "💫", "⭐", "🎉", "🎊"][i % 5]}
                </motion.span>
              ))}
            </div>
          )}

          {/* Card */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 18, stiffness: 220 }}
            className="relative mx-auto w-full max-w-lg"
          >
            {/* Glow */}
            <div
              aria-hidden
              className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 opacity-80 blur-xl"
            />
            <motion.div
              aria-hidden
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-2 rounded-[2rem] bg-[conic-gradient(from_0deg,#fbbf24,#f59e0b,#fde68a,#f59e0b,#fbbf24)] opacity-40 blur-md"
            />

            <div className="relative overflow-hidden rounded-[2rem] border-2 border-amber-300/60 bg-gradient-to-br from-slate-900 via-slate-950 to-[oklch(0.14_0.06_260)] p-6 text-white shadow-2xl md:p-8">

              {/* Header badge */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mx-auto flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-4 py-1.5 text-[17px] font-bold uppercase tracking-[0.22em] text-amber-200"
              >
                <Star className="h-3.5 w-3.5" />
                Free to apply
              </motion.div>

              {/* Key unlock reveal */}
              <div className="mt-4">
                <KeyReveal />
              </div>


              {/* HEADLINE */}
              <motion.h2
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.6, type: "spring", damping: 10 }}
                className="mt-6 text-center font-display text-4xl font-black tracking-tight md:text-5xl"
              >
                <motion.span
                  animate={
                    reduce
                      ? undefined
                      : { textShadow: [
                          "0 0 20px rgba(251,191,36,0.5)",
                          "0 0 40px rgba(251,191,36,1)",
                          "0 0 20px rgba(251,191,36,0.5)",
                        ] }
                  }
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent"
                >
                  VIP ACCESS
                </motion.span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.9 }}
                className="mt-2 text-center font-display text-2xl font-bold text-white md:text-3xl"
              >
                <span className="text-amber-300">Fast-Track</span> Pre-Qualification + Trade-In Review
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.1 }}
                className="mt-3 text-center text-sm text-white/70"
              >
                Priority follow-up from our advisors — apply now to lock it in.
              </motion.p>

              {/* Perks */}
              <motion.ul
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.3 }}
                className="mt-5 grid grid-cols-3 gap-2 text-center text-[17px] font-semibold uppercase tracking-wider text-white/80"
              >
                <li className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                  <Zap className="mx-auto mb-1 h-4 w-4 text-amber-300" />
                  2-min apply
                </li>
                <li className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                  <Sparkles className="mx-auto mb-1 h-4 w-4 text-amber-300" />
                  No obligation
                </li>
                <li className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                  <Gift className="mx-auto mb-1 h-4 w-4 text-amber-300" />
                  Free trade-in
                </li>
              </motion.ul>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.4 }}
                className="mt-6"
              >
                <motion.div
                  animate={
                    reduce
                      ? undefined
                      : { scale: [1, 1.03, 1], boxShadow: [
                          "0 0 0 0 rgba(251,191,36,0.7)",
                          "0 0 0 16px rgba(251,191,36,0)",
                          "0 0 0 0 rgba(251,191,36,0)",
                        ] }
                  }
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="rounded-xl"
                >
                  <Button
                    asChild
                    size="xl"
                    className="w-full rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-base font-black uppercase tracking-wide text-slate-950 hover:from-amber-300 hover:to-amber-400"
                  >
                    <Link to="/apply" onClick={close}>
                      Check Financing Options <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                </motion.div>
              </motion.div>

              {/* Close-with-regret line */}
              <button
                onClick={close}
                className="mt-4 block w-full text-center text-[17px] italic text-white/50 underline-offset-4 transition hover:text-white/80 hover:underline"
              >
                No thanks
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
