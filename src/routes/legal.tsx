import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/site/LegalLayout";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Legal Agreements | Auto World Approvals" },
      { name: "description", content: "All legal documents governing Auto World Approvals services — privacy, terms, consent and cookie policies in one place." },
      { property: "og:title", content: "Legal Agreements | Auto World Approvals" },
      { property: "og:description", content: "Index of the privacy, terms, consent and cookie policies that govern the Auto World Approvals platform." },
      { property: "og:url", content: "https://autoworldapprovals.com/legal" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://autoworldapprovals.com/legal" }],
  }),
  component: () => (
    <LegalLayout title="Legal Agreements">
      <p>The following documents govern your use of Auto World Approvals services. Please review each before applying.</p>
      <ul>
        <li><Link to="/privacy" className="text-[var(--electric)] underline">Privacy Policy</Link></li>
        <li><Link to="/terms" className="text-[var(--electric)] underline">Terms of Use</Link></li>
        <li><Link to="/consent" className="text-electric underline">Application Consent</Link></li>
        <li><Link to="/cookies" className="text-[var(--electric)] underline">Cookie Policy</Link></li>
      </ul>
      <h2>Compliance notes</h2>
      <p>Auto World Approvals is a lead-generation service and does not lend money. All financing is provided by independent third-party lenders. We do not collect Social Insurance Numbers as part of our application process.</p>
    </LegalLayout>
  ),
});
