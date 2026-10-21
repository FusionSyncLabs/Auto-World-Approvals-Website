import type { Metadata } from "next";
import { LegalLayout } from "@/components/site/LegalLayout";
import { LEGAL_DEFAULT_MARKDOWN } from "@/lib/legal-defaults";
import { LegalMarkdown, LegalDbOverride } from "@/components/site/LegalDbOverride";

export const metadata: Metadata = {
  title: "Application Consent | Auto World Approvals",
  description:
    "Express written consent governing the collection, use and disclosure of your personal information when you apply for vehicle financing pre-qualification through Auto World Approvals.",
};

export default function ConsentPage() {
  return (
    <LegalLayout title="Application Consent" lastUpdated="October 19, 2026">
      <LegalDbOverride
        slug="consent"
        fallback={<LegalMarkdown body={LEGAL_DEFAULT_MARKDOWN.consent} />}
      />
    </LegalLayout>
  );
}
