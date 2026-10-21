import type { Metadata } from "next";
import { LegalLayout } from "@/components/site/LegalLayout";
import { LEGAL_DEFAULT_MARKDOWN } from "@/lib/legal-defaults";
import { LegalMarkdown, LegalDbOverride } from "@/components/site/LegalDbOverride";

export const metadata: Metadata = {
  title: "Privacy Policy | Auto World Approvals",
  description:
    "How Auto World Approvals, operated by Merk Digital Ltd., collects, uses, discloses and safeguards your personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="October 20, 2026">
      <LegalDbOverride
        slug="privacy"
        fallback={<LegalMarkdown body={LEGAL_DEFAULT_MARKDOWN.privacy} />}
      />
    </LegalLayout>
  );
}
