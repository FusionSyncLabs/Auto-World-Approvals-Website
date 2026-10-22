import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import {
  Star,
  MapPin,
  Car,
  ChevronLeft,
  ChevronRight,
  Quote,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CarouselDots } from "./CarouselDots";
import { SwipeSurface } from "./SwipeSurface";

export type HappyClient = {
  id: string;
  client_name: string;
  location: string | null;
  vehicle: string | null;
  quote: string;
  photo_url: string;
  accent_color: string | null;
  display_order: number;
  is_active: boolean;
};

const DEFAULT_CLIENTS: HappyClient[] = [
  {
    id: "cc7b5b91-11dc-4106-b92b-973dd8000b07",
    client_name: "Jodie K.",
    location: "Abbotsford, BC",
    vehicle: "2024 White Hyundai Santa Fe",
    quote: "So excited to finally drive home in my new Santa Fe! This SUV is exactly what I needed.",
    photo_url: "/api/public/brand-asset/fa364749-3631-4906-8997-48c588b2d862.png",
    accent_color: null,
    display_order: 10,
    is_active: true,
  },
  {
    id: "064a87dc-a66d-4b83-9651-5d015cc70706",
    client_name: "Amanda P.",
    location: "Maple Ridge, BC",
    vehicle: "2024 Meteorite Gray Honda Civic",
    quote: "So excited about my new Civic! It's exactly what I needed and drives like a dream.",
    photo_url: "/api/public/brand-asset/67d2e5a4-e4b2-4b62-b2dc-f8a4e0969d6f.png",
    accent_color: null,
    display_order: 20,
    is_active: true,
  },
  {
    id: "a834d8a6-4041-4998-928b-b45abc507dfa",
    client_name: "Linda R.",
    location: "Chilliwack, BC",
    vehicle: "2023 White Chrysler Pacifica",
    quote: "So happy with our new Pacifica! It's exactly what we needed and rides like a dream.",
    photo_url: "/api/public/brand-asset/1b6fac86-aebd-494b-aa74-ebbc8d2fc159.jpg",
    accent_color: null,
    display_order: 30,
    is_active: true,
  },
  {
    id: "25189d2b-667c-47de-be8d-5441b0d6aef2",
    client_name: "Mike S.",
    location: "Maple Ridge, BC",
    vehicle: "2021 Blue Mazda CX-5",
    quote: "This new CX-5 is perfect for all my adventures. Smooth ride and looks great in blue too!",
    photo_url: "/api/public/brand-asset/413647a1-c5de-4dc3-9673-01b5e592c3b4.png",
    accent_color: null,
    display_order: 40,
    is_active: true,
  },
  {
    id: "66a8db7a-cffb-4822-917b-63dbe9cb0b81",
    client_name: "Gary F.",
    location: "Abbotsford, BC",
    vehicle: "2023 Gray Tesla Model 3",
    quote: "Love my new Tesla! The wait was worth it for this sweet ride, can't wait to charge it up.",
    photo_url: "/api/public/brand-asset/f15b8a18-6b8a-43fa-a8c4-108ea5b803a8.png",
    accent_color: null,
    display_order: 50,
    is_active: true,
  },
  {
    id: "af113543-5e9b-45fc-9844-a7ed8942609e",
    client_name: "Brenda K.",
    location: "Chilliwack, BC",
    vehicle: "2023 Black Mitsubishi Outlander",
    quote: "So excited to drive home in my new Outlander! It's exactly what I needed and I love it.",
    photo_url: "/api/public/brand-asset/8d25b17d-57b1-442d-83f4-e9ea1d939f39.jpg",
    accent_color: null,
    display_order: 60,
    is_active: true,
  },
];

