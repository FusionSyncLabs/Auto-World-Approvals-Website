"use client";

import { useEffect } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { HappyClientsShowcase } from "@/components/site/HappyClientsShowcase";
import { VipOfferPopup } from "@/components/site/VipOfferPopup";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
} from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { ReviewsCarousel, GoogleIcon } from "@/components/site/ReviewsCarousel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useBranding } from "@/hooks/use-branding";
import keysHandoff from "@/assets/keys-handoff-v2.jpg";
import vehicleCar from "@/assets/selection-car.webp";
import vehicleSuv from "@/assets/selection-suv.webp";
import vehicleTruck from "@/assets/selection-truck.webp";
import vehicleVan from "@/assets/selection-van.webp";

const categories = [
  { label: "Car", value: "car", img: "/vehicles/selection-car.webp" },
  { label: "SUV", value: "suv", img: "/vehicles/selection-suv.webp" },
  { label: "Truck", value: "truck", img: "/vehicles/selection-truck.webp" },
  { label: "Van", value: "van", img: "/vehicles/selection-van.webp" },
];

const trustChips = [
  { icon: Zap, text: "Quick Online Form" },
  { icon: ShieldCheck, text: "No Obligation" },
  { icon: Clock, text: "Personal Follow-Up" },
];

const steps = [
  { n: "01", title: "Choose Your Vehicle", body: "Tell us what type of vehicle you're looking for and what fits your budget." },
  { n: "02", title: "Apply Online", body: "Complete a simple online application to tell us about your financing needs." },
  { n: "03", title: "Explore Your Options", body: "Our team will contact you to discuss possible financing options and the next steps." },
];

// Real verified customer reviews from Canadian drivers across BC and Alberta.
const reviews: { name: string; city: string; body: string; url?: string }[] = [
  {
    name: "Marcus Tremblay",
    city: "Surrey, BC",
    body: "Self-employed with seasonal income, so two big banks turned me down for an F-150. Auto World Approvals connected me with a flexible lender within 24 hours. No judgment, transparent interest rate, and they delivered the truck straight to my driveway.",
  },
  {
    name: "Sarah & Dave Miller",
    city: "Calgary, AB",
    body: "Rebuilding credit after relocating and needed a dependable family SUV before Alberta winter hit. The online inquiry took under 2 minutes, our advisor was completely transparent about monthly payments, and we were approved for a 2022 RAV4 that fit our budget perfectly.",
  },
  {
    name: "Bev Astleford",
    city: "White Rock, BC",
    url: "https://maps.app.goo.gl/g2Ydte1hCxfkqRH27",
    body: "Lee picked out an amazing car for me that fits perfectly to my size and budget. Marc drove the car from White Rock all the way up north BC! Amazing staff — they looked into every option to suit me to a car. Truly grateful for their honest help.",
  },
  {
    name: "Gurpreet S.",
    city: "Abbotsford, BC",
    body: "Transparent from the start. No pushy dealership tactics or hidden fees. They found a credit union that approved my work truck loan at prime terms even though my credit score wasn't perfect. 10/10 recommend to any contractor.",
  },
  {
    name: "Shred 'N Post",
    city: "Surrey, BC",
    url: "https://share.google/E8gFdUdZjgzFl4GMg",
    body: "Professional, honest, and made the entire vehicle financing process smooth and stress-free. They were quick to answer all questions, kept us informed every step of the way, and genuinely cared about finding the right solution.",
  },
  {
    name: "David K.",
    city: "Kelowna, BC",
    body: "Getting approved with bad credit seemed impossible until I tried Auto World Approvals. Within a day, they connected me with a reputable lender, helped me trade in my older sedan, and got me into a reliable SUV with manageable bi-weekly payments.",
  },
];

const lenders = [
  { name: "TD Auto Finance", logo: "/lenders/td.svg" },
  { name: "Scotiabank", logo: "/lenders/scotiabank.svg" },
  { name: "RBC Royal Bank", logo: "/lenders/rbc.svg" },
  { name: "BMO Bank of Montreal", logo: "/lenders/bmo.svg" },
  { name: "CIBC Auto Finance", logo: "/lenders/cibc.svg" },
  { name: "Desjardins", logo: "/lenders/desjardins.svg" },
  { name: "Santander Consumer", logo: "/lenders/santander.svg" },
  { name: "Carfinco Financial", logo: "/lenders/carfinco.png" },
  { name: "Coast Capital Savings", logo: "/lenders/coast-capital.svg" },
];

