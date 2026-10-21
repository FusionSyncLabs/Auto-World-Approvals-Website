import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Check } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { confirmIntakeReceipt } from "@/lib/funnel/intake.functions";

export const Route = createFileRoute("/thank-you")({
  validateSearch: z.object({ id: z.string().uuid().optional() }),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: ({ deps }) => confirmIntakeReceipt({ data: { id: deps.id } }),
  head: () => ({
    meta: [
      { title: "Application Received | Auto World Approvals" },
      { name: "description", content: "Your vehicle financing inquiry receipt and next steps with an Auto World Approvals advisor." },
      { property: "og:title", content: "Application Receipt | Auto World Approvals" },
      { property: "og:description", content: "View the receipt and next steps for your vehicle financing inquiry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThankYou,
});

function ThankYou() {
  const { id } = Route.useSearch();
  const { confirmed } = Route.useLoaderData();
  if (!confirmed) return <SiteLayout><section className="container mx-auto px-4 py-20 text-center"><h1 className="text-3xl font-bold">No application receipt available</h1><p className="mt-4 text-muted-foreground">This page does not confirm a saved application. Complete your inquiry to receive a reference.</p><Button asChild className="mt-6"><Link to="/apply">Start an inquiry</Link></Button></section></SiteLayout>;
  return <SiteLayout><section className="bg-soft py-16 sm:py-24">
    <div className="container mx-auto max-w-xl px-4 text-center">
      <Check className="mx-auto h-16 w-16 text-success" strokeWidth={2} />
      <h1 className="mt-6 text-3xl font-bold sm:text-4xl">Your inquiry has been received.</h1>
      <p className="mt-5 text-lg text-muted-foreground">An authorized advisor will review your inquiry and contact you about your preferences and any further information needed. This is not a financing approval or an interest-rate offer.</p>
      {id && <p className="mt-5 font-mono text-base text-muted-foreground">Reference: {id.slice(0, 8).toUpperCase()}</p>}
      <div className="mt-10 border-t border-border pt-8 text-left">
        <h2 className="text-xl font-semibold">What happens next</h2>
        <ol className="mt-4 list-decimal space-y-4 pl-5 text-base text-muted-foreground">
          <li>An advisor reviews your inquiry and vehicle preferences.</li>
          <li>The advisor contacts you to discuss options and any additional details or authorization needed.</li>
          <li>You decide whether to proceed. There is no obligation and approval is not guaranteed.</li>
        </ol>
      </div>
      <Button asChild size="lg" className="mt-10"><Link to="/">Back to home</Link></Button>
    </div>
  </section></SiteLayout>;
}
