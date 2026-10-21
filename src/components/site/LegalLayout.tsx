"use client";

import type { ReactNode } from "react";
import { SiteLayout } from "./SiteLayout";
import { PageHero } from "./PageHero";
import { Link } from "@/components/ui/link";
import { Button } from "@/components/ui/button";

interface LegalLayoutProps {
  eyebrow?: string;
  title: string;
  lastUpdated?: string;
  children: ReactNode;
}
export function LegalLayout({ title, lastUpdated = "October 19, 2026", children }: LegalLayoutProps) {
  return (
    <SiteLayout>
      <PageHero title={title} description={`Last updated: ${lastUpdated}`} />
      <section className="container mx-auto max-w-3xl px-4 py-16 lg:px-8">
        <nav aria-label="Legal documents" className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-base">
          <Link to="/privacy" className="underline">Privacy</Link>
          <Link to="/terms" className="underline">Terms</Link>
          <Link to="/consent" className="underline">Application consent</Link>
          <Link to="/cookies" className="underline">Cookies</Link>
          <button type="button" className="text-base underline cursor-pointer hover:text-primary transition-colors" onClick={() => window.dispatchEvent(new Event("awa:open-cookie-preferences"))}>Cookie preferences</button>
        </nav>
        <article className="max-w-none break-words text-base text-foreground [&_a]:text-primary [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1">
          {children}
        </article>
      </section>
    </SiteLayout>
  );
}
