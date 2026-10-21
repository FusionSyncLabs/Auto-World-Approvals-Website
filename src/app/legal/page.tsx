import type { Metadata } from "next";
import { LegalLayout } from "@/components/site/LegalLayout";
import { Link } from "@/components/ui/link";

export const metadata: Metadata = {
  title: "Legal Agreements | Auto World Approvals",
  description:
    "All legal documents governing Auto World Approvals services — privacy, terms, consent and cookie policies in one place.",
};

export default function LegalPage() {
  return (
    <LegalLayout title="Legal Agreements">
      <p>
        The following documents govern your use of Auto World Approvals
        services. Please review each before applying.
      </p>
      <ul className="mt-4 space-y-2">
        <li>
          <Link href="/privacy" className="text-[var(--electric)] underline">
            Privacy Policy
          </Link>
        </li>
        <li>
          <Link href="/terms" className="text-[var(--electric)] underline">
            Terms of Use
          </Link>
        </li>
        <li>
          <Link href="/consent" className="text-electric underline">
            Application Consent
          </Link>
        </li>
        <li>
          <Link href="/cookies" className="text-[var(--electric)] underline">
            Cookie Policy
          </Link>
        </li>
      </ul>
      <h2 className="mt-8 text-xl font-bold">Compliance notes</h2>
      <p className="mt-2 text-foreground/80">
        Auto World Approvals is a lead-generation service and does not lend
        money. All financing is provided by independent third-party lenders. We
        do not collect Social Insurance Numbers as part of our application
        process.
      </p>
    </LegalLayout>
  );
}
