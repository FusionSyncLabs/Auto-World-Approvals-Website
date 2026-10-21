import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/site/LegalLayout";
import { LEGAL_DEFAULT_MARKDOWN } from "@/lib/legal-defaults";
import { LegalMarkdown, LegalDbOverride } from "@/components/site/LegalDbOverride";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Auto World Approvals" },
      { name: "description", content: "How Auto World Approvals, operated by Merk Digital Ltd., collects, uses, discloses and safeguards your personal information." },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: "Privacy Policy | Auto World Approvals" },
      { property: "og:description", content: "How we use inquiry information, share it with partners and handle privacy requests." },
      { property: "og:url", content: "https://autoworldapprovals.com/privacy" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://autoworldapprovals.com/privacy" }],
  }),
  component: () => (
    <LegalLayout title="Privacy Policy" lastUpdated="October 20, 2026">
      <LegalDbOverride slug="privacy" fallback={<LegalMarkdown body={LEGAL_DEFAULT_MARKDOWN.privacy} />} />
    </LegalLayout>
  ),
});
