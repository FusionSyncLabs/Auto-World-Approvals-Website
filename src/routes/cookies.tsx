import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/site/LegalLayout";
import { LEGAL_DEFAULT_MARKDOWN } from "@/lib/legal-defaults";
import { LegalMarkdown, LegalDbOverride } from "@/components/site/LegalDbOverride";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy | Auto World Approvals" },
      { name: "description", content: "How Auto World Approvals uses cookies, pixels and similar tracking technologies, the categories we use, the third parties involved, and how to manage or withdraw your consent." },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: "Cookie Policy | Auto World Approvals" },
      { property: "og:description", content: "Full disclosure of the cookies, pixels and tracking technologies used on autoworldapprovals.com and how to manage your preferences." },
      { property: "og:url", content: "https://autoworldapprovals.com/cookies" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://autoworldapprovals.com/cookies" }],
  }),
  component: () => (
    <LegalLayout title="Cookie Policy" lastUpdated="October 19, 2026">
      <LegalDbOverride slug="cookies" fallback={<LegalMarkdown body={LEGAL_DEFAULT_MARKDOWN.cookies} />} />
    </LegalLayout>
  ),
});
