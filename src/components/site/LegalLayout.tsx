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
        <nav aria-label="Legal documents" className="mb-8 flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-1 text-base [&_a]:inline-flex [&_a]:min-h-11 [&_a]:max-w-full [&_a]:items-center [&_a]:justify-center [&_a]:rounded-sm [&_a]:text-center [&_a]:underline [&_a]:[overflow-wrap:anywhere] [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-ring [&_a:focus-visible]:ring-offset-2">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/consent">Application consent</Link>
          <Link to="/cookies">Cookies</Link>
          <button type="button" className="inline-flex min-h-11 max-w-full items-center justify-center rounded-sm text-center text-base underline cursor-pointer hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onClick={() => window.dispatchEvent(new Event("awa:open-cookie-preferences"))}>Cookie preferences</button>
        </nav>
        <article className="min-w-0 max-w-none text-base text-foreground [overflow-wrap:anywhere] [&_a]:text-primary [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold max-sm:[&_h1]:text-center max-sm:[&_h2]:text-center max-sm:[&_h3]:text-center max-sm:[&_h4]:text-center max-sm:[&_h5]:text-center max-sm:[&_h6]:text-center [&_p]:mt-3 [&_p]:leading-relaxed max-sm:[&_p]:text-justify max-sm:[&_p]:hyphens-auto [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-1 [&_img]:h-auto [&_img]:max-w-full [&_table]:my-5 [&_table]:block [&_table]:w-full [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:text-left [&_table]:[overflow-wrap:normal] [&_th]:border-b [&_th]:p-2 [&_th]:text-left [&_td]:border-b [&_td]:p-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:text-left [&_pre]:[overflow-wrap:normal]">
          {children}
        </article>
      </section>
    </SiteLayout>
  );
}
