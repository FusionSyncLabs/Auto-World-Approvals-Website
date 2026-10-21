import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/site/LegalLayout";
import { LEGAL_DEFAULT_MARKDOWN } from "@/lib/legal-defaults";
import { LegalMarkdown, LegalDbOverride } from "@/components/site/LegalDbOverride";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use | Auto World Approvals" },
      { name: "description", content: "Legally binding Terms of Use governing access to and use of the Auto World Approvals platform operated by Merk Digital Ltd." },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: "Terms of Use | Auto World Approvals" },
      { property: "og:description", content: "The terms that govern access to and use of the Auto World Approvals vehicle pre-qualification platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://autoworldapprovals.com/terms" },
    ],
    links: [{ rel: "canonical", href: "https://autoworldapprovals.com/terms" }],
  }),
  component: () => (
    <LegalLayout title="Terms of Use" lastUpdated="October 20, 2026">
      <LegalDbOverride slug="terms" fallback={<LegalMarkdown body={LEGAL_DEFAULT_MARKDOWN.terms} />} />
    </LegalLayout>
  ),
});
