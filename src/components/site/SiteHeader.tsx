"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/components/ui/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/#how-it-works", label: "How It Works", scrollTo: "how-it-works" },
  { to: "/contact", label: "Contact" },
];

function scrollToHowItWorks(e?: MouseEvent) {
  if (e) e.preventDefault();
  const el = document.getElementById("how-it-works");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.pushState(null, "", "/#how-it-works");
  }
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 max-h-dvh overflow-y-auto overscroll-contain border-b transition-all duration-300 ${
        scrolled
          ? "border-border/80 bg-background/90 shadow-card backdrop-blur-xl"
          : "border-transparent bg-background/60 backdrop-blur-md"
      }`}
    >
      <div
        className="container mx-auto grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:min-h-20 sm:gap-3 sm:px-4 sm:py-3 md:flex md:min-h-24 md:justify-between lg:px-8"
      >
        <Logo />
        <nav aria-label="Main navigation" className="hidden min-w-0 items-center gap-5 lg:flex xl:gap-9">
          {NAV.map((n) => (
            <span key={n.to}>
              {isHome && n.scrollTo ? (
                <a
                  href={`#${n.scrollTo}`}
                  onClick={scrollToHowItWorks}
                  className="group relative inline-flex min-h-11 items-center rounded-sm text-center text-[17px] font-semibold uppercase leading-snug tracking-[0.16em] text-foreground/65 transition-colors hover:text-[var(--electric)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>{n.label}</span>
                  <span
                    aria-hidden
                    className="absolute -bottom-2 left-0 h-[2px] w-full origin-left scale-x-0 bg-electric-gradient transition-transform duration-300 group-hover:scale-x-100"
                  />
                </a>
              ) : (
                <Link
                  href={n.to}
                  className={`group relative inline-flex min-h-11 items-center rounded-sm text-center text-[17px] font-semibold uppercase leading-snug tracking-[0.16em] transition-colors hover:text-[var(--electric)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    pathname === n.to ? "text-[var(--electric)]" : "text-foreground/65"
                  }`}
                >
                  <span>{n.label}</span>
                  <span
                    aria-hidden
                    className="absolute -bottom-2 left-0 h-[2px] w-full origin-left scale-x-0 bg-electric-gradient transition-transform duration-300 group-hover:scale-x-100"
                  />
                </Link>
              )}
            </span>
          ))}
        </nav>
        <div className="hidden min-w-0 items-center gap-3 md:flex">
          <Button asChild variant="hero" size="default" className="rounded-full px-6">
            <Link to="/apply">Check Financing Options</Link>
          </Button>
        </div>
        <Button
          ref={menuButtonRef}
          variant="ghost"
          size="icon"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>
      {open && (
        <nav id="mobile-navigation" aria-label="Main navigation" className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain animate-fade-in border-t border-border bg-background sm:max-h-[calc(100dvh-5rem)] md:max-h-[calc(100dvh-6rem)] lg:hidden">
          <div className="container mx-auto flex flex-col gap-1 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center">
            {NAV.map((n) => (
              <span key={n.to}>
                {isHome && n.scrollTo ? (
                  <a
                    href={`#${n.scrollTo}`}
                    onClick={(e) => {
                      scrollToHowItWorks(e);
                      setOpen(false);
                    }}
                    className="flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {n.label}
                  </a>
                ) : (
                  <Link
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {n.label}
                  </Link>
                )}
              </span>
            ))}
            <Button asChild variant="hero" size="lg" className="mt-2 w-full">
              <Link to="/apply" onClick={() => setOpen(false)}>Check Financing Options</Link>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
