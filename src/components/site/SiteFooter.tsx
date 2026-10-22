"use client";

import { Link } from "@/components/ui/link";
import { Logo } from "./Logo";
import { Facebook, Mail, MapPin, Building2 } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-[var(--navy)] text-[var(--navy-foreground)]">
      <div className="container mx-auto grid grid-cols-1 gap-x-5 gap-y-8 px-4 py-10 min-[360px]:grid-cols-2 sm:gap-10 sm:py-14 lg:grid-cols-4 lg:px-8">
        <div className="min-w-0 space-y-4 flex flex-col items-center text-center min-[360px]:col-span-2 lg:col-span-1 lg:items-start lg:text-left">
          <Logo variant="light" />
          <p className="max-w-sm text-justify text-sm text-white/70 sm:text-center lg:text-left">
            Vehicle financing inquiries for drivers across Western Canada. No obligation.
          </p>
          <div className="flex items-center justify-center lg:justify-start gap-3 pt-1">
            <a
              href="https://www.facebook.com/autoworldapprovals"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Auto World Approvals on Facebook"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Facebook className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div className="min-w-0 text-center lg:text-left">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/90">Company</h4>
          <ul className="text-sm text-white/70 [overflow-wrap:anywhere] [&_a]:inline-flex [&_a]:max-w-full [&_a]:min-h-11 [&_a]:items-center [&_a]:justify-center [&_a]:rounded [&_a]:py-2 [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-white lg:[&_a]:justify-start">
            <li><Link to="/about" className="hover:text-white">About Us</Link></li>
            <li><Link to="/how-it-works" className="hover:text-white">How It Works</Link></li>
            <li><Link to="/vehicles" className="hover:text-white">Vehicle Types</Link></li>
            <li><Link to="/blog" className="hover:text-white">Resources &amp; Guides</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link href="/vehicle-financing/bc" className="hover:text-white">BC Financing Guide</Link></li>
            <li><Link href="/vehicle-financing/alberta" className="hover:text-white">Alberta Financing Guide</Link></li>
          </ul>
        </div>
        <div className="min-w-0 text-center lg:text-left">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/90">Legal</h4>
          <ul className="text-sm text-white/70 [overflow-wrap:anywhere] [&_a]:inline-flex [&_a]:max-w-full [&_a]:min-h-11 [&_a]:items-center [&_a]:justify-center [&_a]:rounded [&_a]:py-2 [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-white lg:[&_a]:justify-start">
            <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-white">Terms of Use</Link></li>
            <li><Link to="/consent" className="hover:text-white">Application Consent</Link></li>
            <li><Link to="/cookies" className="hover:text-white">Cookie Policy</Link></li>
            <li>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("awa:open-cookie-preferences"))}
                className="max-w-full min-h-11 cursor-pointer rounded py-2 text-sm text-white/70 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Cookie Preferences
              </button>
            </li>
            <li><Link to="/legal" className="hover:text-white">Legal Agreements</Link></li>
          </ul>
        </div>
        <div className="min-w-0 flex flex-col items-center min-[360px]:col-span-2 lg:col-span-1 lg:items-start">
          <div className="inline-flex min-w-0 max-w-full flex-col items-start text-left">
            <h4 className="mb-3.5 text-sm font-semibold uppercase tracking-wider text-white/90">Contact</h4>
            <ul className="min-w-0 max-w-full space-y-3 text-sm text-white/70">
              <li className="flex min-w-0 max-w-full items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-white/70">
                  <Mail className="h-4 w-4" />
                </span>
                <a
                  href="mailto:admin@autoworldapprovals.com"
                  className="inline-flex min-h-11 min-w-0 max-w-full items-center break-all rounded py-2 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  admin@autoworldapprovals.com
                </a>
              </li>
              <li className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-white/70">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="min-w-0 break-words">BC, AB, SK, MB, YT, NT &amp; NU</span>
              </li>
              <li className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-white/70">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 break-words">Operated by Merk Digital Ltd.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs leading-relaxed text-white/55 lg:flex-row lg:gap-6 lg:px-8 lg:text-left">
          <p>© {new Date().getFullYear()} Auto World Approvals. All rights reserved.</p>
          <p>Pre-qualification is not a guarantee of credit approval. Approval, rates, and terms depend on lender review.</p>
        </div>
      </div>
    </footer>
  );
}
