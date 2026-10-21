import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/site/LegalLayout";
import { LEGAL_DEFAULT_MARKDOWN } from "@/lib/legal-defaults";
import { LegalMarkdown, LegalDbOverride } from "@/components/site/LegalDbOverride";

export const Route = createFileRoute("/consent")({
  head: () => ({
    meta: [
      { title: "Application Consent | Auto World Approvals" },
      { name: "description", content: "Express written consent governing the collection, use and disclosure of your personal information when you apply for vehicle financing pre-qualification through Auto World Approvals." },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: "Application Consent | Auto World Approvals" },
      { property: "og:description", content: "Required inquiry-response acknowledgement and separate optional promotional email permission." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://autoworldapprovals.com/consent" },
    ],
    links: [{ rel: "canonical", href: "https://autoworldapprovals.com/consent" }],
  }),
  component: () => (
    <LegalLayout title="Application Consent" lastUpdated="October 19, 2026">
      <LegalDbOverride slug="consent" fallback={<LegalMarkdown body={LEGAL_DEFAULT_MARKDOWN.consent} />} />
    </LegalLayout>
  ),
});