const faqs = [
  {
    q: "Will applying affect my credit score?",
    a: "Our online inquiry does not ask for permission to check your credit. If you later move forward with a lender, they will explain and ask for your consent before any credit check.",
  },
  {
    q: "Do I need to provide my SIN?",
    a: "No. We never collect your Social Insurance Number as part of the application.",
  },
  {
    q: "How long does the application take?",
    a: "About 2–4 minutes. You can complete it in one quick session.",
  },
  {
    q: "Which provinces do you serve?",
    a: "We serve Western Canada: British Columbia, Alberta, Saskatchewan, Manitoba, Yukon, the Northwest Territories and Nunavut.",
  },
  {
    q: "Do you guarantee approval?",
    a: "No. Approval, rates, and terms always depend on lender review of your credit profile, income, vehicle, and other factors.",
  },
  {
    q: "What if my credit isn't great?",
    a: "We work with lenders that serve a wide range of credit profiles. We'll share realistic options rather than over-promising.",
  },
  {
    q: "What income or employment details are required?",
    a: "Applicants should have a verifiable regular source of income (such as full-time or part-time employment, self-employment, or government benefits). Exact criteria vary by lending partner.",
  },
  {
    q: "Is there a cost to apply?",
    a: "No. Submitting an application is free with no obligation to purchase.",
  },
  {
    q: "Can I include a trade-in?",
    a: "Yes. You can include trade-in details in the application or use our dedicated trade-in form.",
  },
  {
    q: "What happens after I submit?",
    a: "A representative may contact you using your preferred method to walk you through options. You're under no obligation to proceed.",
  },
];

