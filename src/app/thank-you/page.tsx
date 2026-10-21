"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Check } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

function ThankYouContent() {
  const searchParams = useSearchParams();
  const id = searchParams?.get("id");

  return (
    <SiteLayout>
      <section className="bg-soft py-16 sm:py-24">
        <div className="container mx-auto max-w-xl px-4 text-center">
          <Check className="mx-auto h-16 w-16 text-success" strokeWidth={2} />
          <h1 className="mt-6 text-3xl font-bold sm:text-4xl">
            Your inquiry has been received.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            An authorized advisor will review your inquiry and contact you about
            your preferences and any further information needed. This is not a
            financing approval or an interest-rate offer.
          </p>
          {id && (
            <p className="mt-5 font-mono text-base text-muted-foreground">
              Reference: {id.slice(0, 8).toUpperCase()}
            </p>
          )}
          <div className="mt-10 border-t border-border pt-8 text-left">
            <h2 className="text-xl font-semibold">What happens next</h2>
            <ol className="mt-4 list-decimal space-y-4 pl-5 text-base text-muted-foreground">
              <li>An advisor reviews your inquiry and vehicle preferences.</li>
              <li>
                The advisor contacts you to discuss options and any additional
                details or authorization needed.
              </li>
              <li>
                You decide whether to proceed. There is no obligation and
                approval is not guaranteed.
              </li>
            </ol>
          </div>
          <Button asChild size="lg" className="mt-10">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-soft flex items-center justify-center p-8 text-muted-foreground">
          Loading receipt...
        </div>
      }
    >
      <ThankYouContent />
    </Suspense>
  );
}
