import type { Metadata } from "next";
import { LegalLayout } from "@/components/site/LegalLayout";
import { LEGAL_DEFAULT_MARKDOWN } from "@/lib/legal-defaults";
import { LegalMarkdown, LegalDbOverride } from "@/components/site/LegalDbOverride";

export const metadata: Metadata = {
  title: "Terms of Use | Auto World Approvals",
  description:
    "Legally binding Terms of Use governing access to and use of the Auto World Approvals platform operated by Merk Digital Ltd.",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Use" lastUpdated="October 20, 2026">
      <LegalDbOverride
        slug="terms"
        fallback={<LegalMarkdown body={LEGAL_DEFAULT_MARKDOWN.terms} />}
      />
    </LegalLayout>
  );
}