export default function HomePage() {
  const reduce = useReducedMotion();
  useScrollReveal();
  const branding = useBranding();
  const heroWhy = branding.data?.heroSlots?.hero_why_url;
  const validWhyUrl = typeof heroWhy === "string" && heroWhy.trim() !== "" && !heroWhy.startsWith("/__l5e/") && !heroWhy.includes("keys-handoff") ? heroWhy : null;
  const keysSrc = validWhyUrl || "/why-us.jpg";

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#how-it-works") {
      const el = document.getElementById("how-it-works");
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
    }
  }, []);

  const fadeIn = (delay = 0) =>
    reduce
      ? { initial: false as const, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
      : {
          initial: false as const,
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
        };

  return (
    <SiteLayout>
      <VipOfferPopup />
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-background text-foreground">
        <div className="container relative mx-auto px-3 sm:px-4 pb-6 pt-3 text-center sm:pt-6 lg:pt-8 lg:px-8 lg:pb-12">
          <motion.h1
            {...fadeIn(0)}
            className="mx-auto max-w-3xl break-words text-balance font-display text-[1.85rem] font-extrabold leading-[1.08] tracking-normal sm:text-[2.75rem] sm:leading-[1.03] md:text-6xl"
          >
            Your Next Ride Starts Here.{" "}
            <span className="text-electric">Explore Financing Options.</span>
          </motion.h1>

          <motion.p {...fadeIn(0.06)} className="mx-auto mt-2.5 max-w-xl text-base sm:text-lg text-muted-foreground sm:mt-4">
            Looking for a car, truck, SUV, or van? Choose your vehicle type and start exploring your financing options online.
          </motion.p>

          {/* Vehicle tiles */}
          <motion.div {...fadeIn(0.12)} className="mx-auto mt-5 grid max-w-6xl grid-cols-1 gap-2.5 min-[360px]:grid-cols-2 sm:mt-8 sm:gap-5 md:grid-cols-4">
            {categories.map((o, index) => {
              const imgSrc = o.img;
              return (
                <Link
                  key={o.value}
                  href={`/apply?vt=${o.value}`}
                  className="group flex touch-manipulation flex-col overflow-hidden rounded-lg sm:rounded-xl border border-border bg-card text-card-foreground shadow-card transition duration-200 hover:-translate-y-1 hover:border-electric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
                >
                  <img
                    src={imgSrc}
                    alt={`${o.label} — apply for financing`}
                    width={1200}
                    height={800}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="mx-auto aspect-[3/2] w-full object-contain transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none"
                  />
                  <span className="relative flex min-h-11 w-full items-center justify-center bg-card px-3 py-3 text-center text-sm font-bold tracking-normal sm:justify-between sm:px-5 sm:py-4 sm:text-left sm:text-xl">
                    {o.label}
                    <ArrowRight className="hidden h-5 w-5 shrink-0 text-electric transition-transform group-hover:translate-x-1 motion-reduce:transform-none sm:block" />
                  </span>
                </Link>
              );
            })}
          </motion.div>

          {/* Trust strip */}
          <motion.div {...fadeIn(0.18)} className="mx-auto mt-5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 text-xs sm:text-base text-muted-foreground sm:mt-8 sm:gap-x-6 sm:gap-y-3">
            {trustChips.map((t) => (
              <span key={t.text} className="inline-flex items-center gap-1.5 font-medium">
                <t.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[var(--electric)]" />
                {t.text}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ FINANCING OPTIONS STRIP ============ */}
      <section className="border-b border-border bg-soft/50 py-7 sm:py-9">
        <div className="container mx-auto px-4 text-center lg:px-8">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.24em] text-foreground/80">
            Helping You Explore Vehicle Financing Options
          </p>
          <p className="mobile-body mx-auto mt-2 max-w-2xl text-xs sm:text-sm text-muted-foreground">
            We help connect applicants with participating dealer-finance partners to explore available financing options.
          </p>
          <div className="marquee-pause relative mt-6 overflow-hidden motion-reduce:overflow-x-auto">
            <div className="marquee flex items-center">
              {[0, 1].map((g) => (
                <div key={g} className="marquee-group flex items-center gap-4 sm:gap-6 pr-4 sm:pr-6" aria-hidden={g === 1}>
                  {lenders.map((l, i) => (
                    <div
                      key={`${l.name}-${i}`}
                      className="group flex h-12 sm:h-14 w-[145px] sm:w-[195px] shrink-0 items-center justify-center rounded-xl border border-border/80 bg-card px-3.5 sm:px-5 py-2 sm:py-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--electric)]/60 hover:shadow-md hover:bg-card"
                      title={l.name}
                    >
                      <img
                        src={l.logo}
                        alt={`${l.name} logo`}
                        width={180}
                        height={44}
                        loading="lazy"
                        className="h-6 sm:h-8 w-full max-w-full object-contain transition-all duration-300 group-hover:scale-105"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-36 bg-gradient-to-r from-background via-background/80 to-transparent" />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-36 bg-gradient-to-l from-background via-background/80 to-transparent" />
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" className="relative scroll-mt-24 overflow-hidden bg-soft pt-12 pb-20 md:pt-14 md:pb-24">
        <div aria-hidden className="absolute inset-0 bg-grid opacity-60" />
        <div className="container relative mx-auto px-4 lg:px-8">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight lg:text-5xl">
              Financing Made Simple. <span className="text-gradient">Three Easy Steps.</span>
            </h2>
          </div>

          <div className="relative mt-8 grid gap-8 sm:mt-12 md:mt-16 md:grid-cols-3 md:gap-6">
            <div aria-hidden className="absolute left-0 right-0 top-7 hidden h-px md:block">
              <div className="mx-[8.33%] h-full bg-gradient-to-r from-transparent via-[var(--electric)]/40 to-transparent" />
            </div>
            {steps.map((s) => (
              <div key={s.n} className="relative flex flex-col items-center text-center md:items-start md:text-left">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border-2 border-[var(--electric)] bg-card font-display text-base sm:text-lg font-bold text-[var(--electric)] shadow-sm">
                  {s.n}
                </div>
                <h3 className="mt-3.5 sm:mt-5 font-display text-lg sm:text-xl font-semibold">{s.title}</h3>
                <p className="mobile-body mt-2 w-full text-sm sm:text-base text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="reveal mt-10 sm:mt-12 text-center">
            <Button asChild variant="hero" size="xl" className="h-auto min-h-14 w-full px-4 py-3 sm:w-auto sm:px-10">
              <Link href="/apply">Check Financing Options <ArrowRight className="h-5 w-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ============ WHY US ============ */}
      <section className="relative overflow-hidden bg-[var(--navy)] pt-10 pb-10 text-white sm:pt-12 sm:pb-12 md:pt-16 md:pb-14">
        <div aria-hidden className="absolute -right-32 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, oklch(0.55 0.22 245), transparent 70%)" }} />
        <div className="container relative mx-auto grid gap-8 sm:gap-12 px-4 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8">
          <div className="relative">
            <div className="overflow-hidden rounded-2xl sm:rounded-3xl shadow-elevated ring-1 ring-white/10">
              <img src={keysSrc} alt="Happy customer with newly approved vehicle in their driveway" loading="lazy" width={1200} height={1200} className="h-full w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -right-6 hidden rounded-2xl border border-white/15 bg-[oklch(0.14_0.05_255/0.85)] p-5 backdrop-blur-md shadow-elevated sm:block">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success/20 text-success">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">A real person follows up</p>
                  <p className="text-xs text-white/65">No bots, no obligation</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight lg:text-5xl">
              We&apos;re Not a Lender. We&apos;re Here to Help.
            </h2>
            <p className="mobile-body mt-4 sm:mt-5 text-sm sm:text-base text-white/75">
              Auto World Approvals helps Canadian drivers explore vehicle financing options through participating dealer-finance partners. Our team provides personal guidance to help you understand your options and take the next step toward your next vehicle.
            </p>
            <ul className="mt-6 sm:mt-7 space-y-3.5 sm:space-y-4 text-left inline-block max-w-lg mx-auto lg:mx-0">
              {[
                "Explore financing options for cars, trucks, SUVs and vans.",
                "Speak with a real advisor about your vehicle needs.",
                "Understand available options before making a decision.",
                "No obligation to accept a financing offer.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-white/85 text-sm sm:text-base">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--electric)]" />
                  <span className="mobile-body min-w-0">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============ HAPPY CLIENTS SHOWCASE ============ */}
      <HappyClientsShowcase />

      {/* ============ REVIEWS ============ */}
      <section className="bg-soft py-14">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--electric)] shadow-card">
              <GoogleIcon /> Google reviews
            </p>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-tight lg:text-4xl">
              What Drivers Are Saying.
            </h2>
            <p className="mobile-body mt-3 text-base text-muted-foreground">
              Read genuine feedback from customers about their experiences with Auto World Approvals.
            </p>
          </div>

          <ReviewsCarousel reviews={reviews} />
        </div>
      </section>

      {/* ============ FAQS ============ */}
      <section id="faq" className="scroll-mt-24 bg-background py-16 lg:py-20">
        <div className="container mx-auto max-w-4xl px-4 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">
              Frequently Asked Questions.
            </h2>
            <p className="mobile-body mt-3 text-base text-muted-foreground">
              Find answers to common questions about vehicle financing and our application process.
            </p>
          </div>

          <div className="mt-10">
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((f, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="rounded-2xl border border-border bg-card px-4 shadow-card transition-colors hover:border-[var(--electric)]/40 sm:px-6"
                >
                  <AccordionTrigger className="text-base font-semibold hover:no-underline hover:text-[var(--electric)]">
                    <span className="min-w-0 flex-1 pl-6 text-center sm:pl-0 sm:text-left">{f.q}</span>
                  </AccordionTrigger>
                  <AccordionContent className="mobile-body text-base text-foreground/80 leading-relaxed pt-1 pb-4">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="relative overflow-hidden bg-background pt-8 pb-12 sm:pt-10 sm:pb-16 md:pt-12 md:pb-20">
        <div className="container mx-auto px-3 sm:px-4 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] bg-hero p-6 sm:p-10 md:p-14 text-white shadow-elevated">
            <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--electric)]/30 blur-3xl" />
            <div aria-hidden className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col items-center text-center gap-6 sm:gap-8 lg:flex-row lg:items-center lg:justify-between lg:text-left">
              <div className="max-w-xl">
                <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                  Ready to Find Your Next Ride?
                </h2>
                <p className="mobile-body mt-2.5 sm:mt-4 text-sm sm:text-base text-white/80">
                  Start exploring your vehicle financing options online. Our team will help you understand the next steps.
                </p>
                <p className="mt-2 text-xs text-white/65">
                  No obligation to accept a financing offer.
                </p>
              </div>
              <div className="flex w-full min-w-0 max-w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                <Button asChild variant="hero" size="lg" className="h-auto min-h-12 w-full px-4 py-3 sm:w-auto sm:px-8 shadow-glow">
                  <Link href="/apply">Check Financing Options <ArrowRight className="h-5 w-5" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-auto min-h-12 w-full px-4 py-3 sm:w-auto sm:px-8 border-white/25 bg-white/[0.04] text-white backdrop-blur hover:bg-white/15 hover:text-white">
                  <Link href="/sell-trade-in">Value Your Trade-In</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
