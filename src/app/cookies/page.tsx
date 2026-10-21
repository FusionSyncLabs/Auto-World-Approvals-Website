import type { Metadata } from "next";
import { LegalLayout } from "@/components/site/LegalLayout";
import { LEGAL_DEFAULT_MARKDOWN } from "@/lib/legal-defaults";
import { LegalMarkdown, LegalDbOverride } from "@/components/site/LegalDbOverride";

export const metadata: Metadata = {
  title: "Cookie Policy | Auto World Approvals",
  description:
    "How Auto World Approvals uses cookies, pixels and similar tracking technologies, the categories we use, the third parties involved, and how to manage or withdraw your consent.",
};

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="October 19, 2026">
      <LegalDbOverride
        slug="cookies"
        fallback={<LegalMarkdown body={LEGAL_DEFAULT_MARKDOWN.cookies} />}
      />
    </LegalLayout>
  );
}