export function HappyClientsShowcase() {
  const reduce = useReducedMotion();
  const { data: clientsFromDb } = useQuery({
    queryKey: ["happy-clients", "public"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("happy_clients")
          .select("id, client_name, location, vehicle, quote, photo_url, accent_color, display_order, is_active")
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        if (error || !data || data.length === 0) return DEFAULT_CLIENTS;
        return data as HappyClient[];
      } catch {
        return DEFAULT_CLIENTS;
      }
    },
    staleTime: 5 * 60_000,
  });

  const clients = (clientsFromDb && clientsFromDb.length > 0) ? clientsFromDb : DEFAULT_CLIENTS;

  const [activeIndex, setActiveIndex] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(3);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [dragging, setDragging] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  // Track items per view to calculate true number of scroll steps
  useEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return;
      if (window.innerWidth < 640) {
        setItemsPerPage(1);
      } else if (window.innerWidth < 1024) {
        setItemsPerPage(2);
      } else {
        setItemsPerPage(3);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const totalDots = Math.max(1, clients.length - itemsPerPage + 1);

  // Reveal once the section scrolls into view
  useEffect(() => {
    if (!sectionRef.current) return;
    const el = sectionRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Update active dot index on scroll
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const firstChild = el.firstElementChild as HTMLElement | null;
    const cardWidth = firstChild ? firstChild.offsetWidth + 24 : 360;
    const index = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(Math.max(index, 0), totalDots - 1));
  }, [totalDots]);

  // Scroll to specific index
  const scrollToCard = useCallback((index: number) => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const firstChild = el.firstElementChild as HTMLElement | null;
    const cardWidth = firstChild ? firstChild.offsetWidth + 24 : 360;
    el.scrollTo({ left: index * cardWidth, behavior: "smooth" });
    setActiveIndex(index);
  }, []);

  const scrollPrev = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const firstChild = el.firstElementChild as HTMLElement | null;
    const cardWidth = firstChild ? firstChild.offsetWidth + 24 : 360;
    if (el.scrollLeft <= 10) {
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    } else {
      el.scrollBy({ left: -cardWidth, behavior: "smooth" });
    }
  }, []);

  const scrollNext = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const firstChild = el.firstElementChild as HTMLElement | null;
    const cardWidth = firstChild ? firstChild.offsetWidth + 24 : 360;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (el.scrollLeft >= maxScroll - 10) {
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      el.scrollBy({ left: cardWidth, behavior: "smooth" });
    }
  }, []);

  // Auto-play horizontal scroll
  useEffect(() => {
    if (!inView || reduce || isHovered || hasFocus || dragging) return;
    const timer = setInterval(() => {
      scrollNext();
    }, 5500);
    return () => clearInterval(timer);
  }, [inView, reduce, isHovered, hasFocus, dragging, scrollNext]);

  const reveal = reduce || inView;

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[var(--navy)] pt-6 pb-16 text-white md:pt-10 md:pb-24"
    >
      {/* Ambient background glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.55 0.22 245), transparent 70%)" }}
        />
        <div
          className="absolute -right-32 bottom-10 h-[450px] w-[450px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.70 0.18 240), transparent 70%)" }}
        />
        <div className="absolute inset-0 bg-grid opacity-[0.06]" />
      </div>

      <div className="container relative mx-auto px-4 lg:px-8">
        {/* Section Header with Carousel Controls */}
        <div
          className={`mx-auto max-w-3xl text-center transition-all duration-700 ease-out ${
            reveal ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
            Real Drivers. Real Experiences.
          </h2>
          <p className="mobile-body mt-3 text-base text-white/75 md:text-lg">
            Hear from drivers who have shared their experiences with Auto World Approvals.
          </p>
        </div>

        {/* Carousel Container */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocusCapture={() => setHasFocus(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHasFocus(false);
          }}
          className="relative mt-10"
        >
          {/* Side arrow buttons (positioned comfortably away from cards) */}
          <div className="pointer-events-none absolute inset-y-0 -left-6 sm:-left-8 lg:-left-12 xl:-left-14 -right-6 sm:-right-8 lg:-right-12 xl:-right-14 z-10 hidden items-center justify-between md:flex">
            <button
              type="button"
              onClick={scrollPrev}
              aria-label="Previous story"
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[var(--navy)]/95 text-white shadow-elevated backdrop-blur-md transition-all hover:scale-105 hover:border-[var(--electric)] hover:bg-[var(--electric)]/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              aria-label="Next story"
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[var(--navy)]/95 text-white shadow-elevated backdrop-blur-md transition-all hover:scale-105 hover:border-[var(--electric)] hover:bg-[var(--electric)]/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Smooth Horizontal Scroll Track */}
          <SwipeSurface
            enabled={totalDots > 1}
            onNext={scrollNext}
            onPrevious={scrollPrev}
            onDraggingChange={setDragging}
          >
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex gap-6 overflow-x-auto scroll-smooth py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
            >
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="w-full flex-none snap-start sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
                >
                  <ClientCard client={client} />
                </div>
              ))}
            </div>
          </SwipeSurface>

          {/* Bottom Indicators & Mobile Controls */}
          <div className="mx-auto mt-6 grid max-w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 md:mt-8 md:flex md:justify-center">
            <button
              type="button"
              onClick={scrollPrev}
              aria-label="Previous story"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white/80 transition-all hover:border-[var(--electric)] hover:bg-[var(--electric)]/20 hover:text-white md:hidden active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Pagination Dots (Only valid scroll positions) */}
            <CarouselDots
              total={totalDots}
              current={activeIndex}
              onSelect={scrollToCard}
              label="slide"
              dark
            />

            <button
              type="button"
              onClick={scrollNext}
              aria-label="Next story"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white/80 transition-all hover:border-[var(--electric)] hover:bg-[var(--electric)]/20 hover:text-white md:hidden active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Bottom Verification Note */}
        <p className="mt-6 text-center text-xs text-white/50">
          Stories from real drivers pre-qualified through our Western Canada network. Names abbreviated for privacy.
        </p>
      </div>
    </section>
  );
}

function ClientCard({ client }: { client: HappyClient }) {
  return (
    <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[var(--electric)]/50 hover:bg-white/[0.07] hover:shadow-[0_20px_40px_-15px_oklch(0.55_0.22_245/0.4)]">
      <div>
        {/* Photo Header (Clean, Authentic, No AI badges) */}
        <div className="relative aspect-[16/11] w-full overflow-hidden rounded-xl bg-black/40">
          <img
            src={client.photo_url}
            alt={`${client.client_name} - Customer story`}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/why-us.jpg";
            }}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {/* Vehicle Badge (Bottom Left) */}
          {client.vehicle && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 text-center sm:text-left">
              <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-white/15 bg-black/60 px-2.5 py-1 text-xs font-medium text-white/95 backdrop-blur-md">
                <Car className="h-3.5 w-3.5 flex-shrink-0 text-[var(--electric)]" />
                <span className="truncate">{client.vehicle}</span>
              </span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="mt-4">
          {/* Star Rating */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-between">
            <div className="flex items-center gap-0.5 text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-[11px] font-semibold text-white/60">
              5.0 ★
            </span>
          </div>

          {/* Quote */}
          <div className="relative mt-3">
            <Quote className="absolute -left-1 -top-1 h-5 w-5 text-white/10" />
            <p className="relative px-3 text-justify text-sm font-medium leading-relaxed text-white/90 sm:pl-3 sm:pr-0 sm:text-left">
              "{client.quote}"
            </p>
          </div>
        </div>
      </div>

      {/* Customer Footer */}
      <div className="mt-5 border-t border-white/10 pt-3.5 text-center sm:text-left">
        <p className="text-sm font-bold tracking-wide text-white">{client.client_name}</p>
        {client.location && (
          <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-white/60 sm:justify-start">
            <MapPin className="h-3 w-3 text-[var(--electric)]" />
            {client.location}
          </p>
        )}
      </div>
    </div>
  );
}
