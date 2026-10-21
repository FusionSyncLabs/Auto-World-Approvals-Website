"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/components/ui/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/how-it-works", label: "How It Works", scrollTo: "how-it-works" },
  { to: "/contact", label: "Contact" },
];

function scrollToHowItWorks(e: MouseEvent) {
  e.preventDefault();
  const el = document.getElementById("how-it-works");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-all duration-300 ${
        scrolled
          ? "border-border/80 bg-background/90 shadow-card backdrop-blur-xl"
          : "border-transparent bg-background/60 backdrop-blur-md"
      }`}
    >
      <div
        className="container mx-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 h-20 md:h-24 md:flex md:justify-between lg:px-8"
      >
        <Logo />
        <nav className="hidden items-center gap-9 lg:flex">
          {NAV.map((n) => (
            <span key={n.to}>
              {isHome && n.scrollTo ? (
                <a
                  href={`#${n.scrollTo}`}
                  onClick={scrollToHowItWorks}
                  className="group relative text-[17px] font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:text-[var(--electric)]"
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
                  className={`group relative text-[17px] font-semibold uppercase tracking-[0.16em] transition-colors hover:text-[var(--electric)] ${
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
        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="hero" size="default" className="rounded-full px-6">
            <Link to="/apply">Check Financing Options</Link>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 lg:hidden"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>
      {open && (
        <div id="mobile-navigation" className="max-h-[calc(100dvh-6rem)] overflow-y-auto animate-fade-in border-t border-border bg-background lg:hidden">
          <div className="container mx-auto flex flex-col gap-1 px-4 py-3">
            {NAV.map((n) => (
              <span key={n.to}>
                {isHome && n.scrollTo ? (
                  <a
                    href={`#${n.scrollTo}`}
                    onClick={(e) => {
                      scrollToHowItWorks(e);
                      setOpen(false);
                    }}
                    className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    {n.label}
                  </a>
                ) : (
                  <Link
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    {n.label}
                  </Link>
                )}
              </span>
            ))}
            <Button asChild variant="hero" size="lg" className="mt-2">
              <Link to="/apply" onClick={() => setOpen(false)}>Check Financing Options</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
