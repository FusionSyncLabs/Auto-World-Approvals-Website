import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ | Auto World Approvals" },
      { name: "description", content: "Answers to common questions about vehicle pre-qualification in Canada." },
      { property: "og:title", content: "FAQ | Auto World Approvals" },
      { property: "og:description", content: "Pre-qualification FAQs for Western Canadian drivers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://autoworldapprovals.com/faq" },
    ],
    links: [{ rel: "canonical", href: "https://autoworldapprovals.com/faq" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    }],
  }),
  component: Page,
});

const faqs = [
  { q: "Will applying affect my credit score?", a: "Our online inquiry does not ask for permission to check your credit. If you later move forward with a lender, they will explain and ask for your consent before any credit check." },
  { q: "Do I need to provide my SIN?", a: "No. We never collect your Social Insurance Number as part of the application." },
  { q: "How long does the application take?", a: "About 2–4 minutes. You can save your progress and finish later." },
  { q: "Which provinces do you serve?", a: "We serve Western Canada: British Columbia, Alberta, Saskatchewan, Manitoba, Yukon, the Northwest Territories and Nunavut." },
  { q: "Do you guarantee approval?", a: "No. Approval, rates, and terms always depend on lender review of your credit profile, income, vehicle, and other factors." },
  { q: "What if my credit isn't great?", a: "We work with lenders that serve a wide range of credit profiles. We'll share realistic options rather than over-promising." },
  { q: "Is there a cost to apply?", a: "No. Submitting an application is free with no obligation to purchase." },
  { q: "Can I include a trade-in?", a: "Yes. You can include trade-in details in the application or use our dedicated trade-in form." },
  { q: "What happens after I submit?", a: "A representative may contact you using your preferred method to walk you through options. You're under no obligation to proceed." },
];

function Page() {
  return (
    <SiteLayout>
      <PageHero title="Frequently asked questions." description="Everything you'd want to know before you apply." />
      <section className="container mx-auto max-w-3xl px-4 py-16 lg:px-8">
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`q-${i}`} className="rounded-xl border border-border bg-card px-5 shadow-card">
              <AccordionTrigger className="text-left text-base font-semibold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-foreground/80">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </SiteLayout>
  );
}
