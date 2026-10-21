"use client";

import { Link } from "@/components/ui/link";
import { Logo } from "./Logo";
import { Facebook, Mail, MapPin, Building2 } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-[var(--navy)] text-[var(--navy-foreground)]">
      <div className="container mx-auto grid grid-cols-1 gap-10 px-4 py-14 lg:grid-cols-4 lg:px-8">
        <div className="space-y-4">
          <Logo variant="light" />
          <p className="text-sm text-white/70">
            Vehicle financing inquiries for drivers across Western Canada. No obligation.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <a
              href="https://www.facebook.com/autoworldapprovals"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Auto World Approvals on Facebook"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <Facebook className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/90">Company</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/about" className="hover:text-white">About Us</Link></li>
            <li><Link to="/how-it-works" className="hover:text-white">How It Works</Link></li>
            <li><Link to="/vehicles" className="hover:text-white">Vehicle Types</Link></li>
            <li><Link to="/blog" className="hover:text-white">Resources &amp; Guides</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link href="/vehicle-financing/bc" className="hover:text-white">BC Financing Guide</Link></li>
            <li><Link href="/vehicle-financing/alberta" className="hover:text-white">Alberta Financing Guide</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/90">Legal</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-white">Terms of Use</Link></li>
            <li><Link to="/consent" className="hover:text-white">Application Consent</Link></li>
            <li><Link to="/cookies" className="hover:text-white">Cookie Policy</Link></li>
            <li>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("awa:open-cookie-preferences"))}
                className="cursor-pointer text-sm text-white/70 hover:text-white transition-colors"
              >
                Cookie Preferences
              </button>
            </li>
            <li><Link to="/legal" className="hover:text-white">Legal Agreements</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/90">Contact</h4>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-white/70" />
              <a href="mailto:admin@autoworldapprovals.com" className="break-all hover:text-white transition-colors">
                admin@autoworldapprovals.com
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-white/70" />
              <span>BC, AB, SK, MB, YT, NT &amp; NU</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 shrink-0 text-white/70" />
              <span>Operated by Merk Digital Ltd.</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/55 lg:flex-row lg:px-8">
          <p>© {new Date().getFullYear()} Auto World Approvals. All rights reserved.</p>
          <p>Pre-qualification is not a guarantee of credit approval. Approval, rates, and terms depend on lender review.</p>
        </div>
      </div>
    </footer>
  );
}
