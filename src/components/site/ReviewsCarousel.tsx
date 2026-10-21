import { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Star, ExternalLink, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CarouselDots } from "./CarouselDots";
import { SwipeSurface } from "./SwipeSurface";

export type Review = { name: string; city: string; body: string; url?: string };

export function ReviewsCarousel({ reviews }: { reviews: Review[] }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(3);
  const n = reviews.length;

  // Responsive items per view: 3 on desktop, 2 on tablet, 1 on mobile
  useEffect(() => {
    const updateItemsPerPage = () => {
      if (typeof window === "undefined") return;
      if (window.innerWidth < 640) {
        setItemsPerPage(1);
      } else if (window.innerWidth < 1024) {
        setItemsPerPage(2);
      } else {
        setItemsPerPage(3);
      }
    };

    updateItemsPerPage();
    window.addEventListener("resize", updateItemsPerPage);
    return () => window.removeEventListener("resize", updateItemsPerPage);
  }, []);

  const totalPages = Math.ceil(n / itemsPerPage);

  // Auto-advance reviews carousel
  useEffect(() => {
    if (hovered || focused || dragging || totalPages <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, 6500);
    return () => clearInterval(timer);
  }, [hovered, focused, dragging, totalPages]);

  if (!n) return null;

  // Active page reviews (guaranteed distinct per page)
  const currentReviews = useMemo(() => {
    const start = (currentPage % totalPages) * itemsPerPage;
    return reviews.slice(start, start + itemsPerPage);
  }, [reviews, currentPage, totalPages, itemsPerPage]);

  const handlePrev = () => {
    setDirection(-1);
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const handleNext = () => {
    setDirection(1);
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const handleDotClick = (index: number) => {
    setDirection(index > currentPage ? 1 : -1);
    setCurrentPage(index);
  };

  return (
    <div
      className="mx-auto mt-10 max-w-6xl px-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      aria-roledescription="carousel"
      aria-label="Customer Google reviews"
    >
      {/* Reviews Grid Animated by Page (no popLayout glitches) */}
      <SwipeSurface
        className="py-2"
        enabled={totalPages > 1}
        onNext={handleNext}
        onPrevious={handlePrev}
        onDraggingChange={setDragging}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`page-${currentPage}-${itemsPerPage}`}
            initial={{ opacity: 0, x: direction * 35 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 35 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={`grid gap-6 items-stretch ${
              itemsPerPage === 1
                ? "grid-cols-1"
                : itemsPerPage === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {currentReviews.map((r) => (
              <figure
                key={r.name}
                className="flex h-full min-w-0 flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-300 hover:border-[var(--electric)]/40 hover:shadow-md sm:p-6"
              >
                <div>
                  {/* Header: 5 Stars + Google Badge */}
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-between">
                    <div className="flex shrink-0 gap-1 text-[#FBBC05]" aria-label="5 out of 5 stars">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <GoogleIcon />
                      <span>Google review</span>
                    </span>
                  </div>

                  {/* Review Body */}
                  <blockquote className="mt-4 break-words text-justify text-sm leading-relaxed text-foreground/90 sm:text-left sm:text-[15px]">
                    "{r.body}"
                  </blockquote>
                </div>

                {/* Author Footer */}
                <figcaption className="mt-6 flex flex-col flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-between">
                  <div className="min-w-0 break-words text-center sm:text-left">
                    <p className="text-sm font-bold text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.city}</p>
                  </div>

                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm text-xs font-semibold text-[var(--electric)] transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <span>View on Google</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      Verified Driver
                    </span>
                  )}
                </figcaption>
              </figure>
            ))}
          </motion.div>
        </AnimatePresence>
      </SwipeSurface>

      {/* Navigation Controls */}
      {totalPages > 1 && (
        <div className="mx-auto mt-6 grid max-w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 sm:mt-8 sm:w-fit sm:grid-cols-[44px_auto_44px] sm:gap-4">
          <button
            type="button"
            aria-label="Previous reviews"
            onClick={handlePrev}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground/80 shadow-sm transition-all hover:border-[var(--electric)] hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Dot Indicators (Representing Actual Pages) */}
          <CarouselDots
            total={totalPages}
            current={currentPage % totalPages}
            onSelect={handleDotClick}
            label="page"
          />

          <button
            type="button"
            aria-label="Next reviews"
            onClick={handleNext}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground/80 shadow-sm transition-all hover:border-[var(--electric)] hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-4 w-4">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
